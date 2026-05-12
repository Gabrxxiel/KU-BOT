const Anthropic = require('@anthropic-ai/sdk');
const { getSystemPrompt } = require('../src/prompts');
const { BRANDS } = require('../src/brands');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── helpers ───────────────────────────────────
function generateTicketId() {
  const ts = Date.now().toString().slice(-6);
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `TKT-${ts}-${rand}`;
}

function corsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ─── main handler ──────────────────────────────
module.exports = async (req, res) => {
  corsHeaders(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { action, message, session } = req.body;

    // ── ACTION: init — start a new session ──
    if (action === 'init') {
      return res.json({
        type: 'brand_selection',
        message: '👋 Bienvenido al soporte *Key User* de ADMOSA.\n\n¿A qué marca perteneces?',
        options: Object.keys(BRANDS).map(k => ({ value: k, label: BRANDS[k].name })),
      });
    }

    // ── ACTION: select_brand ──
    if (action === 'select_brand') {
      const brand = message;
      if (!BRANDS[brand]) return res.status(400).json({ error: 'Marca inválida' });
      return res.json({
        type: 'channel_selection',
        message: `Seleccionaste *${BRANDS[brand].name}*.\n\n¿A qué canal perteneces?`,
        options: [
          { value: 'AP', label: '🏪 Agencias Propias (AP)' },
          { value: 'HT', label: '🏬 Hipertiendas (HT)' },
        ],
        session: { ...session, brand },
      });
    }

    // ── ACTION: select_channel ──
    if (action === 'select_channel') {
      const channel = message;
      if (!['AP', 'HT'].includes(channel)) return res.status(400).json({ error: 'Canal inválido' });
      const brand = session.brand;
      const channelName = channel === 'AP' ? 'Agencias Propias' : 'Hipertiendas';
      return res.json({
        type: 'ready',
        message: `✅ Listo. Te atiendo como soporte *${BRANDS[brand].name} — ${channelName}*.\n\n¿Cuál es tu consulta sobre Salesforce?`,
        session: { ...session, channel, messages: [] },
      });
    }

    // ── ACTION: message — AI conversation ──
    if (action === 'message') {
      const { brand, channel, messages = [] } = session;

      if (!brand || !channel) {
        return res.status(400).json({ error: 'Sesión incompleta. Recarga la página.' });
      }

      const systemPrompt = getSystemPrompt(brand, channel);
      const history = [
        ...messages,
        { role: 'user', content: message },
      ];

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        system: systemPrompt,
        messages: history,
      });

      const aiText = response.content[0].text;
      const updatedMessages = [
        ...history,
        { role: 'assistant', content: aiText },
      ];

      // ── Check for escalation ──
      if (aiText.includes('[ESCALAR]')) {
        const ticketId = generateTicketId();
        const ch = BRANDS[brand].channels[channel];
        const cleanMessage = aiText.replace('[ESCALAR]', '').trim();

        return res.json({
          type: 'escalation',
          message: cleanMessage,
          ticket: {
            id: ticketId,
            brand,
            channel,
            channel_label: channel === 'AP' ? 'Agencias Propias' : 'Hipertiendas',
            ku_name: ch.ku_name,
            ku_email: ch.ku_email,
            ku_whatsapp: ch.ku_whatsapp,
            created_at: new Date().toLocaleString('es-GT', { timeZone: 'America/Guatemala' }),
            apex_url: `https://apex.admosa.com/ords/f?p=SFA_TICKETS:TICKET:::::TICKET_ID:${ticketId}`,
          },
          session: { ...session, messages: updatedMessages, escalated: true, ticketId },
        });
      }

      return res.json({
        type: 'message',
        message: aiText,
        session: { ...session, messages: updatedMessages },
      });
    }

    return res.status(400).json({ error: 'Acción no reconocida' });

  } catch (err) {
    console.error('Chat API error:', err);
    return res.status(500).json({
      error: 'Error interno del servidor',
      detail: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};
