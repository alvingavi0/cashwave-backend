// api/_utils.js
const admin = require('firebase-admin');

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (privateKey && privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  if (!projectId || !clientEmail || !privateKey) {
    console.warn('WARNING: Firebase admin credentials missing. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in env.');
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey
    }),
    databaseURL: `https://${projectId}.firebaseio.com`
  });
}

const db = admin.firestore();

// Middleware style verify token - used inside functions
async function verifyFirebaseIdToken(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  const match = ('' + authHeader).match(/^Bearer (.*)$/);
  if (!match) {
    res.status(401).json({ error: 'Missing Authorization header' });
    return;
  }
  const idToken = match[1];
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.uid = decoded.uid;
    req.auth = decoded;
    next();
  } catch (err) {
    console.error('verifyIdToken error', err);
    res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = {
  admin,
  db,
  verifyFirebaseIdToken
};
