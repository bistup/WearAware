const admin = require('firebase-admin');

let initialized = false;
const DEFAULT_FIREBASE_PROJECT_ID = 'wearaware-c2a46';

function ensureFirebaseAdmin() {
  if (initialized) return;

  if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || DEFAULT_FIREBASE_PROJECT_ID;
    admin.initializeApp(projectId ? { projectId } : {});
  }

  initialized = true;
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== 'string') return null;
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim();
}

async function optionalFirebaseAuth(req, res, next) {
  const token = getBearerToken(req);
  if (!token) {
    req.authUid = null;
    return next();
  }

  try {
    ensureFirebaseAdmin();
    const decoded = await admin.auth().verifyIdToken(token);
    req.authUid = decoded.uid;
    req.auth = decoded;
    return next();
  } catch (error) {
    console.error('Firebase token verification failed:', error?.message || error);
    return res.status(401).json({ success: false, error: 'Invalid or expired auth token' });
  }
}

async function requireFirebaseAuth(req, res, next) {
  await optionalFirebaseAuth(req, res, async () => {
    if (!req.authUid) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    return next();
  });
}

function rejectUidWithoutAuth(req, res, next) {
  const bodyUid = req.body && typeof req.body.firebaseUid === 'string' ? req.body.firebaseUid.trim() : '';
  const queryUid = req.query && typeof req.query.firebaseUid === 'string' ? req.query.firebaseUid.trim() : '';
  const viewerUid = req.query && typeof req.query.viewerUid === 'string' ? req.query.viewerUid.trim() : '';

  if (!req.authUid && (bodyUid || queryUid || viewerUid)) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  return next();
}

function bindAuthUid(req, _res, next) {
  if (!req.authUid) return next();

  if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'firebaseUid')) {
    req.body.firebaseUid = req.authUid;
  }
  if (req.query && Object.prototype.hasOwnProperty.call(req.query, 'firebaseUid')) {
    req.query.firebaseUid = req.authUid;
  }
  if (req.query && Object.prototype.hasOwnProperty.call(req.query, 'viewerUid')) {
    req.query.viewerUid = req.authUid;
  }

  return next();
}

module.exports = {
  optionalFirebaseAuth,
  requireFirebaseAuth,
  rejectUidWithoutAuth,
  bindAuthUid,
};
