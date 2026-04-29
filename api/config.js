// ══════════════════════════════════════════════════════════════
//  LexQuote — API /api/config
//  Verifica el SessionTicket de PlayFab SERVER-SIDE y devuelve
//  la configuración de Firebase que corresponde a esa empresa.
//
//  Flujo:
//   1. El cliente hace login con PlayFab (email + password)
//   2. El cliente manda el SessionTicket a este endpoint
//   3. Este endpoint valida el ticket con PlayFab usando la
//      SECRET KEY (nunca expuesta al cliente)
//   4. PlayFab devuelve los datos del jugador (FB_* keys)
//   5. Este endpoint devuelve la config Firebase al cliente
//
//  Variables de entorno requeridas en Vercel:
//    PLAYFAB_TITLE_ID   → ej: 1B46AD
//    PLAYFAB_SECRET_KEY → la Secret Key del título en PlayFab
//
// ══════════════════════════════════════════════════════════════

const PLAYFAB_TITLE_ID   = process.env.PLAYFAB_TITLE_ID;
const PLAYFAB_SECRET_KEY = process.env.PLAYFAB_SECRET_KEY;

const FB_KEYS = [
  'FB_API_KEY',
  'FB_AUTH_DOMAIN',
  'FB_PROJECT_ID',
  'FB_STORAGE_BUCKET',
  'FB_MESSAGING_SENDER_ID',
  'FB_APP_ID'
];

export default async function handler(req, res) {

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method Not Allowed' });

  if (!PLAYFAB_TITLE_ID || !PLAYFAB_SECRET_KEY) {
    console.error('[LexQuote] Faltan PLAYFAB_TITLE_ID o PLAYFAB_SECRET_KEY en Vercel env vars');
    return res.status(500).json({ error: 'Configuración del servidor incompleta.' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch(e) {
    return res.status(400).json({ error: 'JSON inválido.' });
  }

  const { sessionTicket } = body || {};
  if (!sessionTicket) {
    return res.status(400).json({ error: 'Falta sessionTicket.' });
  }

  // ── 1. Validar el ticket con PlayFab SERVER-SIDE ───────────
  let playFabId;
  try {
    const authResp = await fetch(
      `https://${PLAYFAB_TITLE_ID}.playfabapi.com/Server/AuthenticateSessionTicket`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SecretKey':  PLAYFAB_SECRET_KEY
        },
        body: JSON.stringify({ SessionTicket: sessionTicket })
      }
    );

    const authData = await authResp.json();

    if (authData.code !== 200 || !authData.data?.UserInfo?.PlayFabId) {
      console.warn('[LexQuote] Ticket inválido:', authData.errorMessage);
      return res.status(401).json({ error: 'Sesión inválida o expirada. Volvé a iniciar sesión.' });
    }

    playFabId = authData.data.UserInfo.PlayFabId;

  } catch(e) {
    console.error('[LexQuote] Error validando ticket:', e.message);
    return res.status(502).json({ error: 'Error de comunicación con el servidor de autenticación.' });
  }

  // ── 2. Obtener Firebase config del jugador (Server API) ────
  let fbConfig;
  try {
    const dataResp = await fetch(
      `https://${PLAYFAB_TITLE_ID}.playfabapi.com/Server/GetUserData`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SecretKey':  PLAYFAB_SECRET_KEY
        },
        body: JSON.stringify({ PlayFabId: playFabId, Keys: FB_KEYS })
      }
    );

    const dataJson = await dataResp.json();

    if (dataJson.code !== 200 || !dataJson.data?.Data) {
      return res.status(502).json({ error: 'No se pudieron obtener los datos del usuario.' });
    }

    const d = dataJson.data.Data;

    if (!d.FB_PROJECT_ID?.Value) {
      return res.status(403).json({
        error: 'Esta cuenta no tiene una base de datos configurada. Contactá al administrador.'
      });
    }

    fbConfig = {
      apiKey:            d.FB_API_KEY?.Value             || null,
      authDomain:        d.FB_AUTH_DOMAIN?.Value         || null,
      projectId:         d.FB_PROJECT_ID?.Value          || null,
      storageBucket:     d.FB_STORAGE_BUCKET?.Value      || null,
      messagingSenderId: d.FB_MESSAGING_SENDER_ID?.Value || null,
      appId:             d.FB_APP_ID?.Value              || null,
    };

    const faltantes = Object.entries(fbConfig).filter(([,v]) => !v).map(([k]) => k);
    if (faltantes.length > 0) {
      return res.status(403).json({
        error: `Config incompleta. Faltan: ${faltantes.join(', ')}. Contactá al administrador.`
      });
    }

  } catch(e) {
    console.error('[LexQuote] Error obteniendo userData:', e.message);
    return res.status(502).json({ error: 'Error obteniendo configuración del usuario.' });
  }

  console.log(`[LexQuote] Login OK — PlayFabId: ${playFabId} → Firebase: ${fbConfig.projectId}`);
  return res.status(200).json(fbConfig);
}
