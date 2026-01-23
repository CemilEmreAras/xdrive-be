// Vercel serverless function handler
// Express app'i direkt oluştur (circular dependency'yi önlemek için)
const express = require('express');
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
  const originalUrl = req.url;
  const originalPath = req.path;

  console.log(`🔍 Incoming request: ${req.method} ${req.url}`, {
    path: req.path,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    url: req.url,
    headers: {
      host: req.headers.host,
      'x-forwarded-for': req.headers['x-forwarded-for'],
      'x-vercel-id': req.headers['x-vercel-id']
    }
  });

  // Vercel'de rewrite sonrası path genellikle /api/cars gibi gelir
  // Ama bazen sadece /cars olarak gelebilir (rewrite pattern'e bağlı)
  // Her iki durumu da handle etmek için hem /api/cars hem de /cars route'larını tanımlıyoruz
  // Ayrıca path'i normalize ediyoruz

  // Eğer path /api ile başlamıyorsa ve / ile başlıyorsa, /api ekle
  // Ancak root path '/' için bunu yapma, health check ve testler için 200 dönsün
  if (req.url && req.url !== '/' && !req.url.startsWith('/api') && req.url.startsWith('/')) {
    console.log(`⚠️ Path /api olmadan geldi, normalize ediliyor: ${req.url} -> /api${req.url}`);
    req.url = '/api' + req.url;
    if (req.originalUrl && !req.originalUrl.startsWith('/api')) {
      req.originalUrl = '/api' + req.originalUrl;
    }
  }

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

// Vercel'de /api/* path'i rewrite edilmiş ve /api/index.js'e yönlendiriliyor
// Vercel rewrite sonrası path'i korur, yani /api/cars isteği geldiğinde
// req.url hala /api/cars olur, bu yüzden route'ları /api ile başlatıyoruz
app.use('/api/cars', require('../routes/cars'));
app.use('/api/reservations', require('../routes/reservations'));
app.use('/api/auth', require('../routes/auth'));

// Fallback: Eğer path /api olmadan gelirse (normalize edilmişse bile)
// Bu route'lar da çalışacak
app.use('/cars', require('../routes/cars'));
app.use('/reservations', require('../routes/reservations'));
app.use('/auth', require('../routes/auth'));

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
// MongoDB Connection (Kaldırıldı)

// Vercel serverless function handler
module.exports = app;

