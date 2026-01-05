const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// CORS ayarları - Vercel ve localhost için
const corsOptions = {
  origin: function (origin, callback) {
    // Vercel production URL'leri
    const allowedOrigins = [
      'https://xdrive-e04d1acw9-cemil-emre-aras-projects.vercel.app', // Backend URL
      'https://xdrive-fe-git-main-cemil-emre-aras-projects.vercel.app', // Frontend URL
      'https://xdrive-fe.vercel.app', // Production frontend URL (eğer varsa)
      'https://*.vercel.app', // Tüm Vercel subdomain'leri
      'http://localhost:3000',
      'http://localhost:3001'
    ];
    
    // Origin yoksa (Postman, curl gibi) veya izin verilen origin'lerden biriyse
    if (!origin || allowedOrigins.some(allowed => {
      if (allowed.includes('*')) {
        return origin.includes(allowed.replace('*.', ''));
      }
      return origin === allowed;
    })) {
      callback(null, true);
    } else {
      console.warn('CORS blocked origin:', origin);
      callback(new Error('CORS policy violation'));
    }
  },
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
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

