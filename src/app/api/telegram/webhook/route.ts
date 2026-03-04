import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

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

// Función para actualizar estadísticas
async function updateStats(type: 'in' | 'out' | 'lead', uniqueUserId?: string) {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    const existing = await db.botStats.findUnique({
      where: { date: today }
    });
    
    if (existing) {
      const updateData: Record<string, number> = {};
      if (type === 'in') updateData.messagesIn = existing.messagesIn + 1;
      if (type === 'out') updateData.messagesOut = existing.messagesOut + 1;
      if (type === 'lead') updateData.leadsCaptured = existing.leadsCaptured + 1;
      
      await db.botStats.update({
        where: { date: today },
        data: updateData
      });
    } else {
      await db.botStats.create({
        data: {
          date: today,
          messagesIn: type === 'in' ? 1 : 0,
          messagesOut: type === 'out' ? 1 : 0,
          leadsCaptured: type === 'lead' ? 1 : 0,
          uniqueUsers: 1
        }
      });
    }
  } catch (error) {
    console.error('Error updating stats:', error);
  }
}

// POST - Webhook de Telegram
export async function POST(request: NextRequest) {
  try {
    const body: TelegramUpdate = await request.json();
    
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
    
    // Obtener configuración del bot
    const config = await db.botConfig.findFirst();
    
    if (!config || !config.token || !config.isActive) {
      console.log('[Telegram] Bot not configured or inactive');
      return NextResponse.json({ ok: true });
    }
    
    // Buscar o crear lead
    let lead = await db.lead.findFirst({
      where: { telegramId: userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 20
        }
      }
    });
    
    if (!lead) {
      lead = await db.lead.create({
        data: {
          telegramId: userId,
          firstName: userFirstName,
          lastName: userLastName,
          username,
          status: 'new'
        },
        include: { messages: [] }
      });
      console.log(`[Telegram] New lead created: ${userId}`);
    }
    
    // Guardar mensaje entrante
    await db.message.create({
      data: {
        leadId: lead.id,
        direction: 'incoming',
        content: userMessage,
        messageType: 'text'
      }
    });
    
    // Actualizar estadísticas
    await updateStats('in');
    
    // Detectar si el usuario quiere dar feedback/corrección al bot
    const isFeedback = userMessage.toLowerCase().includes('bot, no') || 
                       userMessage.toLowerCase().includes('bot no') ||
                       userMessage.toLowerCase().includes('no digas') ||
                       userMessage.toLowerCase().includes('no respondas');
    
    if (isFeedback && lead.messages.length > 0) {
      // Guardar como feedback para aprendizaje
      const lastBotMessage = lead.messages.filter(m => m.direction === 'outgoing').pop();
      
      await db.feedback.create({
        data: {
          triggerText: lead.messages.filter(m => m.direction === 'incoming').pop()?.content || '',
          badResponse: lastBotMessage?.content,
          correction: userMessage,
          category: 'response_style',
          isActive: true
        }
      });
      
      await sendTelegramMessage(
        config.token,
        chatId,
        '✅ *¡Gracias por tu feedback!* He aprendido de esta corrección y mejoraré mis respuestas futuras.'
      );
      
      return NextResponse.json({ ok: true });
    }
    
    // Extraer datos del mensaje
    const extractedData = extractDataFromMessage(userMessage);
    
    // Actualizar lead si encontramos datos nuevos
    if (extractedData.phone || extractedData.name) {
      await db.lead.update({
        where: { id: lead.id },
        data: {
          phone: extractedData.phone || lead.phone,
          firstName: extractedData.name || lead.firstName,
          status: 'contacted'
        }
      });
      
      if (!lead.phone && extractedData.phone) {
        await updateStats('lead');
        console.log(`[Telegram] Lead data captured: ${extractedData.name} - ${extractedData.phone}`);
      }
    }
    
    // Obtener feedback activo para aprendizaje
    const activeFeedbacks = await db.feedback.findMany({
      where: { isActive: true },
      take: 10
    });
    
    // Construir historial de conversación
    const conversationHistory = lead.messages.map(m => ({
      role: m.direction === 'incoming' ? 'user' : 'assistant',
      content: m.content
    }));
    
    // Procesar con IA
    const aiResponse = await processWithAI(
      userMessage,
      config.systemPrompt,
      activeFeedbacks.map(f => ({ triggerText: f.triggerText, correction: f.correction })),
      conversationHistory
    );
    
    // Guardar mensaje saliente
    await db.message.create({
      data: {
        leadId: lead.id,
        direction: 'outgoing',
        content: aiResponse,
        messageType: 'text'
      }
    });
    
    // Actualizar estadísticas
    await updateStats('out');
    
    // Enviar respuesta a Telegram
    await sendTelegramMessage(config.token, chatId, aiResponse);
    
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
