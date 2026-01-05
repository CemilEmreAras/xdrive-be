// Vercel serverless function handler
const app = require('../server');

// Vercel için handler function
module.exports = (req, res) => {
  // CORS header'larını set et (her istekte)
  const origin = req.headers.origin || req.headers.Origin;
  
  // Tüm origin'lere izin ver
  if (origin) {
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
    console.log('✅ OPTIONS preflight - CORS headers set');
    return res.status(200).end();
  }
  
  console.log(`✅ Request: ${req.method} ${req.url} from origin: ${origin || 'no origin'}`);
  
  // Express app'i handler olarak kullan
  return app(req, res);
};

