const express = require('express');
const axios = require('axios');
const router = express.Router();

// Image proxy endpoint - SSL sertifika sorunlarını çözmek için
router.get('/proxy', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    // URL'i decode et
    const imageUrl = decodeURIComponent(url);
    
    // Güvenlik: Sadece xdrivejson.turevsistem.com domain'inden image'ler alınsın
    if (!imageUrl.includes('xdrivejson.turevsistem.com')) {
      return res.status(403).json({ error: 'Invalid image source' });
    }
    
    // HTTP kullan (SSL sertifika sorunu olmadığı için)
    const httpUrl = imageUrl.replace('https://', 'http://');
    
    try {
      // Image'i HTTP üzerinden çek
      const response = await axios.get(httpUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      });
      
      // Content-Type'ı belirle
      const contentType = response.headers['content-type'] || 'image/jpeg';
      
      // Cache headers
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', response.data.length);
      
      // Image'i gönder
      res.send(response.data);
    } catch (error) {
      console.error('Image proxy error:', error.message);
      // 404 döndür, frontend placeholder gösterecek
      res.status(404).json({ error: 'Image not found' });
    }
  } catch (error) {
    console.error('Image proxy request error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

