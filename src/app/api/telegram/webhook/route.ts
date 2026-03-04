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
  model: string = 'gemini-2.5-flash'
): Promise<string> {
  try {
    // Construir el contexto
    let context = systemPrompt + '\n\n';
    
    // Agregar historial
    const recentHistory = conversationHistory.slice(-10);
    for (const msg of recentHistory) {
      context += `${msg.role === 'user' ? 'Usuario' : 'Asistente'}: ${msg.content}\n`;
    }
    
    // Gemini 2.5 y 3 usan una API diferente (v1beta o v1)
    const apiVersion = model.startsWith('gemini-3') ? 'v1' : 'v1beta';
    const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`;
    
    console.log('[Gemini] Using model:', model, 'API version:', apiVersion);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `${context}\nUsuario: ${userMessage}\nAsistente:`
          }]
        }],
        generationConfig: {
          maxOutputTokens: 1000,
          temperature: 0.7
        }
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Gemini] API Error:', response.status, errorData);
      throw new Error(`Gemini API error: ${response.status}`);
    }
    
    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content || content.trim().length === 0) {
      console.error('[Gemini] Empty response:', data);
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
    const aiProvider = (config.aiProvider as string) || 'gemini';
    const aiApiKey = config.aiApiKey as string | null;
    const aiModel = (config.aiModel as string) || 'gemini-2.5-flash';
    
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
    
    // Extraer datos
    const extractedData = extractDataFromMessage(userMessage);
    
    if (extractedData.phone || extractedData.name) {
      await client.execute({
        sql: 'UPDATE Lead SET phone = ?, firstName = ?, status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
        args: [extractedData.phone || existingPhone, extractedData.name || existingFirstName, 'contacted', leadId]
      });
    }
    
    // Obtener feedback y conocimiento
    const feedbacksResult = await client.execute("SELECT triggerText, correction FROM Feedback WHERE isActive = 1 LIMIT 10");
    const activeFeedbacks = feedbacksResult.rows.map(r => ({
      triggerText: r.triggerText as string,
      correction: r.correction as string
    }));
    
    const knowledgeResult = await client.execute("SELECT title, content, type FROM KnowledgeBase WHERE isActive = 1");
    const knowledgeBase = knowledgeResult.rows.map(r => ({
      title: r.title as string,
      content: r.content as string,
      type: r.type as string
    }));
    
    // Procesar con IA
    let aiResponse: string;
    try {
      console.log('[Webhook] Processing with AI:', { 
        provider: aiProvider, 
        hasApiKey: !!aiApiKey, 
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
        { provider: aiProvider, apiKey: aiApiKey, model: aiModel }
      );
      
      console.log('[Webhook] AI response generated successfully');
    } catch (aiError) {
      const errorMessage = aiError instanceof Error ? aiError.message : 'Unknown error';
      console.error('[Webhook] AI Error:', errorMessage, aiError);
      
      // Proporcionar un mensaje más útil basado en el tipo de error
      if (errorMessage.includes('API Key')) {
        aiResponse = '⚠️ El bot necesita configuración. Por favor contacta al administrador para configurar la API Key.';
      } else if (errorMessage.includes('Empty response')) {
        aiResponse = 'Lo siento, no pude generar una respuesta. ¿Podrías reformular tu pregunta?';
      } else {
        aiResponse = 'Disculpa, estoy teniendo problemas técnicos. Por favor intenta de nuevo en un momento.';
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
