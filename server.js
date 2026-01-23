const express = require('express');

const cors = require('cors');
require('dotenv').config({ path: ['.env.local', '.env'] });

const app = express();
const isProd = process.env.NODE_ENV === 'production';

// CORS ayarları - Vercel ve localhost için
// Vercel'de çalışıyorsa tüm origin'lere izin ver (güvenlik için production'da sınırlandırılabilir)
const corsOptions = {
  origin: function (origin, callback) {
    // TEMPORARY DEBUG: Allow all
    console.log('DEBUG: allowing origin', origin);
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 86400 // 24 saat
};

// CORS middleware
app.use(cors(corsOptions));

// Express middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes - Logging ile
app.use('/api/cars', (req, res, next) => {
  if (!isProd) {
    console.log(`🔍 Route: /api/cars${req.path}`);
  }
  next();
}, require('./routes/cars'));

app.use('/api/reservations', (req, res, next) => {
  if (!isProd) {
    console.log(`🔍 Route: /api/reservations${req.path}`);
  }
  next();
}, require('./routes/reservations'));

app.use('/api/auth', (req, res, next) => {
  if (!isProd) {
    console.log(`🔍 Route: /api/auth${req.path}`);
  }
  next();
}, require('./routes/auth'));

app.use('/api/images', (req, res, next) => {
  if (!isProd) {
    console.log(`🔍 Route: /api/images${req.path}`, req.query);
  }
  next();
}, require('./routes/images'));

app.use('/api/payments', (req, res, next) => {
  if (!isProd) {
    console.log(`🔍 Route: /api/payments${req.path}`);
  }
  next();
}, require('./routes/payments'));

app.use('/api/contact', (req, res, next) => {
  if (!isProd) {
    console.log(`🔍 Route: /api/contact${req.path}`);
  }
  next();
}, require('./routes/contact'));

// Chrome DevTools .well-known isteğini sessizce yok say
app.get('/.well-known/*', (req, res) => {
  res.status(404).end();
});

// 404 handler - tüm route'lar kontrol edildikten sonra
app.use((req, res, next) => {
  if (!isProd) {
    console.log(`❌ 404 - Route bulunamadı: ${req.method} ${req.originalUrl}`);
  }
  res.status(404).json({
    error: 'Route bulunamadı',
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl
  });
});

const PORT = process.env.PORT || 5001;

// Vercel'de serverless function olarak çalışıyorsa listen etme
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`Server ${PORT} portunda çalışıyor`);
  });
}

// Vercel serverless function export
module.exports = app;

