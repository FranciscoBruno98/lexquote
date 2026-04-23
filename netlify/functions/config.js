exports.handler = async function(event, context) {
  // Solo POST
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

  const { sessionTicket } = body;
  if (!sessionTicket) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Falta sessionTicket' }) };
  }

  const titleId     = process.env.PLAYFAB_TITLE_ID;
  const secretKey   = process.env.PLAYFAB_SECRET_KEY;

  if (!titleId || !secretKey) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Variables de entorno de PlayFab no configuradas' }) };
  }

  // Validar el sessionTicket contra PlayFab Server API
  try {
    const pfResp = await fetch(
      `https://${titleId}.playfabapi.com/Server/AuthenticateSessionTicket`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SecretKey': secretKey
        },
        body: JSON.stringify({ SessionTicket: sessionTicket })
      }
    );

    const pfData = await pfResp.json();

    if (pfData.code !== 200 || !pfData.data || !pfData.data.UserInfo) {
      return {
        statusCode: 401,
        headers: CORS,
        body: JSON.stringify({ error: 'Sesión de PlayFab inválida o expirada' })
      };
    }

    // Sesión válida → devolver Firebase config desde variables de entorno
    const firebaseConfig = {
      apiKey:            process.env.FB_API_KEY,
      authDomain:        process.env.FB_AUTH_DOMAIN,
      projectId:         process.env.FB_PROJECT_ID,
      storageBucket:     process.env.FB_STORAGE_BUCKET,
      messagingSenderId: process.env.FB_MESSAGING_SENDER_ID,
      appId:             process.env.FB_APP_ID
    };

    // Verificar que todas las claves estén presentes
    const missing = Object.entries(firebaseConfig)
      .filter(([, v]) => !v)
      .map(([k]) => k);

    if (missing.length > 0) {
      return {
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({ error: 'Variables de Firebase faltantes: ' + missing.join(', ') })
      };
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify(firebaseConfig)
    };

  } catch(e) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: 'Error al contactar PlayFab: ' + e.message })
    };
  }
};
