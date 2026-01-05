const express = require('express');
const router = express.Router();

// Basit bir auth sistemi (gerekirse genişletilebilir)
// Şimdilik sadece placeholder

router.post('/login', (req, res) => {
  // İleride JWT token ile authentication eklenebilir
  res.json({ message: 'Auth endpoint - geliştirilecek' });
});

router.post('/register', (req, res) => {
  // İleride kullanıcı kayıt sistemi eklenebilir
  res.json({ message: 'Register endpoint - geliştirilecek' });
});

module.exports = router;

