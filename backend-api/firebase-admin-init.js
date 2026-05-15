/**
 * Optional Firebase Admin SDK — use only for features that need server-side Firebase
 * (verify ID tokens, Firestore admin writes, FCM send, etc.). Mail / PayToday / Twilio
 * routes stay independent; each route decides whether to call getFirebaseAdmin().
 */
const fs = require("fs");
const path = require("path");

let _admin = null;
let _tried = false;
let _disabledReason = "";

/**
 * @returns {import("firebase-admin") | null}
 */
function getFirebaseAdmin() {
  if (_tried) return _admin;
  _tried = true;

  const jsonPathRaw = (process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "").trim();
  const gac = (process.env.GOOGLE_APPLICATION_CREDENTIALS || "").trim();
  const resolved =
    jsonPathRaw.length > 0
      ? path.isAbsolute(jsonPathRaw)
        ? jsonPathRaw
        : path.join(__dirname, jsonPathRaw)
      : gac.length > 0
        ? gac
        : "";

  if (!resolved) {
    _disabledReason = "no_credentials_path";
    return null;
  }
  if (!fs.existsSync(resolved)) {
    _disabledReason = "credentials_file_missing";
    console.warn("[firebase-admin] file not found:", resolved);
    return null;
  }

  try {
    const admin = require("firebase-admin");
    const key = JSON.parse(fs.readFileSync(resolved, "utf8"));
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(key),
      });
    }
    _admin = admin;
    return _admin;
  } catch (e) {
    _disabledReason = "init_failed";
    console.warn("[firebase-admin] init failed:", e.message);
    return null;
  }
}

function isFirebaseAdminAvailable() {
  return getFirebaseAdmin() != null;
}

/** For /api/health — why Admin is off (no secrets). */
function firebaseAdminStatus() {
  if (isFirebaseAdminAvailable()) return { enabled: true };
  return { enabled: false, reason: _disabledReason || "uninitialized" };
}

/**
 * Call at the start of a route that *requires* Admin. Respond with 503 if not configured.
 * @param {import("express").Request} _req
 * @param {import("express").Response} res
 * @returns {import("firebase-admin") | null}
 */
function requireFirebaseAdminOr503(res) {
  const admin = getFirebaseAdmin();
  if (!admin) {
    res.status(503).json({
      ok: false,
      error: "firebase_admin_not_configured",
      hint: "Set FIREBASE_SERVICE_ACCOUNT_PATH or GOOGLE_APPLICATION_CREDENTIALS to a service account JSON file.",
    });
    return null;
  }
  return admin;
}

module.exports = {
  getFirebaseAdmin,
  isFirebaseAdminAvailable,
  firebaseAdminStatus,
  requireFirebaseAdminOr503,
};
