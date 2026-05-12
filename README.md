# KU Support Bot — ADMOSA Guatemala

Bot de soporte para Key Users de Salesforce Automotive Cloud (SFA).  
Interfaz tipo WhatsApp con resolución por IA (Claude) y escalamiento a APEX.

---

## 🏗️ Arquitectura

```
Usuario (web UI)
      ↓
  /api/chat  (Vercel Serverless)
      ↓
  Claude API  →  resolución automática
      ↓ (si escala)
  Mock ticket APEX  +  notificación al KU
```

**Marcas configuradas:** TVS · Honda · Cadisa · Motos Exclusivas · Hero · Suzuki  
**Canales:** AP (Agencias Propias) · HT (Hipertiendas)  
**= 12 flujos únicos**, cada uno con su propio system prompt y datos del KU.

---

## 📁 Estructura del proyecto

```
ku-support-bot/
├── api/
│   └── chat.js          # Serverless API (POST /api/chat)
├── src/
│   ├── brands.js        # Config de 12 marcas/canales + datos KU
│   └── prompts.js       # 12 system prompts + base de conocimiento SFA
├── public/
│   └── index.html       # UI tipo WhatsApp (frontend estático)
├── .env.example         # Variables de entorno requeridas
├── .gitignore
├── package.json
├── vercel.json
└── README.md
```

---

## 🚀 Setup local (5 minutos)

### 1. Clonar y instalar
```bash
git clone https://github.com/TU_USUARIO/ku-support-bot.git
cd ku-support-bot
npm install
```

### 2. Configurar variables de entorno
```bash
cp .env.example .env.local
# Edita .env.local y agrega tu API key de Anthropic
```

Obtén tu API key en: https://console.anthropic.com/

### 3. Correr en desarrollo
```bash
npx vercel dev
# Abre http://localhost:3000
```

---

## ☁️ Deploy en Vercel

### Opción A — desde CLI
```bash
npx vercel          # deploy de prueba
npx vercel --prod   # deploy a producción
```

Durante el primer deploy, Vercel te pedirá:
- Linked to existing project? → No
- Project name → `ku-support-bot`
- Framework → Other

### Opción B — desde GitHub (recomendado)
1. Sube el repo a GitHub.
2. Ve a https://vercel.com/new
3. Importa el repo.
4. En **Environment Variables**, agrega:
   - `ANTHROPIC_API_KEY` = `sk-ant-api03-...`
5. Deploy.

### Configurar la API key en Vercel (después del primer deploy)
```bash
vercel env add ANTHROPIC_API_KEY production
# Pega tu API key cuando te la pida
vercel --prod  # redeploy para aplicar
```

---

## 🔌 API Reference

### `POST /api/chat`

**Body siempre incluye:** `{ action, message?, session }`

| action | description | message |
|--------|------------|---------|
| `init` | Inicia una sesión nueva | — |
| `select_brand` | Selecciona la marca | nombre de la marca |
| `select_channel` | Selecciona el canal | `"AP"` o `"HT"` |
| `message` | Envía mensaje al bot | texto libre |

**Response types:**
- `brand_selection` — muestra opciones de marcas
- `channel_selection` — muestra AP / HT
- `ready` — sesión lista, comienza chat
- `message` — respuesta de la IA
- `escalation` — ticket creado, incluye datos del KU

---

## 🧠 Conocimiento base de los prompts

Cada system prompt incluye:

1. **Gestión de Leads** — captación, estados, conversión, pérdida
2. **Candidatos** — creación, campos obligatorios, conversión a cuenta
3. **Cuentas** — validación DPI, código BP, cuenta empresa
4. **Oportunidades** — etapas, agregar productos, Standard Price Book
5. **Cotización** — descuentos, aprobaciones, PDF, sincronización
6. **Medios de Pago** — contado, crédito, tarjeta, efectivo, QSA
7. **Crediopciones** — simulador de cuotas, precalificación, saldo a favor
8. **Proceso Administrativo** — assets, chasis, pedidos SAP, facturación
9. **Venta Empleado** — código BP, aprobación jefe, precio empleado
10. **Configuraciones KU** — placas, promociones, aprobación descuentos
11. **Casos especiales** — regla de 0, nota de crédito, cambio de color

### Criterios de escalamiento automático
El bot responde `[ESCALAR]` cuando detecta:
- Aprobación/rechazo de descuentos
- Autorización de medios de pago (sin QSA)
- Configuración de precios/promociones de placas
- Errores de acceso o permisos en Salesforce
- Notas de crédito o refacturaciones
- Problemas de integración SAP
- Venta empleado que requiere aprobación administrativa

---

## 🔧 Personalizar

### Agregar una nueva marca
En `src/brands.js`, agrega una nueva entrada al objeto `BRANDS`:
```javascript
NUEVA_MARCA: {
  name: 'Nueva Marca',
  channels: {
    AP: {
      ku_name: 'Key User NM — AP',
      ku_email: 'ku@nuevamarca.com',
      ku_whatsapp: '+502 XXXX-XXXX',
      ...
    },
    HT: { ... }
  }
}
```

### Actualizar el conocimiento del bot
Edita la constante `COMMON_KNOWLEDGE` en `src/prompts.js` para agregar nuevos procesos, FAQs o criterios de escalamiento.

---

## 📊 Conexión con APEX real

Actualmente los tickets son simulados (mock). Para conectar con APEX real:

1. En `api/chat.js`, reemplaza la sección de escalamiento:
```javascript
// Reemplazar esta línea:
apex_url: `https://apex.admosa.com/ords/f?p=...`

// Por una llamada real a APEX REST API:
const apexRes = await fetch('https://apex.tudominio.com/ords/schema/tickets/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.APEX_TOKEN}`
  },
  body: JSON.stringify({
    p_marca: brand,
    p_canal: channel,
    p_telefono: session.userPhone || 'web-test',
    p_descripcion: session.messages.slice(-2)[0]?.content || '',
    p_ku_asignado: ch.ku_email
  })
});
const { ticket_id } = await apexRes.json();
```

2. Agrega `APEX_TOKEN` en las variables de entorno de Vercel.

---

## 🤝 Conexión con WhatsApp Business

Este repositorio es el **middleware de IA**. Para conectar con WhatsApp:

1. Configura Meta Cloud API (1 número).
2. En el webhook de Meta, llama a `/api/chat` pasando el número de teléfono como session ID.
3. Usa el número de teléfono para mantener la sesión del usuario (reemplaza localStorage por una BD).

---

## 📝 Licencia

Uso interno ADMOSA. No distribuir.
