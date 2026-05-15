/**
 * BLC Plant Hire — lightweight mail + admin API (SMTP via Nodemailer)
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const {
  getFirebaseAdmin,
  firebaseAdminStatus,
} = require("./firebase-admin-init");

const PORT = parseInt(process.env.PORT || "8787", 10);
const API_KEY = (process.env.API_KEY || "").trim();
const APP_BASE_URL = (process.env.APP_BASE_URL || "").replace(/\/$/, "");
/** Optional HTTPS origin of the SPA (web); after PayToday return, browser clients redirect here with #paySync=<reference>. Android uses JavascriptInterface instead. */
const CLIENT_APP_URL = (process.env.CLIENT_APP_URL || "").trim().replace(/\/$/, "");
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const DATA_DIR = path.join(__dirname, "data");
const ADMIN_FILE = path.join(DATA_DIR, "admin-password.json");
const TWILIO_SID = (process.env.TWILIO_ACCOUNT_SID || "").trim();
const TWILIO_TOKEN = (process.env.TWILIO_AUTH_TOKEN || "").trim();
const TWILIO_SMS_FROM = (process.env.TWILIO_SMS_FROM || "").trim();
const TWILIO_WA_FROM = (process.env.TWILIO_WHATSAPP_FROM || "").trim();
const PAYMENT_WEBHOOK_SECRET = (process.env.PAYMENT_WEBHOOK_SECRET || "").trim();
const PAYTODAY_BUSINESS_ID = (process.env.PAYTODAY_BUSINESS_ID || "").trim();
const PAYTODAY_BUSINESS_NAME = (process.env.PAYTODAY_BUSINESS_NAME || "BLC Plant Hire").trim();
const PAYMENTS_FILE = path.join(DATA_DIR, "payments.json");

/** Short-lived checkout tokens → payment id (PayToday intent validity ≤30 min) */
const checkoutSessions = new Map();
setInterval(() => {
  const n = Date.now();
  for (const [tok, v] of checkoutSessions) {
    if (v.expiresAt < n) checkoutSessions.delete(tok);
  }
}, 60_000);

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "512kb" }));

function requireApiKey(req, res, next) {
  if (!API_KEY) return next();
  const key = req.get("X-BLC-API-Key") || req.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (key !== API_KEY) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  next();
}

function getAdminPassword() {
  try {
    if (fs.existsSync(ADMIN_FILE)) {
      const j = JSON.parse(fs.readFileSync(ADMIN_FILE, "utf8"));
      if (j && typeof j.password === "string" && j.password.length) return j.password;
    }
  } catch (e) {
    console.error("read admin file:", e.message);
  }
  return process.env.ADMIN_PASSWORD || "";
}

function setAdminPassword(pwd) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(ADMIN_FILE, JSON.stringify({ password: pwd, updatedAt: new Date().toISOString() }, null, 2), "utf8");
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: (process.env.SMTP_SECURE || "false").toLowerCase() === "true",
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" }
    : undefined,
});

async function sendMail({ to, subject, text, html }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from) throw new Error("SMTP_FROM or SMTP_USER is not set");
  if (!to) throw new Error("Missing recipient `to`");
  await transporter.sendMail({ from, to, subject, text, html: html || undefined });
}

app.get("/api/health", (req, res) => {
  const adminNs = getFirebaseAdmin();
  res.json({
    ok: true,
    service: "blc-plant-hire-api",
    hasSmtp: !!(process.env.SMTP_HOST && (process.env.SMTP_USER || process.env.SMTP_FROM)),
    hasApiKey: !!API_KEY,
    hasTwilio: !!(TWILIO_SID && TWILIO_TOKEN),
    hasPaymentWebhook: !!PAYMENT_WEBHOOK_SECRET,
    paytodayConfigured: !!(PAYTODAY_BUSINESS_ID && PAYTODAY_BUSINESS_NAME && APP_BASE_URL),
    hasFirebaseAdmin: !!adminNs,
    firebaseAdmin: firebaseAdminStatus(),
  });
});

// Simple in-memory rate limit: key -> { c, t }
function rateKey(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "unknown";
}
function allowRate(key, max, winMs) {
  const now = Date.now();
  const slot = RATE.get(key);
  if (!slot || now - slot.t > winMs) {
    RATE.set(key, { c: 1, t: now });
    return true;
  }
  if (slot.c >= max) return false;
  slot.c++;
  return true;
}
const RATE = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of RATE) {
    if (now - v.t > 3_600_000) RATE.delete(k);
  }
}, 60_000);

const seenPaymentRefs = new Set();
function rememberPaymentRef(ref) {
  const k = String(ref || "").trim();
  if (!k) return false;
  if (seenPaymentRefs.has(k)) return false;
  seenPaymentRefs.add(k);
  if (seenPaymentRefs.size > 5000) {
    const it = seenPaymentRefs.values();
    for (let i = 0; i < 500; i++) {
      const n = it.next();
      if (n.done) break;
      seenPaymentRefs.delete(n.value);
    }
  }
  return true;
}

function loadPayments() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(PAYMENTS_FILE)) return [];
    const arr = JSON.parse(fs.readFileSync(PAYMENTS_FILE, "utf8"));
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    console.error("loadPayments:", e.message);
    return [];
  }
}

function savePayments(rows) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(rows, null, 2), "utf8");
}

function escHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function paymentMergeHints(p) {
  if (!p || p.status !== "paid") return null;
  if (p.kind === "sale_bid") return { kind: "sale_bid", entityId: p.entityId, serviceAccessActive: true };
  if (p.kind === "hire_booking") return { kind: "hire_booking", entityId: p.entityId, serviceAccessActive: true };
  return { kind: p.kind, entityId: p.entityId };
}

function requireAdminPassword(req, res, next) {
  const pwd = String(req.get("X-BLC-Admin-Password") || "");
  const cur = getAdminPassword();
  if (!cur || pwd !== cur) {
    return res.status(401).json({ ok: false, error: "invalid_or_missing_admin_password" });
  }
  next();
}

/** PayToday tx status check (community-documented JSON endpoint). */
async function fetchPayTodayTxStatus(reference) {
  const bid = PAYTODAY_BUSINESS_ID;
  if (!bid) return { ok: false, error: "paytoday_business_id_missing" };
  const url = `https://paytoday.com.na/transactions/txstatus/${encodeURIComponent(bid)}/${encodeURIComponent(reference)}.json`;
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    const text = await r.text();
    let data = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    if (!r.ok) return { ok: false, http: r.status, data };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message || "txstatus_fetch_failed" };
  }
}

function payTodayStatusIndicatesPaid(data) {
  if (!data || typeof data !== "object") return false;
  const d = data.data !== undefined ? data.data : data;
  const st = String(d.status || d.transaction_status || d.state || "").toLowerCase();
  if (st.includes("success") || st === "paid" || st === "complete" || st === "completed") return true;
  if (d.paid === true || d.success === true || d.completed === true) return true;
  if (String(d.result || "").toLowerCase() === "success") return true;
  return false;
}

async function finalizePaymentRecordPaid(payment) {
  const rows = loadPayments();
  const idx = rows.findIndex((x) => x.id === payment.id);
  if (idx < 0) return { ok: false, error: "payment_not_found" };
  const p = rows[idx];
  if (p.status === "paid") return { ok: true, duplicate: true, payment: p };

  const verify = await fetchPayTodayTxStatus(p.reference);
  if (!verify.ok || !payTodayStatusIndicatesPaid(verify.data)) {
    return { ok: false, error: "verification_failed", verify };
  }

  p.status = "paid";
  p.updatedAt = new Date().toISOString();
  p.paytodayVerify = verify.data || null;
  rows[idx] = p;
  savePayments(rows);

  const notifyRef = p.reference;
  if (!p.notifyDispatched) {
    try {
      await dispatchPaymentNotifications({
        customerPhone: p.buyerPhone || "",
        customerEmail: p.buyerEmail || "",
        invoiceText:
          p.invoiceText ||
          `Payment confirmed.\nReference: ${notifyRef}\nAmount: N$${Number(p.amountNad || 0).toLocaleString()}`,
        reference: notifyRef,
        subject: p.emailSubject || `Payment received — ${notifyRef}`,
        amountLabel: `N$${Number(p.amountNad || 0).toLocaleString()}`,
      });
      p.notifyDispatched = true;
      p.updatedAt = new Date().toISOString();
      rows[idx] = p;
      savePayments(rows);
    } catch (e) {
      console.error("finalizePayment notify:", e);
    }
  }

  return { ok: true, payment: p };
}

async function twilioPostMessage(params) {
  if (!TWILIO_SID || !TWILIO_TOKEN) return { sent: false, reason: "twilio_not_configured" };
  const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64");
  const form = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== "") form.append(k, String(v));
  });
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!r.ok) {
    const t = await r.text();
    return { sent: false, error: t || "twilio_http_error" };
  }
  return { sent: true };
}

/**
 * On confirmed payment: email (invoice body), optional Twilio SMS + WhatsApp.
 * phone: E.164 e.g. +26481123456
 */
async function dispatchPaymentNotifications({ customerPhone, customerEmail, invoiceText, reference, subject, amountLabel }) {
  const ref = String(reference || "").trim();
  const subj = subject || `Payment received — ${ref || "BLC"}`;
  const text = String(invoiceText || "");
  const amt = amountLabel ? ` ${amountLabel}` : "";
  const shortSms = `BLC Plant Hire: Payment${amt} received. Ref: ${ref}. Full invoice emailed. +264 81 603 4139`.slice(0, 1500);
  const results = { email: false, sms: null, whatsapp: null, whatsappOpenUrl: null };

  const toEmail = String(customerEmail || "")
    .trim()
    .toLowerCase();
  if (toEmail) {
    const html = `<pre style="font-family:ui-monospace,monospace;font-size:13px;white-space:pre-wrap">${text.replace(
      /&/g,
      "&amp;"
    )}</pre>`;
    try {
      await sendMail({ to: toEmail, subject: subj, text, html });
      results.email = true;
    } catch (e) {
      console.error("payment notify email:", e);
      results.emailError = e.message;
    }
  }

  const phone = String(customerPhone || "").replace(/\s/g, "");
  if (phone) {
    if (TWILIO_SMS_FROM) {
      const m = await twilioPostMessage({ To: phone, From: TWILIO_SMS_FROM, Body: shortSms });
      results.sms = m;
    } else {
      results.sms = { sent: false, reason: "TWILIO_SMS_FROM not set — configure Twilio or use app wa.me link" };
    }
    if (TWILIO_WA_FROM) {
      const toWa = phone.startsWith("+") ? `whatsapp:${phone}` : `whatsapp:${phone}`;
      const m = await twilioPostMessage({ To: toWa, From: TWILIO_WA_FROM, Body: shortSms });
      results.whatsapp = m;
    } else {
      const digits = phone.replace(/\D/g, "");
      if (digits)
        results.whatsappOpenUrl = `https://wa.me/${digits}?text=${encodeURIComponent(shortSms)}`;
    }
  }

  if (!toEmail && !phone) {
    return { ...results, error: "customerEmail or customerPhone required" };
  }
  return results;
}

// Protected: send a single email (used by the app for quotes, invoices, user reset)
app.post("/api/mail", requireApiKey, async (req, res) => {
  try {
    const { to, subject, text, html } = req.body || {};
    if (!to || !subject || !text) {
      return res.status(400).json({ ok: false, error: "to, subject, and text are required" });
    }
    await sendMail({ to, subject, text, html });
    res.json({ ok: true });
  } catch (e) {
    console.error("mail error:", e);
    res.status(500).json({ ok: false, error: e.message || "send_failed" });
  }
});

// Send same body to several recipients (e.g. buyer + owner)
app.post("/api/mail/bulk", requireApiKey, async (req, res) => {
  try {
    const { recipients, subject, text, html } = req.body || {};
    if (!Array.isArray(recipients) || !recipients.length || !subject || !text) {
      return res.status(400).json({ ok: false, error: "recipients[], subject, and text are required" });
    }
    const list = [...new Set(recipients.map((r) => String(r).trim().toLowerCase()).filter(Boolean))];
    for (const to of list) {
      await sendMail({ to, subject, text, html });
    }
    res.json({ ok: true, sent: list.length });
  } catch (e) {
    console.error("bulk mail error:", e);
    res.status(500).json({ ok: false, error: e.message || "send_failed" });
  }
});

// After gateway confirms payment: email + SMS + WhatsApp (Twilio optional), invoice in email body
app.post("/api/notify/payment", requireApiKey, async (req, res) => {
  try {
    const b = req.body || {};
    const { customerPhone, customerEmail, invoiceText, reference, subject, amountLabel } = b;
    if (!String(invoiceText || "").trim()) {
      return res.status(400).json({ ok: false, error: "invoiceText is required" });
    }
    const out = await dispatchPaymentNotifications({
      customerPhone,
      customerEmail,
      invoiceText,
      reference,
      subject,
      amountLabel,
    });
    if (out.error) return res.status(400).json({ ok: false, ...out });
    res.json({ ok: true, ...out });
  } catch (e) {
    console.error("notify payment:", e);
    res.status(500).json({ ok: false, error: e.message || "notify_failed" });
  }
});

// Webhook for payment provider (DPO, Paystack, etc.) — set PAYMENT_WEBHOOK_SECRET, send same fields as /api/notify/payment
app.post("/api/webhooks/payment", async (req, res) => {
  const k = "whpay:" + rateKey(req);
  if (!allowRate(k, 60, 3_600_000)) {
    return res.status(429).json({ ok: false, error: "rate_limited" });
  }
  if (PAYMENT_WEBHOOK_SECRET) {
    const h = String(req.get("X-Payment-Webhook-Secret") || req.get("X-Webhook-Secret") || "");
    if (h !== PAYMENT_WEBHOOK_SECRET) {
      return res.status(401).json({ ok: false, error: "invalid_webhook_secret" });
    }
  } else {
    return res.status(500).json({ ok: false, error: "PAYMENT_WEBHOOK_SECRET not configured on server" });
  }
  try {
    const b = req.body || {};
    const ref = String(b.reference || b.paymentReference || "").trim();
    if (!ref) return res.status(400).json({ ok: false, error: "reference required" });
    if (!rememberPaymentRef(`wh_${ref}`)) {
      return res.json({ ok: true, duplicate: true, reference: ref });
    }
    const out = await dispatchPaymentNotifications({
      customerPhone: b.customerPhone,
      customerEmail: b.customerEmail,
      invoiceText: b.invoiceText,
      reference: ref,
      subject: b.subject,
      amountLabel: b.amountLabel,
    });
    res.json({ ok: true, ...out });
  } catch (e) {
    console.error("webhook payment:", e);
    res.status(500).json({ ok: false, error: e.message || "webhook_failed" });
  }
});

// ── PayToday + payment ledger (see PayToday integration guide + txstatus JSON)
// ─────────────────────────────────────────────────────────────────────────────

app.post("/api/payments/register", requireApiKey, (req, res) => {
  try {
    if (!APP_BASE_URL) {
      return res.status(500).json({ ok: false, error: "APP_BASE_URL required for PayToday return URLs" });
    }
    if (!PAYTODAY_BUSINESS_ID || !PAYTODAY_BUSINESS_NAME) {
      return res.status(500).json({ ok: false, error: "paytoday_not_configured_set_PAYTODAY_BUSINESS_ID_and_NAME" });
    }
    const b = req.body || {};
    const kind = String(b.kind || "other");
    const entityId = String(b.entityId || "").trim();
    const amountNad = Number(b.amountNad);
    if (!entityId || !(amountNad > 0)) {
      return res.status(400).json({ ok: false, error: "entityId and positive amountNad required" });
    }
    const reference = String(b.reference || "").trim() || `BLC-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const rows = loadPayments();
    if (rows.some((r) => r.reference === reference)) {
      return res.status(400).json({ ok: false, error: "reference_already_used" });
    }
    const pay = {
      id: `pay_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
      reference,
      status: "pending_checkout",
      kind,
      entityId,
      amountNad,
      currency: "NAD",
      buyerEmail: String(b.buyerEmail || "").trim(),
      buyerPhone: String(b.buyerPhone || "").replace(/\s/g, ""),
      buyerFirstName: String(b.buyerFirstName || "").trim(),
      buyerLastName: String(b.buyerLastName || "").trim(),
      invoiceText: String(b.invoiceText || "").trim(),
      emailSubject: String(b.emailSubject || "").trim(),
      listingName: String(b.listingName || "").trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notifyDispatched: false,
      manualNote: "",
    };
    rows.push(pay);
    savePayments(rows);

    const token = crypto.randomBytes(24).toString("hex");
    checkoutSessions.set(token, { paymentId: pay.id, expiresAt: Date.now() + 28 * 60 * 1000 });

    const checkoutUrl = `${APP_BASE_URL}/api/payments/pt-checkout/${token}`;
    res.json({ ok: true, payment: pay, checkoutUrl, checkoutSessionToken: token });
  } catch (e) {
    console.error("payments register:", e);
    res.status(500).json({ ok: false, error: e.message || "register_failed" });
  }
});

app.get("/api/payments/pt-checkout/:token", (req, res) => {
  const sess = checkoutSessions.get(req.params.token);
  if (!sess || sess.expiresAt < Date.now()) {
    return res.status(410).type("html").send("<p>Checkout session expired. Start again from the app.</p>");
  }
  const rows = loadPayments();
  const pay = rows.find((x) => x.id === sess.paymentId);
  if (!pay || pay.status === "paid") {
    return res.status(404).type("html").send("<p>Payment not found or already completed.</p>");
  }
  if (!PAYTODAY_BUSINESS_ID || !PAYTODAY_BUSINESS_NAME) {
    return res.status(500).type("html").send("<p>PayToday not configured on server.</p>");
  }

  const returnUrl = `${APP_BASE_URL}/api/payments/pt-return?token=${encodeURIComponent(req.params.token)}`;
  const amtStr = (Number(pay.amountNad) * 100).toFixed(2);
  const refEsc = escHtml(pay.reference);
  const ptCfg = JSON.stringify({
    bizId: String(PAYTODAY_BUSINESS_ID),
    bizName: String(PAYTODAY_BUSINESS_NAME),
    amt: amtStr,
    reference: pay.reference,
    redirectURL: returnUrl,
  });

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Pay with PayToday</title></head><body style="font-family:system-ui,sans-serif;background:#140d04;color:#f0e5d0;padding:24px;text-align:center;">
<p style="color:#e8920c;font-weight:700;">BLC Plant Hire — PayToday</p>
<p style="font-size:14px;">Reference <strong>${refEsc}</strong><br/>Amount <strong>N$ ${Number(pay.amountNad).toLocaleString()}</strong></p>
<div id="pt-root" style="margin:24px auto;max-width:420px;"></div>
<script src="https://paytoday.com.na/js/pay-with-paytoday.js"></script>
<script>
(function(){
  var cfg = ${ptCfg};
  function go(){
    try {
      if (typeof window.createButton !== "function") {
        document.getElementById("pt-root").innerHTML = "<p style=color:#f66>PayToday script failed to load.</p>";
        return;
      }
      window.createButton(cfg.bizId, cfg.bizName, cfg.amt, cfg.redirectURL, cfg.reference);
    } catch(e) {
      document.getElementById("pt-root").innerHTML = "<p style=color:#f66>Error: "+String(e.message)+"</p>";
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
})();
</script>
<p style="font-size:12px;color:#888;margin-top:32px;">Secured by PayToday Namibia. After paying you will return here for verification.</p>
</body></html>`;
  res.type("html").send(html);
});

function paytodayReturnHtmlPage({ title, bodyText, refShow, bridgeRef, bridgeStatus, redirectWebAfterPay }) {
  const bridgePayload = JSON.stringify({ ref: bridgeRef || "", status: bridgeStatus || "" });
  const redirectSnippet =
    redirectWebAfterPay && CLIENT_APP_URL
      ? `
  setTimeout(function(){
    try {
      if (typeof BLCAndroid === "undefined") {
        var base = ${JSON.stringify(CLIENT_APP_URL)};
        var refEnc = ${JSON.stringify(String(bridgeRef || refShow || ""))};
        if (refEnc) window.location.href = base + "#paySync=" + encodeURIComponent(refEnc);
      }
    } catch(e) {}
  }, 900);
`
      : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escHtml(title)}</title></head><body style="font-family:system-ui,sans-serif;background:#140d04;color:#f0e5d0;padding:24px;text-align:center;">
<h2 style="color:#e8920c;">${escHtml(title)}</h2>
<p style="max-width:520px;margin:12px auto;line-height:1.5;">${escHtml(bodyText)}</p>
${refShow ? `<p style="font-size:13px;color:#aaa;">Reference: <strong>${escHtml(refShow)}</strong></p>` : ""}
<script>
(function(){
  var p = ${bridgePayload};
  try {
    if (typeof BLCAndroid !== "undefined" && BLCAndroid.onPaymentComplete && p.ref) {
      BLCAndroid.onPaymentComplete(p.ref, p.status || "");
    }
  } catch(e) {}
})();
${redirectSnippet}
</script>
<p style="margin-top:24px;font-size:12px;color:#888;">You can close this screen and return to the BLC app.</p>
</body></html>`;
}

app.get("/api/payments/pt-return", async (req, res) => {
  const token = String(req.query.token || "");
  const status = String(req.query.status || "").toLowerCase();
  const ref = String(req.query.ref || req.query.reference || "").trim();
  const sess = checkoutSessions.get(token);

  try {
    if (!sess) {
      return res
        .status(410)
        .type("html")
        .send(
          paytodayReturnHtmlPage({
            title: "Session expired",
            bodyText: "This checkout link expired. Open the app and start payment again.",
            refShow: ref || "",
            bridgeRef: ref || "",
            bridgeStatus: status || "unknown",
            redirectWebAfterPay: false,
          })
        );
    }
    const rows = loadPayments();
    const pay = rows.find((x) => x.id === sess.paymentId);
    const useRef = ref || (pay && pay.reference) || "";

    if (status === "failed" || status === "cancelled" || status === "error") {
      if (pay) {
        pay.status = "failed";
        pay.updatedAt = new Date().toISOString();
        savePayments(rows);
      }
      checkoutSessions.delete(token);
      return res.status(200).type("html").send(
        paytodayReturnHtmlPage({
          title: "Payment not completed",
          bodyText: "PayToday reported this payment did not complete. You can try again from the app.",
          refShow: useRef,
          bridgeRef: useRef,
          bridgeStatus: status,
          redirectWebAfterPay: false,
        })
      );
    }

    if (!pay) {
      checkoutSessions.delete(token);
      return res.status(404).type("html").send(
        paytodayReturnHtmlPage({
          title: "Not found",
          bodyText: "Payment record missing.",
          refShow: useRef,
          bridgeRef: useRef,
          bridgeStatus: status,
          redirectWebAfterPay: false,
        })
      );
    }

    const fin = await finalizePaymentRecordPaid(pay);
    checkoutSessions.delete(token);

    if (!fin.ok) {
      return res.status(200).type("html").send(
        paytodayReturnHtmlPage({
          title: "Verifying payment",
          bodyText:
            "We could not confirm this payment with PayToday automatically. Ask BLC admin to verify manually in PayToday / bank.",
          refShow: useRef,
          bridgeRef: useRef,
          bridgeStatus: status || "pending_verify",
          redirectWebAfterPay: false,
        })
      );
    }

    return res.status(200).type("html").send(
      paytodayReturnHtmlPage({
        title: "Payment recorded",
        bodyText:
          "Thank you. Your payment has been recorded and notifications will be sent when mail/SMS is configured.",
        refShow: pay.reference,
        bridgeRef: pay.reference,
        bridgeStatus: "paid",
        redirectWebAfterPay: true,
      })
    );
  } catch (e) {
    console.error("pt-return:", e);
    res.status(500).type("html").send(
      paytodayReturnHtmlPage({
        title: "Error",
        bodyText: String(e.message || e),
        refShow: ref,
        bridgeRef: ref,
        bridgeStatus: "error",
        redirectWebAfterPay: false,
      })
    );
  }
});

app.get("/api/payments/status/:reference", requireApiKey, (req, res) => {
  const reference = String(req.params.reference || "").trim();
  const rows = loadPayments();
  const pay = rows.find((x) => x.reference === reference);
  if (!pay) return res.status(404).json({ ok: false, error: "not_found" });
  const { paytodayVerify, ...safe } = pay;
  res.json({ ok: true, payment: safe, mergeHints: paymentMergeHints(pay) });
});

/** Poll PayToday and upgrade pending_checkout → paid when gateway shows success (WebView / browser fallback). */
app.post("/api/payments/sync/:reference", requireApiKey, async (req, res) => {
  const reference = String(req.params.reference || "").trim();
  const rows = loadPayments();
  const pay = rows.find((x) => x.reference === reference);
  if (!pay) return res.status(404).json({ ok: false, error: "not_found" });
  if (pay.status === "paid") return res.json({ ok: true, payment: pay, already: true, mergeHints: paymentMergeHints(pay) });
  const fin = await finalizePaymentRecordPaid(pay);
  if (!fin.ok) return res.status(200).json({ ok: false, payment: pay, verify: fin.verify || fin.error });
  res.json({ ok: true, payment: fin.payment, mergeHints: paymentMergeHints(fin.payment) });
});

app.post("/api/admin/payments/manual", requireApiKey, requireAdminPassword, (req, res) => {
  try {
    const b = req.body || {};
    const kind = String(b.kind || "other");
    const entityId = String(b.entityId || "").trim();
    const amountNad = Number(b.amountNad);
    if (!entityId || !(amountNad > 0)) {
      return res.status(400).json({ ok: false, error: "entityId and positive amountNad required" });
    }
    const reference = String(b.reference || "").trim() || `BLC-MAN-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
    const rows = loadPayments();
    const pay = {
      id: `pay_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
      reference,
      status: "manual_pending",
      kind,
      entityId,
      amountNad,
      currency: "NAD",
      buyerEmail: String(b.buyerEmail || "").trim(),
      buyerPhone: String(b.buyerPhone || "").replace(/\s/g, ""),
      buyerFirstName: String(b.buyerFirstName || "").trim(),
      buyerLastName: String(b.buyerLastName || "").trim(),
      invoiceText: String(b.invoiceText || "").trim(),
      emailSubject: String(b.emailSubject || "").trim(),
      listingName: String(b.listingName || "").trim(),
      manualNote: String(b.manualNote || "").trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notifyDispatched: false,
    };
    rows.push(pay);
    savePayments(rows);
    res.json({ ok: true, payment: pay });
  } catch (e) {
    console.error("manual payment:", e);
    res.status(500).json({ ok: false, error: e.message || "failed" });
  }
});

app.get("/api/admin/payments", requireApiKey, requireAdminPassword, (req, res) => {
  const rows = loadPayments().slice().reverse();
  res.json({ ok: true, payments: rows });
});

app.post("/api/admin/payments/:id/confirm-manual", requireApiKey, requireAdminPassword, async (req, res) => {
  try {
    const rows = loadPayments();
    const idx = rows.findIndex((x) => x.id === req.params.id);
    if (idx < 0) return res.status(404).json({ ok: false, error: "not_found" });
    const p = rows[idx];
    if (p.status !== "manual_pending") {
      return res.status(400).json({ ok: false, error: "not_manual_pending", status: p.status });
    }
    p.status = "paid";
    p.manualConfirmedAt = new Date().toISOString();
    p.updatedAt = p.manualConfirmedAt;
    rows[idx] = p;
    savePayments(rows);

    if (!p.notifyDispatched) {
      try {
        await dispatchPaymentNotifications({
          customerPhone: p.buyerPhone || "",
          customerEmail: p.buyerEmail || "",
          invoiceText:
            p.invoiceText ||
            `Manual payment confirmed by BLC.\nReference: ${p.reference}\nAmount: N$${Number(p.amountNad || 0).toLocaleString()}`,
          reference: p.reference,
          subject: p.emailSubject || `Payment received — ${p.reference}`,
          amountLabel: `N$${Number(p.amountNad || 0).toLocaleString()}`,
        });
        p.notifyDispatched = true;
        p.updatedAt = new Date().toISOString();
        rows[idx] = p;
        savePayments(rows);
      } catch (e) {
        console.error("manual confirm notify:", e);
      }
    }

    const mergeHints =
      p.kind === "sale_bid"
        ? { kind: "sale_bid", entityId: p.entityId, serviceAccessActive: true }
        : p.kind === "hire_booking"
          ? { kind: "hire_booking", entityId: p.entityId, serviceAccessActive: true }
          : { kind: p.kind, entityId: p.entityId };

    res.json({ ok: true, payment: p, mergeHints });
  } catch (e) {
    console.error("confirm-manual:", e);
    res.status(500).json({ ok: false, error: e.message || "failed" });
  }
});

// Admin login: compare password to env or file-backed (no API key so the staff UI stays simple; rate-limited)
app.post("/api/admin/verify", (req, res) => {
  const k = "verify:" + rateKey(req);
  if (!allowRate(k, 30, 900_000)) {
    return res.status(429).json({ ok: false, error: "rate_limited" });
  }
  const pwd = (req.body && req.body.password) || "";
  const current = getAdminPassword();
  if (!current) {
    return res.status(500).json({ ok: false, error: "admin_password_not_configured" });
  }
  if (pwd === current) {
    RATE.delete(k);
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false, error: "invalid_password" });
});

// Request new admin password by email (must match ADMIN_EMAIL in .env)
app.post("/api/admin/request-password-reset", async (req, res) => {
  const k = "admrst:" + rateKey(req);
  if (!allowRate(k, 5, 3_600_000)) {
    return res.status(429).json({ ok: false, error: "rate_limited" });
  }
  const email = String((req.body && req.body.email) || "").trim().toLowerCase();
  if (!ADMIN_EMAIL) {
    return res.status(500).json({ ok: false, error: "admin_email_not_configured" });
  }
  if (email !== ADMIN_EMAIL) {
    // Do not reveal whether the email is registered
    return res.json({ ok: true, message: "If the email is registered, a new password was sent." });
  }
  const newPassword = "BLC" + Math.random().toString(36).slice(2, 8) + "!" + Math.floor(Math.random() * 1000);
  setAdminPassword(newPassword);
  const subject = "BLC Plant Hire — new admin password";
  const text = `Your BLC Plant Hire admin password has been reset.

New password: ${newPassword}

Log in to the app with this password. Change it by requesting another reset if needed.

${APP_BASE_URL ? `App: ${APP_BASE_URL}\n` : ""}If you did not request this, contact support immediately.`;
  try {
    await sendMail({ to: ADMIN_EMAIL, subject, text });
  } catch (e) {
    console.error("admin reset mail:", e);
    return res.status(500).json({ ok: false, error: e.message || "email_failed" });
  }
  return res.json({ ok: true, message: "A new admin password was sent to your email." });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: "server_error" });
});

app.listen(PORT, () => {
  console.log(`BLC backend listening on http://localhost:${PORT}`);
  if (!process.env.SMTP_HOST) console.warn("Warning: SMTP_HOST is not set — mail will fail until configured.");
  if (!API_KEY) console.warn("Warning: API_KEY is empty — mail/admin routes are open (set API_KEY in production).");
});
