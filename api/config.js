export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch(e) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  if (!body || !body.sessionTicket) {
    return res.status(400).json({ error: 'Falta sessionTicket' });
  }

  const firebaseConfig = {
    apiKey:            process.env.FB_API_KEY,
    authDomain:        process.env.FB_AUTH_DOMAIN,
    projectId:         process.env.FB_PROJECT_ID,
    storageBucket:     process.env.FB_STORAGE_BUCKET,
    messagingSenderId: process.env.FB_MESSAGING_SENDER_ID,
    appId:             process.env.FB_APP_ID
  };

  const missing = Object.entries(firebaseConfig)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    return res.status(500).json({
      error: 'Variables de Firebase faltantes en Vercel: ' + missing.join(', ')
    });
  }

  return res.status(200).json(firebaseConfig);
}
