exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch(e) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (!body.sessionTicket) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Falta sessionTicket' }) };
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
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: 'Variables de Firebase faltantes en Netlify: ' + missing.join(', ') })
    };
  }

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify(firebaseConfig)
  };
};
