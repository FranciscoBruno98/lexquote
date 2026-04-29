# LexQuote — Setup de Autenticación (v1.0)

## Arquitectura

```
Usuario (browser)
  │
  ├─ 1. POST /Client/LoginWithEmailAddress  →  PlayFab
  │       (email + password)                     │
  │       ← SessionTicket                        │
  │                                              │
  ├─ 2. POST /api/config                    →  Vercel (config.js)
  │       (sessionTicket)                        │
  │                                    ┌─── 3. POST /Server/AuthenticateSessionTicket
  │                                    │         (sessionTicket + SECRET KEY)
  │                                    │    ← PlayFabId validado
  │                                    │
  │                                    └─── 4. POST /Server/GetUserData
  │                                              (PlayFabId + SECRET KEY)
  │                                         ← FB_API_KEY, FB_PROJECT_ID, etc.
  │       ← { apiKey, projectId, ... }
  │
  └─ 5. initializeApp(config)           →  Firebase (Firestore de ESA empresa)
```

**La Secret Key de PlayFab NUNCA sale del servidor.**  
El cliente solo ve el SessionTicket (que expira).

---

## Variables de entorno en Vercel

Ir a **Vercel → tu proyecto → Settings → Environment Variables** y agregar:

| Variable | Valor | Dónde encontrarlo |
|---|---|---|
| `PLAYFAB_TITLE_ID` | `1B46AD` | PlayFab → Title Settings |
| `PLAYFAB_SECRET_KEY` | `TU_SECRET_KEY` | PlayFab → Title Settings → Secret Keys |

> ⚠️ La `PLAYFAB_SECRET_KEY` es sensible. No la compartas ni la hardcodees.

---

## Configurar cada empresa en PlayFab

Por cada cliente (empresa) que use LexQuote:

1. **Crear el usuario** en PlayFab → Players → Add Player  
   O que el cliente se registre (si habilitás registro).

2. **Ir al Player** → Data (Custom) → Add New Item

3. Agregar estas 6 keys con los valores del Firebase de esa empresa:

| Key | Ejemplo de valor |
|---|---|
| `FB_API_KEY` | `AIzaSyXXXXXXXXXXXXX` |
| `FB_AUTH_DOMAIN` | `estudio-smith.firebaseapp.com` |
| `FB_PROJECT_ID` | `estudio-smith` |
| `FB_STORAGE_BUCKET` | `estudio-smith.appspot.com` |
| `FB_MESSAGING_SENDER_ID` | `123456789012` |
| `FB_APP_ID` | `1:123456789012:web:abcdef` |

4. Guardar. A partir de ese momento, ese usuario verá **solo su Firestore** al loguearse.

---

## Agregar usuarios adicionales a una empresa

Si una empresa tiene más de 1 empleado:

1. Crear otro Player en PlayFab con el email del empleado.
2. Asignarle **exactamente los mismos** FB_* keys que la empresa.
3. Listo — ambos usuarios comparten el mismo Firestore.

---

## Reglas de seguridad en Firebase (Firestore)

Configurar en cada proyecto Firebase de cliente:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Solo permite lectura/escritura si la petición viene autenticada
    // Por ahora: acceso abierto (para proyectos nuevos en modo prueba)
    // TODO v1.1: agregar Firebase Auth para doble capa de seguridad
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

> Para v1.1 se puede agregar Firebase Auth como segunda capa.

---

## Flujo de logout

El botón "⎋ Salir" en el header:
- Desuscribe todos los listeners de Firestore
- Limpia la sesión del browser
- Vuelve a la pantalla de login

El SessionTicket de PlayFab expira automáticamente (24hs por defecto).

