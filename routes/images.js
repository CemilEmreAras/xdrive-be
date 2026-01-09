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
    console.log('🖼️ Image proxy request:', imageUrl);
    
    // Güvenlik: Sadece izin verilen domain'lerden image'ler alınsın
    const allowedDomains = ['xdrivejson.turevsistem.com', 't1.trvcar.com', 'trvcar.com'];
    const isAllowedDomain = allowedDomains.some(domain => imageUrl.includes(domain));
    if (!isAllowedDomain) {
      console.error('❌ Image proxy: Invalid domain:', imageUrl);
      return res.status(403).json({ error: 'Invalid image source' });
    }
    
    // HTTP kullan (SSL sertifika sorunu olmadığı için)
    const httpUrl = imageUrl.replace('https://', 'http://');
    console.log('🖼️ Image proxy: Fetching from:', httpUrl);
    
    try {
      // Image'i HTTP üzerinden çek
      const response = await axios.get(httpUrl, {
        responseType: 'arraybuffer',
        timeout: 15000, // Timeout'u 15 saniyeye çıkar
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://xdrive-fe.vercel.app/'
        },
        maxRedirects: 5,
        validateStatus: function (status) {
          return status >= 200 && status < 400; // 2xx ve 3xx status kodlarını kabul et
        }
      });
      
      console.log('✅ Image proxy: Image fetched successfully, size:', response.data.length, 'bytes');
      
      // Content-Type'ı belirle
      const contentType = response.headers['content-type'] || 'image/jpeg';
      console.log('✅ Image proxy: Content-Type:', contentType);
      
      // CORS headers ekle
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', response.data.length);
      
      // Image'i gönder
      res.send(response.data);
    } catch (error) {
      console.error('❌ Image proxy error:', error.message);
      console.error('❌ Image proxy error details:', {
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: httpUrl
      });
      
      // Daha açıklayıcı hata mesajı
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        return res.status(504).json({ error: 'Image server unreachable', url: httpUrl });
      } else if (error.response?.status === 404) {
        return res.status(404).json({ error: 'Image not found', url: httpUrl });
      } else {
        return res.status(500).json({ error: 'Failed to fetch image', url: httpUrl, details: error.message });
      }
    }
  } catch (error) {
    console.error('❌ Image proxy request error:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

module.exports = router;

