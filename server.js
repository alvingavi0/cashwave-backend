require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Serve frontend static files so you can open http://localhost:5000/wallet.html
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Mount API routes (each module exports an Express handler)
const apiRouter = express.Router();
apiRouter.post('/stkpush', require('./api/stkpush'));
apiRouter.post('/callback', require('./api/callback'));
apiRouter.get('/balance', require('./api/balance'));
apiRouter.get('/transactions', require('./api/transactions'));
apiRouter.post('/withdraw', require('./api/withdraw'));
apiRouter.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api', apiRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

app.listen(PORT, () => {
  console.log(`\n✓ CashWave Backend Server`);
  console.log(`  Environment: ${NODE_ENV}`);
  console.log(`  Port: ${PORT}`);
  console.log(`  URL: http://localhost:${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/health\n`);
});
