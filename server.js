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

// Middleware
app.use(cors(corsOptions));

// OPTIONS istekleri için özel handler (preflight)
app.options('*', cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/cars', require('./routes/cars'));
app.use('/api/reservations', require('./routes/reservations'));
app.use('/api/auth', require('./routes/auth'));

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

