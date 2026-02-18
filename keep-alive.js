const https = require('https');

const BACKEND_URL = process.env.BACKEND_URL || 'https://your-backend.onrender.com';

function keepAlive() {
  https.get(BACKEND_URL, (res) => {
    if (res.statusCode === 200) {
      console.log('✅ Keep-alive ping successful');
    } else {
      console.log('⚠️ Keep-alive ping returned:', res.statusCode);
    }
  }).on('error', (err) => {
    console.error('❌ Keep-alive ping failed:', err.message);
  });
}

// Ping every 14 minutes (Render sleeps after 15 minutes of inactivity)
setInterval(keepAlive, 14 * 60 * 1000);

console.log('🔄 Keep-alive service started');