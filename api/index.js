// Vercel serverless function handler
// Express app'i direkt oluştur (circular dependency'yi önlemek için)
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// CORS middleware - Vercel için özel (EN ÜSTTE)
app.use((req, res, next) => {
  const origin = req.headers.origin || req.headers.Origin;
  
  // TÜM origin'lere izin ver (production için)
  // Özellikle xdrive-fe.vercel.app için
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  // OPTIONS isteği için hemen yanıt ver
  if (req.method === 'OPTIONS') {
    console.log('✅ OPTIONS preflight - CORS headers set for origin:', origin);
    return res.status(200).end();
  }
  
  console.log(`✅ Request: ${req.method} ${req.url} from origin: ${origin || 'no origin'}`);
  next();
});

// Express middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug: Tüm gelen istekleri logla (EN ÜSTTE - route'lardan önce)
app.use((req, res, next) => {
  console.log(`🔍 Incoming request: ${req.method} ${req.url}`, {
    path: req.path,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    url: req.url
  });
  next();
});

// Root path handler (test için)
app.get('/', (req, res) => {
  res.json({ 
    message: 'Backend API çalışıyor', 
    timestamp: new Date().toISOString(),
    path: req.path,
    url: req.url
  });
});

// Routes - Vercel'de /api/* path'i zaten rewrite edilmiş
// Ama Express route'ları /api/cars olarak tanımlı, bu yüzden path'i koruyoruz
app.use('/api/cars', require('../routes/cars'));
app.use('/api/reservations', require('../routes/reservations'));
app.use('/api/auth', require('../routes/auth'));

// 404 handler - tüm route'lardan sonra
app.use((req, res) => {
  console.error(`❌ 404 - Route bulunamadı: ${req.method} ${req.url}`);
  res.status(404).json({ 
    error: 'Route bulunamadı',
    method: req.method,
    url: req.url,
    path: req.path,
    originalUrl: req.originalUrl
  });
});

// Chrome DevTools .well-known isteğini sessizce yok say
app.get('/.well-known/*', (req, res) => {
  res.status(404).end();
});

// MongoDB Connection (Opsiyonel)
if (process.env.MONGODB_URI && process.env.MONGODB_URI !== '') {
  mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('MongoDB bağlantısı başarılı'))
  .catch(err => {
    console.warn('MongoDB bağlantı hatası (opsiyonel, devam ediliyor):', err.message);
  });
}

// Vercel serverless function handler
module.exports = app;

