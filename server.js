const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// CORS ayarları - Vercel ve localhost için
// Vercel'de çalışıyorsa tüm origin'lere izin ver (güvenlik için production'da sınırlandırılabilir)
const corsOptions = {
  origin: function (origin, callback) {
    // Vercel'de çalışıyorsa veya origin yoksa (Postman, curl gibi) izin ver
    if (process.env.VERCEL || !origin) {
      console.log('✅ CORS allowed (Vercel/No origin):', origin || 'no origin');
      callback(null, true);
      return;
    }
    
    // Localhost veya Vercel domain'leri için izin ver
    const allowedPatterns = [
      /^https?:\/\/localhost(:\d+)?$/,
      /^https:\/\/.*\.vercel\.app$/,
      /^https:\/\/xdrive-fe.*\.vercel\.app$/,
      /^https:\/\/xdrive-fe\.vercel\.app$/
    ];
    
    const isAllowed = allowedPatterns.some(pattern => pattern.test(origin));
    
    if (isAllowed) {
      console.log('✅ CORS allowed:', origin);
      callback(null, true);
    } else {
      console.warn('❌ CORS blocked origin:', origin);
      callback(new Error('CORS policy violation'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 86400 // 24 saat
};

// CORS middleware - Vercel için özel
app.use((req, res, next) => {
  // Tüm origin'lere izin ver (production'da sınırlandırılabilir)
  const origin = req.headers.origin;
  
  if (origin && (origin.includes('vercel.app') || origin.includes('localhost'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  // OPTIONS isteği için hemen yanıt ver
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Express middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/cars', require('./routes/cars'));
app.use('/api/reservations', require('./routes/reservations'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/images', require('./routes/images'));

// Chrome DevTools .well-known isteğini sessizce yok say
app.get('/.well-known/*', (req, res) => {
  res.status(404).end();
});

// MongoDB Connection (Opsiyonel - Sadece rezervasyon cache için)
if (process.env.MONGODB_URI && process.env.MONGODB_URI !== '') {
  mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('MongoDB bağlantısı başarılı'))
  .catch(err => {
    console.warn('MongoDB bağlantı hatası (opsiyonel, devam ediliyor):', err.message);
    console.log('Not: MongoDB olmadan da çalışabilir. Rezervasyonlar sadece external API\'ye kaydedilecek.');
  });
} else {
  console.log('MongoDB URI tanımlı değil. Sistem MongoDB olmadan çalışacak.');
  console.log('Not: Rezervasyonlar sadece external API\'ye kaydedilecek, yerel veritabanında saklanmayacak.');
}

const PORT = process.env.PORT || 5001;

// Vercel'de serverless function olarak çalışıyorsa listen etme
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`Server ${PORT} portunda çalışıyor`);
  });
}

// Vercel serverless function export
module.exports = app;

