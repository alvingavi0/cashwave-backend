# CashWave Backend (Fresh)

This is a minimal fresh scaffold for the CashWave backend. It provides:

- `server.js` — minimal Express server with `/health` and `/api/health` endpoints.
- `package.json` — dependencies and start scripts.

Next steps:

1. Update `package.json` dependencies or add endpoints under `api/`.
2. Recreate any environment variables in a new `.env` file.
3. Run locally:

```pwsh
cd backend
npm install
npm start
```
# CashWave Backend - IntaSend Live Payment Integration

A complete backend system for a payment wallet with real-money transactions through IntaSend API.

## 🚀 Features

✅ **Real-time Payments** - Process live money transactions  
✅ **Wallet System** - Users can deposit and withdraw money  
✅ **Transaction History** - Complete real-time transaction tracking  
✅ **Balance Management** - Instant wallet balance updates  
✅ **Webhooks** - Automatic payment status updates via IntaSend callbacks  
✅ **Firebase Integration** - Secure user authentication and data storage  
✅ **Error Handling** - Robust error handling and logging  

## 📋 Architecture

```
┌─────────────┐
│   Frontend  │ (Not modified - use existing)
└──────┬──────┘
       │ API Calls
       ↓
┌─────────────────────────────────────┐
│    CashWave Backend (Node.js)       │
├─────────────────────────────────────┤
│ POST /api/stkpush         → Deposit  │
│ POST /api/withdraw        → Withdraw │
│ GET  /api/balance         → Balance  │
│ GET  /api/transactions    → History  │
│ POST /api/callback        → Webhook  │
└──────┬──────────────────┬──────┬────┘
       │                  │      │
       ↓                  ↓      ↓
    Firebase          IntaSend   (Callbacks)
    (Data Store)      (Payments)
```

## 🛠️ Tech Stack

- **Node.js 22.x** - Runtime
- **Express.js** - Web framework
- **Firebase Admin SDK** - User auth & Firestore database
- **Axios** - HTTP client for IntaSend API
- **CORS** - Cross-origin requests
- **Dotenv** - Environment configuration

## 📦 Installation

### Prerequisites
- Node.js 22.x installed
- IntaSend account with live credentials
- Firebase project set up
- Git (for cloning)

### Step 1: Clone & Navigate
```bash
git clone <your-repo>
cd backend
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Environment
Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

Edit `.env` with:
- IntaSend API keys (live mode)
- Firebase credentials
- Server settings

For detailed setup, see [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)

### Step 4: Start Server
```bash
npm start
```

Server will run on `http://localhost:5000`

## 🔌 API Endpoints

### Authentication
All endpoints (except `/health` and `/api/callback`) require Firebase ID token:
```
Authorization: Bearer {firebase_id_token}
```

### Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/health` | Health check |
| `POST` | `/api/stkpush` | Initiate payment |
| `POST` | `/api/callback` | Payment webhook (IntaSend) |
| `GET` | `/api/balance` | Get wallet balance |
| `GET` | `/api/transactions` | Get transaction history |
| `POST` | `/api/withdraw` | Withdraw from wallet |

### Example: Get Balance
```bash
curl -X GET http://localhost:5000/api/balance \
  -H "Authorization: Bearer YOUR_FIREBASE_ID_TOKEN"
```

**Response:**
```json
{
  "ok": true,
  "walletBalance": 1500.50,
  "uid": "user_id"
}
```

See [TESTING_GUIDE.md](./TESTING_GUIDE.md) for complete examples with curl, Postman, etc.

## 🔄 Payment Flow

### Deposit (User adds money to wallet)
```
1. User enters phone & amount → Frontend
2. Frontend calls POST /api/stkpush with Firebase token
3. Backend creates transaction (status: pending)
4. IntaSend API receives payment request
5. STK push sent to user's phone
6. User enters M-Pesa PIN
7. IntaSend processes payment
8. IntaSend sends callback to backend
9. Backend updates transaction (status: success)
10. Wallet balance updated in Firestore
11. Frontend detects balance change
```

### Withdrawal (User takes money from wallet)
```
1. User enters phone & amount → Frontend
2. Frontend calls POST /api/withdraw with Firebase token
3. Backend checks balance sufficiency
4. Wallet balance debited immediately
5. Withdrawal transaction created (status: pending)
6. IntaSend API receives payout request
7. IntaSend processes payout
8. IntaSend sends callback to backend
9. Backend updates transaction status
10. If failed, balance can be reversed
11. Frontend detects balance change
```

## 🗂️ File Structure

```
backend/
├── api/
│   ├── _utils.js          # Firebase & IntaSend setup
│   ├── stkpush.js         # Payment/deposit endpoint
│   ├── callback.js        # Payment webhook handler
│   ├── balance.js         # Wallet balance endpoint
│   ├── transactions.js    # Transaction history endpoint
│   └── withdraw.js        # Withdrawal endpoint
├── server.js              # Express server setup
├── package.json           # Dependencies
├── .env.example           # Environment template
├── INTEGRATION_GUIDE.md   # Detailed setup guide
└── TESTING_GUIDE.md       # Testing & curl examples
```

## 🔐 Security

### Firebase Security Rules
```javascript
match /users/{userId} {
  allow read, write: if request.auth.uid == userId;
}
match /transactions/{txId} {
  allow read: if request.auth.uid == resource.data.uid;
  allow create: if request.auth.uid != null;
  allow write: if request.auth == null; // Callbacks only
}
```

### API Security
- ✅ Firebase token verification on all endpoints
- ✅ User can only access own data
- ✅ Environment variables (no hardcoded secrets)
- ✅ HTTPS recommended in production
- ✅ CORS configured

## 🧪 Testing

### Quick Test
```bash
# Health check
curl http://localhost:5000/health

# Get balance (requires auth token)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/balance
```

### Full Testing Guide
See [TESTING_GUIDE.md](./TESTING_GUIDE.md) for:
- Complete curl examples
- Postman collection setup
- Full payment flow testing
- Debugging tips

## 📊 Database Schema

### Firestore Collections

**users/**
```json
{
  "walletBalance": 1500.50,
  "lastTransactionAt": "2025-12-06T10:30:00Z"
}
```

**transactions/**
```json
{
  "uid": "firebase_user_id",
  "phone": "254712345678",
  "amount": 100,
  "type": "deposit|withdraw",
  "status": "pending|success|failed",
  "intasendRequestId": "intasend_id",
  "intasendTransactionId": "intasend_txn_id",
  "intasendResponse": {},
  "callbackPayload": {},
  "error": "error message if failed",
  "createdAt": "2025-12-06T10:00:00Z",
  "updatedAt": "2025-12-06T10:05:00Z"
}
```

## 🚀 Deployment

### Firebase Cloud Functions
```bash
firebase deploy --only functions
```

### Traditional Hosting (Heroku, AWS, etc.)
```bash
npm install
npm start
```

Set environment variables on your hosting platform.

## 📝 Environment Variables

```env
# IntaSend (Live Mode)
INTASEND_PUBLIC_KEY=xxx
INTASEND_SECRET_KEY=xxx
INTASEND_API_URL=https://api.intasend.com/api/v1

# Firebase
FIREBASE_PROJECT_ID=xxx
FIREBASE_CLIENT_EMAIL=xxx
FIREBASE_PRIVATE_KEY=xxx

# Server
PORT=5000
NODE_ENV=production
INTASEND_CALLBACK_URL=https://yourdomain.com/api/callback
API_URL=https://yourdomain.com
```

## 🐛 Troubleshooting

### Payment not going through
- Check IntaSend is in LIVE mode (not test)
- Verify phone number format: `254712345678`
- Check `.env` has correct API keys

### Balance not updating
- Verify callback URL is accessible
- Check Firestore security rules
- Look at server logs for errors

### "Unauthorized" errors
- Ensure Firebase ID token is valid
- Check token not expired (re-authenticate)
- Verify user is authenticated in frontend

See [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) for more troubleshooting.

## 📚 Documentation

- [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) - Complete setup & integration guide
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Testing guide with examples
- [IntaSend Docs](https://intasend.com/api-docs) - IntaSend API documentation
- [Firebase Docs](https://firebase.google.com/docs) - Firebase documentation

## 🤝 Support

For issues:
1. Check [TESTING_GUIDE.md](./TESTING_GUIDE.md) troubleshooting section
2. Review server logs
3. Check IntaSend dashboard for transaction logs
4. Contact IntaSend support: https://intasend.com

## 📄 License

MIT License - See LICENSE file

---

**Ready to go?** Start with [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) for step-by-step setup!
