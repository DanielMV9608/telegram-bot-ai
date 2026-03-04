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

// Función para extraer datos del mensaje (nombre, teléfono)
function extractDataFromMessage(text: string): { name?: string; phone?: string } {
  const result: { name?: string; phone?: string } = {};
  
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
  
  return result;
}

// Función para procesar mensaje con IA
async function processWithAI(
  userMessage: string, 
  systemPrompt: string, 
  feedbacks: Array<{ triggerText: string; correction: string }>,
  conversationHistory: Array<{ role: string; content: string }>
): Promise<string> {
  try {
    const zai = await ZAI.create();
    
    // Construir prompt con feedbacks de aprendizaje
    let enhancedPrompt = systemPrompt;
    
    if (feedbacks.length > 0) {
      enhancedPrompt += '\n\n## Aprendizajes previos (aplica estas correcciones):\n';
      feedbacks.forEach(fb => {
        enhancedPrompt += `- Cuando el usuario diga algo similar a "${fb.triggerText}", ${fb.correction}\n`;
      });
    }
    
    // Construir mensajes para el chat
    const messages: Array<{ role: 'assistant' | 'user'; content: string }> = [
      { role: 'assistant', content: enhancedPrompt }
    ];
    
    // Agregar historial de conversación (últimos 10 mensajes)
    const recentHistory = conversationHistory.slice(-10);
    messages.push(...recentHistory.map(m => ({
      role: m.role as 'assistant' | 'user',
      content: m.content
    })));
    
    // Agregar mensaje actual
    messages.push({ role: 'user', content: userMessage });
    
    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: 'disabled' }
    });
    
    return completion.choices[0]?.message?.content || 'Lo siento, no pude procesar tu mensaje. ¿Podrías repetirlo?';
  } catch (error) {
    console.error('Error processing with AI:', error);
    return 'Gracias por tu mensaje. Un momento mientras proceso tu solicitud...';
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
    
    console.log('[Telegram] Received update:', JSON.stringify(body));
    
    // Verificar que sea un mensaje válido
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
    
    console.log(`[Telegram] Message from ${userFirstName} (${userId}): ${userMessage}`);
    
    const client = getClient();
    
    // Obtener configuración del bot
    const configResult = await client.execute('SELECT * FROM BotConfig LIMIT 1');
    const config = configResult.rows[0] as Record<string, unknown> | undefined;
    
    if (!config || !config.token || !config.isActive) {
      console.log('[Telegram] Bot not configured or inactive');
      return NextResponse.json({ ok: true });
    }
    
    const token = config.token as string;
    const systemPrompt = config.systemPrompt as string;
    
    // Buscar o crear lead
    let leadId: string;
    let existingPhone: string | null = null;
    let existingFirstName: string | null = null;
    
    const leadResult = await client.execute({
      sql: 'SELECT * FROM Lead WHERE telegramId = ?',
      args: [userId]
    });
    
    if (leadResult.rows.length === 0) {
      // Crear nuevo lead
      leadId = generateId();
      await client.execute({
        sql: 'INSERT INTO Lead (id, telegramId, firstName, lastName, username, status) VALUES (?, ?, ?, ?, ?, ?)',
        args: [leadId, userId, userFirstName || null, userLastName || null, username || null, 'new']
      });
      console.log(`[Telegram] New lead created: ${userId}`);
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
    
    // Obtener historial de conversación
    const historyResult = await client.execute({
      sql: 'SELECT direction, content FROM Message WHERE leadId = ? ORDER BY createdAt ASC LIMIT 20',
      args: [leadId]
    });
    
    const conversationHistory = historyResult.rows.map(r => ({
      role: (r.direction === 'incoming' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: r.content as string
    }));
    
    // Detectar si el usuario quiere dar feedback/corrección al bot
    const isFeedback = userMessage.toLowerCase().includes('bot, no') || 
                       userMessage.toLowerCase().includes('bot no') ||
                       userMessage.toLowerCase().includes('no digas') ||
                       userMessage.toLowerCase().includes('no respondas');
    
    if (isFeedback && conversationHistory.length > 0) {
      // Guardar como feedback para aprendizaje
      const lastIncoming = conversationHistory.filter(m => m.role === 'user').pop();
      const lastOutgoing = conversationHistory.filter(m => m.role === 'assistant').pop();
      
      await client.execute({
        sql: 'INSERT INTO Feedback (id, triggerText, badResponse, correction, category, isActive) VALUES (?, ?, ?, ?, ?, ?)',
        args: [generateId(), lastIncoming?.content || '', lastOutgoing?.content || null, userMessage, 'response_style', 1]
      });
      
      await sendTelegramMessage(
        token,
        chatId,
        '✅ *¡Gracias por tu feedback!* He aprendido de esta corrección y mejoraré mis respuestas futuras.'
      );
      
      return NextResponse.json({ ok: true });
    }
    
    // Extraer datos del mensaje
    const extractedData = extractDataFromMessage(userMessage);
    
    // Actualizar lead si encontramos datos nuevos
    if (extractedData.phone || extractedData.name) {
      await client.execute({
        sql: 'UPDATE Lead SET phone = ?, firstName = ?, status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
        args: [
          extractedData.phone || existingPhone,
          extractedData.name || existingFirstName,
          'contacted',
          leadId
        ]
      });
      
      if (!existingPhone && extractedData.phone) {
        console.log(`[Telegram] Lead data captured: ${extractedData.name} - ${extractedData.phone}`);
      }
    }
    
    // Obtener feedback activo para aprendizaje
    const feedbacksResult = await client.execute("SELECT triggerText, correction FROM Feedback WHERE isActive = 1 LIMIT 10");
    const activeFeedbacks = feedbacksResult.rows.map(r => ({
      triggerText: r.triggerText as string,
      correction: r.correction as string
    }));
    
    // Procesar con IA
    const aiResponse = await processWithAI(
      userMessage,
      systemPrompt,
      activeFeedbacks,
      conversationHistory
    );
    
    // Guardar mensaje saliente
    await client.execute({
      sql: 'INSERT INTO Message (id, leadId, direction, content, messageType) VALUES (?, ?, ?, ?, ?)',
      args: [generateId(), leadId, 'outgoing', aiResponse, 'text']
    });
    
    // Enviar respuesta a Telegram
    await sendTelegramMessage(token, chatId, aiResponse);
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Telegram] Webhook error:', error);
    return NextResponse.json({ ok: true }); // Siempre retornar ok a Telegram
  }
}

// GET - Verificar estado del webhook
export async function GET() {
  return NextResponse.json({
    status: 'active',
    message: 'Telegram webhook endpoint is ready',
    timestamp: new Date().toISOString()
  });
}
