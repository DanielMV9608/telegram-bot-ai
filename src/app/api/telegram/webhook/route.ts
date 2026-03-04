import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';
import ZAI from 'z-ai-web-dev-sdk';

const getClient = () => createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
    date: number;
  };
}

// Función para enviar mensaje a Telegram
async function sendTelegramMessage(token: string, chatId: number, text: string) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    })
  });
  
  return response.json();
}

// Función para extraer datos del mensaje (nombre, teléfono, email)
function extractDataFromMessage(text: string): { name?: string; phone?: string; email?: string } {
  const result: { name?: string; phone?: string; email?: string } = {};
  
  // Patrones para detectar teléfono
  const phonePatterns = [
    /(?:teléfono|telefono|celular|cel|número|numero|phone|mobile)[:\s]*([+]?[\d\s()-]{7,15})/i,
    /(?:\b|[:\s])([+]?[\d]{1,3}[\s-]?[\d]{2,4}[\s-]?[\d]{2,4}[\s-]?[\d]{2,4})(?:\b)/,
    /\b(\d{3}[\s-]?\d{3}[\s-]?\d{4})\b/,
    /\b(\d{10,15})\b/
  ];
  
  for (const pattern of phonePatterns) {
    const match = text.match(pattern);
    if (match) {
      const phone = match[1]?.replace(/[\s()-]/g, '');
      if (phone && phone.length >= 7) {
        result.phone = phone;
        break;
      }
    }
  }
  
  // Patrones para detectar nombre
  const namePatterns = [
    /(?:me llamo|soy|mi nombre es|my name is|i am)[:\s]*([A-Za-záéíóúñÁÉÍÓÚÑ\s]{2,30})/i,
    /(?:nombre|name)[:\s]*([A-Za-záéíóúñÁÉÍÓÚÑ\s]{2,30})/i
  ];
  
  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match) {
      const name = match[1]?.trim();
      if (name && name.length >= 2) {
        result.name = name;
        break;
      }
    }
  }
  
  // Patrones para detectar email
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  if (emailMatch) {
    result.email = emailMatch[0];
  }
  
  return result;
}

// Función para detectar intención de reserva
function detectReservationIntent(text: string): { 
  isReservation: boolean; 
  date?: string; 
  time?: string;
  rawText: string;
} {
  const lowerText = text.toLowerCase();
  
  // Palabras clave para detectar intención de reserva
  const reservationKeywords = [
    'reservar', 'reserva', 'cita', 'agendar', 'programar', 
    'apartar', 'quiero una cita', 'quisiera una cita',
    'necesito una cita', 'me gustaría reservar', 'me gustaria reservar',
    'book', 'appointment', 'schedule', 'reserve'
  ];
  
  const isReservation = reservationKeywords.some(keyword => lowerText.includes(keyword));
  
  if (!isReservation) {
    return { isReservation: false, rawText: text };
  }
  
  // Extraer fecha
  const datePatterns = [
    // Fechas específicas: 15 de enero, 15 enero, enero 15
    /(?:el\s+)?(\d{1,2})\s+(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i,
    /(?:el\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(\d{1,2})/i,
    // Fechas numéricas: 15/01, 15-01, 2024-01-15
    /(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/,
    // Días de la semana
    /(?:el\s+)?(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\s+(?:próximo|proximo)?/i,
    // Relativos
    /(?:mañana|manana|hoy|pasado mañana)/i,
  ];
  
  // Extraer hora
  const timePatterns = [
    /(?:a\s+las?\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|de la mañana|de la tarde|de la noche)?/i,
    /(?:a\s+)?(\d{1,2})\s*(am|pm)/i,
  ];
  
  let detectedDate: string | undefined;
  let detectedTime: string | undefined;
  
  // Detectar día relativo
  const today = new Date();
  if (/mañana|manana/i.test(text)) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    detectedDate = tomorrow.toISOString().split('T')[0];
  } else if (/hoy/i.test(text)) {
    detectedDate = today.toISOString().split('T')[0];
  } else if (/pasado\s*mañana/i.test(text)) {
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);
    detectedDate = dayAfter.toISOString().split('T')[0];
  }
  
  // Detectar día de la semana
  const dayNames = ['domingo', 'lunes', 'martes', 'miercoles', 'miércoles', 'jueves', 'viernes', 'sabado', 'sábado'];
  for (const dayName of dayNames) {
    const regex = new RegExp(`(?:el\\s+)?${dayName}(?:\\s+(?:próximo|proximo))?`, 'i');
    if (regex.test(text)) {
      const dayIndex = dayNames.indexOf(dayName.toLowerCase().replace('é', 'e'));
      if (dayIndex !== -1) {
        const targetDate = new Date(today);
        const currentDay = today.getDay();
        let daysUntil = dayIndex - currentDay;
        if (daysUntil <= 0) daysUntil += 7; // Próxima semana
        targetDate.setDate(today.getDate() + daysUntil);
        detectedDate = targetDate.toISOString().split('T')[0];
        break;
      }
    }
  }
  
  // Detectar hora
  for (const pattern of timePatterns) {
    const match = text.match(pattern);
    if (match) {
      let hour = parseInt(match[1]);
      const minutes = match[2] ? parseInt(match[2]) : 0;
      const period = (match[3] || match[2] || '').toLowerCase();
      
      // Convertir a formato 24h si es necesario
      if (period.includes('pm') || period.includes('tarde') || period.includes('noche')) {
        if (hour < 12) hour += 12;
      } else if ((period.includes('am') || period.includes('mañana')) && hour === 12) {
        hour = 0;
      }
      
      detectedTime = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      break;
    }
  }
  
  return {
    isReservation: true,
    date: detectedDate,
    time: detectedTime,
    rawText: text,
  };
}

// Función para obtener tokens de Google
async function getGoogleTokens() {
  const client = getClient();
  const result = await client.execute('SELECT * FROM BotConfig LIMIT 1');
  const config = result.rows[0] as Record<string, unknown> | undefined;
  
  return {
    clientId: config?.googleClientId as string | null,
    clientSecret: config?.googleClientSecret as string | null,
    refreshToken: config?.googleRefreshToken as string | null,
    calendarId: config?.googleCalendarId as string | null,
  };
}

// Función para obtener access token de Google
async function getGoogleAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to refresh Google access token');
  }
  
  const data = await response.json();
  return data.access_token;
}

// Función para crear evento en Google Calendar
async function createGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  reservation: { leadName: string; leadEmail?: string; leadPhone?: string; date: string; time: string; title?: string }
): Promise<{ id: string; htmlLink: string }> {
  const startDateTime = new Date(`${reservation.date}T${reservation.time}`);
  const endDateTime = new Date(startDateTime.getTime() + 60 * 60000); // 1 hora por defecto
  
  const event = {
    summary: reservation.title || `Reserva - ${reservation.leadName}`,
    description: `Reserva realizada via Telegram Bot\nTeléfono: ${reservation.leadPhone || 'No proporcionado'}\nEmail: ${reservation.leadEmail || 'No proporcionado'}`,
    start: {
      dateTime: startDateTime.toISOString(),
      timeZone: 'America/Mexico_City',
    },
    end: {
      dateTime: endDateTime.toISOString(),
      timeZone: 'America/Mexico_City',
    },
    attendees: reservation.leadEmail ? [{ email: reservation.leadEmail }] : [],
  };
  
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    console.error('[Google Calendar] Error:', error);
    throw new Error(`Google Calendar error: ${response.status}`);
  }
  
  const data = await response.json();
  return { id: data.id, htmlLink: data.htmlLink };
}

// Función para guardar reserva en BD
async function saveReservation(
  reservation: { leadId: string; leadName: string; leadEmail?: string; leadPhone?: string; date: string; time: string },
  googleEventId: string,
  googleEventLink: string
): Promise<string> {
  const client = getClient();
  const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  
  const startDateTime = new Date(`${reservation.date}T${reservation.time}`);
  const endDateTime = new Date(startDateTime.getTime() + 60 * 60000);
  
  await client.execute({
    sql: `INSERT INTO Reservation (id, leadId, leadName, leadEmail, leadPhone, dateTime, endTime, title, googleEventId, googleEventLink, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, reservation.leadId, reservation.leadName, reservation.leadEmail || null, reservation.leadPhone || null,
           startDateTime.toISOString(), endDateTime.toISOString(), `Reserva - ${reservation.leadName}`,
           googleEventId, googleEventLink, 'confirmed'],
  });
  
  return id;
}

// Función para enviar email de confirmación
async function sendConfirmationEmail(
  to: string,
  reservation: { leadName: string; date: string; time: string; googleEventLink?: string }
): Promise<boolean> {
  try {
    const client = getClient();
    const configResult = await client.execute('SELECT resendApiKey, emailFrom FROM BotConfig LIMIT 1');
    const config = configResult.rows[0] as Record<string, unknown> | undefined;
    
    const resendApiKey = (config?.resendApiKey as string) || process.env.RESEND_API_KEY;
    const emailFrom = config?.emailFrom as string;
    
    if (!resendApiKey || !emailFrom) {
      console.log('[Email] Email not configured, skipping');
      return false;
    }
    
    const dateObj = new Date(reservation.date);
    const formattedDate = dateObj.toLocaleDateString('es-ES', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981, #14b8a6); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1>✅ Reserva Confirmada</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>Hola ${reservation.leadName},</p>
          <p>Tu reserva ha sido confirmada:</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>📅 Fecha:</strong> ${formattedDate}</p>
            <p><strong>🕐 Hora:</strong> ${reservation.time}</p>
            <p><strong>⏱️ Duración:</strong> 60 minutos</p>
          </div>
          ${reservation.googleEventLink ? `<a href="${reservation.googleEventLink}" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Ver en Google Calendar</a>` : ''}
          <p style="margin-top: 20px;">¡Gracias por tu preferencia!</p>
        </div>
      </body>
      </html>
    `;
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [to],
        subject: `✅ Reserva Confirmada - ${formattedDate} a las ${reservation.time}`,
        html,
      }),
    });
    
    if (!response.ok) {
      console.error('[Email] Failed to send:', await response.text());
      return false;
    }
    
    console.log('[Email] Confirmation sent to:', to);
    return true;
  } catch (error) {
    console.error('[Email] Error:', error);
    return false;
  }
}

// Función para procesar con OpenAI
async function processWithOpenAI(
  userMessage: string,
  systemPrompt: string,
  conversationHistory: Array<{ role: string; content: string }>,
  apiKey: string,
  model: string = 'gpt-4o-mini'
): Promise<string> {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt }
  ];
  
  // Agregar historial
  const recentHistory = conversationHistory.slice(-10);
  messages.push(...recentHistory.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content
  })));
  
  messages.push({ role: 'user', content: userMessage });
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      max_tokens: 500
    })
  });
  
  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'Lo siento, no pude procesar tu mensaje.';
}

// Función para procesar con Gemini
async function processWithGemini(
  userMessage: string,
  systemPrompt: string,
  conversationHistory: Array<{ role: string; content: string }>,
  apiKey: string,
  model: string = 'gemini-2.0-flash'
): Promise<string> {
  try {
    // Construir historial de conversación
    const recentHistory = conversationHistory.slice(-10);
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    
    // Agregar historial en el formato correcto para Gemini
    for (const msg of recentHistory) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    }
    
    // Agregar mensaje actual
    contents.push({
      role: 'user',
      parts: [{ text: userMessage }]
    });
    
    // Usar v1beta para todos los modelos de Gemini
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    console.log('[Gemini] Using model:', model);
    console.log('[Gemini] Contents count:', contents.length);
    
    const requestBody: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7
      }
    };
    
    // Agregar systemInstruction como campo separado
    if (systemPrompt) {
      requestBody.systemInstruction = {
        parts: [{ text: systemPrompt }]
      };
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Gemini] API Error:', response.status, JSON.stringify(errorData));
      
      // Mensajes de error más específicos
      const errorMessage = errorData?.error?.message || '';
      const errorStatus = errorData?.error?.status || '';
      
      if (errorMessage.includes('location is not supported')) {
        throw new Error('API_KEY_REGION_BLOCKED: Tu API key tiene restricciones de ubicación. Crea una nueva API key en Google AI Studio (https://aistudio.google.com/app/apikey) SIN restricciones.');
      }
      if (response.status === 429 || errorMessage.includes('quota') || errorStatus === 'RESOURCE_EXHAUSTED') {
        throw new Error('API_KEY_QUOTA_EXCEEDED: Tu API key alcanzó el límite de uso. Espera un momento o crea una nueva API key en Google AI Studio.');
      }
      if (response.status === 404) {
        throw new Error(`Modelo no encontrado. El modelo '${model}' no existe o no está disponible.`);
      }
      if (response.status === 403) {
        throw new Error('API_KEY_INVALID: Tu API key no es válida o expiró.');
      }
      
      throw new Error(`Gemini API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }
    
    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content || content.trim().length === 0) {
      console.error('[Gemini] Empty response:', JSON.stringify(data));
      throw new Error('Empty response from Gemini');
    }
    
    console.log('[Gemini] Response OK, length:', content.length);
    return content;
  } catch (error) {
    console.error('[Gemini] Error:', error);
    throw error;
  }
}

// Función para procesar con z-ai (interno)
async function processWithZAI(
  userMessage: string,
  systemPrompt: string,
  conversationHistory: Array<{ role: string; content: string }>
): Promise<string> {
  try {
    console.log('[ZAI] Initializing SDK...');
    const zai = await ZAI.create();
    console.log('[ZAI] SDK initialized successfully');
    
    const messages: Array<{ role: 'assistant' | 'user'; content: string }> = [
      { role: 'assistant', content: systemPrompt }
    ];
    
    const recentHistory = conversationHistory.slice(-10);
    messages.push(...recentHistory.map(m => ({
      role: m.role as 'assistant' | 'user',
      content: m.content
    })));
    
    messages.push({ role: 'user', content: userMessage });
    
    console.log('[ZAI] Sending request with', messages.length, 'messages');
    
    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: 'disabled' }
    });
    
    console.log('[ZAI] Response received:', completion ? 'OK' : 'NULL');
    
    const content = completion?.choices?.[0]?.message?.content;
    
    if (!content || content.trim().length === 0) {
      console.error('[ZAI] Empty response');
      throw new Error('Empty response from ZAI');
    }
    
    console.log('[ZAI] Content length:', content.length);
    return content;
  } catch (error) {
    console.error('[ZAI] Error in processWithZAI:', error);
    throw error;
  }
}

// Función principal para procesar con IA
async function processWithAI(
  userMessage: string, 
  systemPrompt: string, 
  feedbacks: Array<{ triggerText: string; correction: string }>,
  conversationHistory: Array<{ role: string; content: string }>,
  knowledgeBase: Array<{ title: string; content: string; type: string }>,
  aiConfig: { provider: string; apiKey: string | null; model: string }
): Promise<string> {
  try {
    // Construir prompt mejorado
    let enhancedPrompt = systemPrompt;
    
    // Agregar base de conocimiento
    if (knowledgeBase.length > 0) {
      enhancedPrompt += '\n\n## Información del negocio:\n';
      knowledgeBase.forEach(kb => {
        enhancedPrompt += `\n**${kb.title}**:\n${kb.content}\n`;
      });
    }
    
    // Agregar aprendizajes
    if (feedbacks.length > 0) {
      enhancedPrompt += '\n\n## Aprendizajes:\n';
      feedbacks.forEach(fb => {
        enhancedPrompt += `- Si preguntan algo similar a "${fb.triggerText}", ${fb.correction}\n`;
      });
    }
    
    console.log('[AI] Provider:', aiConfig.provider);
    
    // Seleccionar provider
    switch (aiConfig.provider) {
      case 'openai':
        if (!aiConfig.apiKey) throw new Error('OpenAI API Key no configurada');
        return await processWithOpenAI(userMessage, enhancedPrompt, conversationHistory, aiConfig.apiKey, aiConfig.model);
      
      case 'gemini':
        if (!aiConfig.apiKey) throw new Error('Gemini API Key no configurada');
        return await processWithGemini(userMessage, enhancedPrompt, conversationHistory, aiConfig.apiKey, aiConfig.model);
      
      case 'zai':
      default:
        return await processWithZAI(userMessage, enhancedPrompt, conversationHistory);
    }
  } catch (error) {
    console.error('[AI] Error:', error);
    throw error;
  }
}

// Generar ID único
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// POST - Webhook de Telegram
export async function POST(request: NextRequest) {
  try {
    const body: TelegramUpdate = await request.json();
    
    console.log('[Telegram] Received:', JSON.stringify(body).substring(0, 200));
    
    if (!body.message || !body.message.text) {
      return NextResponse.json({ ok: true });
    }
    
    const { message } = body;
    const chatId = message.chat.id;
    const userId = message.from?.id.toString() || 'unknown';
    const userFirstName = message.from?.first_name;
    const userLastName = message.from?.last_name;
    const username = message.from?.username;
    const userMessage = message.text;
    
    console.log(`[Telegram] From ${userFirstName}: ${userMessage}`);
    
    const client = getClient();
    
    // Obtener configuración del bot
    const configResult = await client.execute('SELECT * FROM BotConfig LIMIT 1');
    const config = configResult.rows[0] as Record<string, unknown> | undefined;
    
    if (!config || !config.token || !config.isActive) {
      console.log('[Telegram] Bot not configured');
      return NextResponse.json({ ok: true });
    }
    
    const token = config.token as string;
    const systemPrompt = config.systemPrompt as string;
    let aiProvider = (config.aiProvider as string) || 'gemini';
    const aiApiKey = config.aiApiKey as string | null;
    let aiModel = (config.aiModel as string) || 'gemini-2.0-flash';
    
    // Corregir modelos inválidos automáticamente (modelos que ya no existen)
    const invalidModels = [
      'gemini-2.5-flash-preview-05-20',
      'gemini-2.5-pro-preview-05-06',
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-3.1-flash-lite',
      'gemini-3-flash',
      'gemini-3.1-pro',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-pro'
    ];
    
    if (invalidModels.includes(aiModel)) {
      console.log('[Webhook] Auto-fixing invalid model:', aiModel, '-> gemini-2.0-flash');
      aiModel = 'gemini-2.0-flash';
      // Actualizar en la BD
      try {
        await client.execute({
          sql: "UPDATE BotConfig SET aiModel = 'gemini-2.0-flash' WHERE id = ?",
          args: [config.id as string]
        });
        console.log('[Webhook] Model fixed in database');
      } catch (e) {
        console.log('[Webhook] Could not update model in DB:', e);
      }
    }
    
    console.log('[Webhook] Config:', {
      provider: aiProvider,
      hasApiKey: !!aiApiKey,
      model: aiModel,
      isActive: !!config.isActive
    });
    
    // Buscar o crear lead
    let leadId: string;
    let existingPhone: string | null = null;
    let existingFirstName: string | null = null;
    
    const leadResult = await client.execute({
      sql: 'SELECT * FROM Lead WHERE telegramId = ?',
      args: [userId]
    });
    
    if (leadResult.rows.length === 0) {
      leadId = generateId();
      await client.execute({
        sql: 'INSERT INTO Lead (id, telegramId, firstName, lastName, username, status) VALUES (?, ?, ?, ?, ?, ?)',
        args: [leadId, userId, userFirstName || null, userLastName || null, username || null, 'new']
      });
    } else {
      const lead = leadResult.rows[0] as Record<string, unknown>;
      leadId = lead.id as string;
      existingPhone = lead.phone as string | null;
      existingFirstName = lead.firstName as string | null;
    }
    
    // Guardar mensaje entrante
    await client.execute({
      sql: 'INSERT INTO Message (id, leadId, direction, content, messageType) VALUES (?, ?, ?, ?, ?)',
      args: [generateId(), leadId, 'incoming', userMessage, 'text']
    });
    
    // Obtener historial
    const historyResult = await client.execute({
      sql: 'SELECT direction, content FROM Message WHERE leadId = ? ORDER BY createdAt ASC LIMIT 20',
      args: [leadId]
    });
    
    const conversationHistory = historyResult.rows.map(r => ({
      role: (r.direction === 'incoming' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: r.content as string
    }));
    
    // Detectar feedback
    const isFeedback = userMessage.toLowerCase().includes('bot, no') || 
                       userMessage.toLowerCase().includes('bot no');
    
    if (isFeedback && conversationHistory.length > 0) {
      const lastIncoming = conversationHistory.filter(m => m.role === 'user').pop();
      const lastOutgoing = conversationHistory.filter(m => m.role === 'assistant').pop();
      
      await client.execute({
        sql: 'INSERT INTO Feedback (id, triggerText, badResponse, correction, category, isActive) VALUES (?, ?, ?, ?, ?, ?)',
        args: [generateId(), lastIncoming?.content || '', lastOutgoing?.content || null, userMessage, 'response_style', 1]
      });
      
      await sendTelegramMessage(token, chatId, '✅ *¡Gracias por tu feedback!* He aprendido de esta corrección.');
      return NextResponse.json({ ok: true });
    }
    
    // Extraer datos (incluyendo email)
    const extractedData = extractDataFromMessage(userMessage);
    
    // También obtener datos existentes del lead
    let leadEmail: string | null = null;
    const leadDataResult = await client.execute({
      sql: 'SELECT phone, firstName, email FROM Lead WHERE id = ?',
      args: [leadId]
    });
    if (leadDataResult.rows.length > 0) {
      const leadData = leadDataResult.rows[0] as Record<string, unknown>;
      existingPhone = leadData.phone as string | null;
      existingFirstName = leadData.firstName as string | null;
      leadEmail = leadData.email as string | null;
    }
    
    // Actualizar datos del lead si se encontraron nuevos
    if (extractedData.phone || extractedData.name || extractedData.email) {
      await client.execute({
        sql: 'UPDATE Lead SET phone = ?, firstName = ?, email = ?, status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
        args: [
          extractedData.phone || existingPhone, 
          extractedData.name || existingFirstName, 
          extractedData.email || leadEmail,
          'contacted', 
          leadId
        ]
      });
      if (extractedData.email) leadEmail = extractedData.email;
    }
    
    // Detectar intención de reserva
    const reservationIntent = detectReservationIntent(userMessage);
    
    if (reservationIntent.isReservation) {
      console.log('[Webhook] Reservation intent detected:', reservationIntent);
      
      // Verificar si Google Calendar está configurado
      const googleTokens = await getGoogleTokens();
      const hasGoogleConfig = !!(googleTokens.clientId && googleTokens.clientSecret && googleTokens.refreshToken && googleTokens.calendarId);
      
      if (hasGoogleConfig && reservationIntent.date && reservationIntent.time) {
        try {
          // Obtener access token
          const accessToken = await getGoogleAccessToken(
            googleTokens.clientId!,
            googleTokens.clientSecret!,
            googleTokens.refreshToken!
          );
          
          // Obtener datos del lead para la reserva
          const leadName = existingFirstName || userFirstName || 'Cliente';
          const leadPhone = existingPhone || undefined;
          
          // Crear evento en Google Calendar
          const event = await createGoogleCalendarEvent(accessToken, googleTokens.calendarId!, {
            leadName,
            leadEmail: leadEmail || undefined,
            leadPhone,
            date: reservationIntent.date,
            time: reservationIntent.time,
          });
          
          // Guardar reserva en BD
          await saveReservation({
            leadId,
            leadName,
            leadEmail: leadEmail || undefined,
            leadPhone,
            date: reservationIntent.date,
            time: reservationIntent.time,
          }, event.id, event.htmlLink);
          
          // Formatear fecha para respuesta
          const dateObj = new Date(reservationIntent.date);
          const formattedDate = dateObj.toLocaleDateString('es-ES', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          });
          
          // Enviar email de confirmación si hay email
          let emailSent = false;
          if (leadEmail) {
            emailSent = await sendConfirmationEmail(leadEmail, {
              leadName,
              date: reservationIntent.date,
              time: reservationIntent.time,
              googleEventLink: event.htmlLink,
            });
          }
          
          // Responder al usuario
          let responseMessage = `✅ *¡Reserva confirmada!*\n\n📅 ${formattedDate}\n🕐 ${reservationIntent.time}\n\nTu reserva ha sido guardada en el calendario.`;
          
          if (leadEmail && emailSent) {
            responseMessage += `\n\n📧 Te he enviado un email de confirmación a ${leadEmail}.`;
          } else if (!leadEmail) {
            responseMessage += `\n\n💡 *Tip:* Si me das tu email, te enviaré una confirmación.`;
          }
          
          await sendTelegramMessage(token, chatId, responseMessage);
          
          // Guardar mensaje saliente
          await client.execute({
            sql: 'INSERT INTO Message (id, leadId, direction, content, messageType) VALUES (?, ?, ?, ?, ?)',
            args: [generateId(), leadId, 'outgoing', responseMessage, 'text']
          });
          
          return NextResponse.json({ ok: true });
        } catch (error) {
          console.error('[Webhook] Reservation error:', error);
          // Continuar con el flujo normal si falla la reserva
        }
      } else if (!reservationIntent.date || !reservationIntent.time) {
        // Falta información de fecha/hora
        let responseMessage = '📅 *Para hacer tu reserva, necesito saber:*\n\n';
        if (!reservationIntent.date) responseMessage += '• ¿Qué día? (ej: mañana, lunes, 15 de enero)\n';
        if (!reservationIntent.time) responseMessage += '• ¿A qué hora? (ej: 3pm, 10:00)\n\n';
        responseMessage += 'Ejemplo: "Quiero reservar para el martes a las 4pm"';
        
        await sendTelegramMessage(token, chatId, responseMessage);
        
        await client.execute({
          sql: 'INSERT INTO Message (id, leadId, direction, content, messageType) VALUES (?, ?, ?, ?, ?)',
          args: [generateId(), leadId, 'outgoing', responseMessage, 'text']
        });
        
        return NextResponse.json({ ok: true });
      } else {
        // Google Calendar no está configurado
        console.log('[Webhook] Google Calendar not configured, passing to AI');
      }
    }
    
    // Obtener feedback y conocimiento
    let activeFeedbacks: Array<{ triggerText: string; correction: string }> = [];
    let knowledgeBase: Array<{ title: string; content: string; type: string }> = [];
    
    try {
      const feedbacksResult = await client.execute("SELECT triggerText, correction FROM Feedback WHERE isActive = 1 LIMIT 10");
      activeFeedbacks = feedbacksResult.rows.map(r => ({
        triggerText: r.triggerText as string,
        correction: r.correction as string
      }));
    } catch (e) {
      console.log('[Webhook] Could not fetch feedbacks:', e);
    }
    
    try {
      const knowledgeResult = await client.execute("SELECT title, content, type FROM KnowledgeBase WHERE isActive = 1");
      knowledgeBase = knowledgeResult.rows.map(r => ({
        title: r.title as string,
        content: r.content as string,
        type: r.type as string
      }));
    } catch (e) {
      console.log('[Webhook] Could not fetch knowledge base:', e);
    }
    
    // Determinar qué provider usar
    // Si no hay API key para el provider seleccionado, usar z-ai como fallback
    let effectiveProvider = aiProvider;
    let effectiveApiKey = aiApiKey;
    
    console.log('[Webhook] DEBUG - aiProvider:', aiProvider);
    console.log('[Webhook] DEBUG - aiApiKey exists:', !!aiApiKey);
    console.log('[Webhook] DEBUG - aiApiKey value:', aiApiKey ? `${aiApiKey.substring(0, 10)}...` : 'NULL');
    console.log('[Webhook] DEBUG - aiModel:', aiModel);
    
    if (aiProvider !== 'zai' && !aiApiKey) {
      console.log('[Webhook] No API key for', aiProvider, ', falling back to z-ai');
      effectiveProvider = 'zai';
      effectiveApiKey = null;
    }
    
    // Procesar con IA
    let aiResponse: string;
    try {
      console.log('[Webhook] Processing with AI:', { 
        provider: effectiveProvider, 
        hasApiKey: !!effectiveApiKey, 
        model: aiModel,
        knowledgeCount: knowledgeBase.length,
        feedbackCount: activeFeedbacks.length
      });
      
      aiResponse = await processWithAI(
        userMessage,
        systemPrompt,
        activeFeedbacks,
        conversationHistory,
        knowledgeBase,
        { provider: effectiveProvider, apiKey: effectiveApiKey, model: aiModel }
      );
      
      console.log('[Webhook] AI response generated successfully');
    } catch (aiError) {
      const errorMessage = aiError instanceof Error ? aiError.message : 'Unknown error';
      console.error('[Webhook] AI Error:', errorMessage, aiError);
      
      // Intentar con z-ai como último recurso
      if (effectiveProvider !== 'zai') {
        console.log('[Webhook] Trying z-ai as fallback...');
        try {
          aiResponse = await processWithZAI(userMessage, systemPrompt, conversationHistory);
        } catch (fallbackError) {
          console.error('[Webhook] Fallback also failed:', fallbackError);
          aiResponse = 'Disculpa, estoy teniendo problemas técnicos. Por favor intenta de nuevo en un momento.';
        }
      } else {
        // Proporcionar un mensaje más útil basado en el tipo de error
        if (errorMessage.includes('API_KEY_QUOTA_EXCEEDED')) {
          aiResponse = '⚠️ Tu API key de Gemini alcanzó el límite de uso gratuito.\n\nOpciones:\n1. Espera unos minutos\n2. Crea una nueva API key en: aistudio.google.com/app/apikey';
        } else if (errorMessage.includes('API_KEY_REGION_BLOCKED')) {
          aiResponse = '⚠️ Tu API key de Gemini tiene restricciones de ubicación.\n\nVe a aistudio.google.com/app/apikey y crea una nueva API key SIN restricciones.';
        } else if (errorMessage.includes('API_KEY_INVALID')) {
          aiResponse = '⚠️ Tu API key no es válida. Verifica que esté correcta en la configuración.';
        } else if (errorMessage.includes('API Key')) {
          aiResponse = '⚠️ El bot necesita configuración. Por favor contacta al administrador para configurar la API Key.';
        } else if (errorMessage.includes('Modelo no encontrado')) {
          aiResponse = '⚠️ El modelo de IA seleccionado no está disponible. Selecciona otro modelo en la configuración.';
        } else if (errorMessage.includes('Empty response')) {
          aiResponse = 'Lo siento, no pude generar una respuesta. ¿Podrías reformular tu pregunta?';
        } else {
          aiResponse = 'Disculpa, estoy teniendo problemas técnicos. Por favor intenta de nuevo en un momento.';
        }
      }
    }
    
    // Guardar mensaje saliente
    await client.execute({
      sql: 'INSERT INTO Message (id, leadId, direction, content, messageType) VALUES (?, ?, ?, ?, ?)',
      args: [generateId(), leadId, 'outgoing', aiResponse, 'text']
    });
    
    // Enviar respuesta
    await sendTelegramMessage(token, chatId, aiResponse);
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Telegram] Webhook error:', error);
    return NextResponse.json({ ok: true });
  }
}

// GET - Verificar estado
export async function GET() {
  return NextResponse.json({
    status: 'active',
    message: 'Telegram webhook endpoint is ready',
    timestamp: new Date().toISOString()
  });
}
