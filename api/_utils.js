const admin = require('firebase-admin');
const axios = require('axios');

// Initialize Firebase Admin
if (!admin.apps.length) {
  let projectId = process.env.FIREBASE_PROJECT_ID;
  let clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  // Handle various private key formats
  if (privateKey) {
    if ((privateKey.startsWith('"') && privateKey.endsWith('"')) ||
        (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  if (!projectId || !clientEmail || !privateKey) {
    console.error('WARNING: Firebase admin credentials not fully set. Some API calls will fail without them.');
  } else {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey })
      });
      console.log('✓ Firebase Admin initialized');
    } catch (err) {
      console.error('Failed initializing Firebase Admin:', err.message);
    }
  }
}

const intasendClient = axios.create({
  baseURL: process.env.INTASEND_API_URL || 'https://api.intasend.com/api/v1',
  headers: {
    Authorization: `Bearer ${process.env.INTASEND_SECRET_KEY || ''}`,
    'Content-Type': 'application/json'
  },
  timeout: 15000
});

async function verifyFirebaseIdToken(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  const match = ('' + authHeader).match(/^Bearer (.*)$/);
  if (!match) {
    res.status(401).json({ error: 'Missing Authorization header' });
    return;
  }
  const idToken = match[1];
  if (!admin.apps.length) {
    res.status(500).json({ error: 'Firebase Admin not initialized on server' });
    return;
  }
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.uid = decoded.uid;
    req.auth = decoded;
    next();
  } catch (err) {
    console.error('verifyIdToken error', err.message || err);
    res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = {
  admin,
  intasendClient,
  verifyFirebaseIdToken
};
