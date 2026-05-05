/**
 * BLC Plant Hire — lightweight mail + admin API (SMTP via Nodemailer)
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

const PORT = parseInt(process.env.PORT || "8787", 10);
const API_KEY = (process.env.API_KEY || "").trim();
const APP_BASE_URL = (process.env.APP_BASE_URL || "").replace(/\/$/, "");
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const DATA_DIR = path.join(__dirname, "data");
const ADMIN_FILE = path.join(DATA_DIR, "admin-password.json");
const TWILIO_SID = (process.env.TWILIO_ACCOUNT_SID || "").trim();
const TWILIO_TOKEN = (process.env.TWILIO_AUTH_TOKEN || "").trim();
const TWILIO_SMS_FROM = (process.env.TWILIO_SMS_FROM || "").trim();
const TWILIO_WA_FROM = (process.env.TWILIO_WHATSAPP_FROM || "").trim();
const PAYMENT_WEBHOOK_SECRET = (process.env.PAYMENT_WEBHOOK_SECRET || "").trim();

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
  res.json({
    ok: true,
    service: "blc-plant-hire-api",
    hasSmtp: !!(process.env.SMTP_HOST && (process.env.SMTP_USER || process.env.SMTP_FROM)),
    hasApiKey: !!API_KEY,
    hasTwilio: !!(TWILIO_SID && TWILIO_TOKEN),
    hasPaymentWebhook: !!PAYMENT_WEBHOOK_SECRET,
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
