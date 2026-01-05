const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
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

app.listen(PORT, () => {
  console.log(`Server ${PORT} portunda çalışıyor`);
});

