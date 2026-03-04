import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Obtener configuración actual del bot
export async function GET() {
  try {
    let config = await db.botConfig.findFirst();
    
    if (!config) {
      config = await db.botConfig.create({
        data: {
          systemPrompt: `Eres un asistente de atención al cliente amable y profesional. Tu objetivo es ayudar a los clientes y capturar sus datos (nombre y número de teléfono) cuando muestren interés en los servicios.

Instrucciones:
1. Sé cordial y útil en todo momento
2. Si el cliente pregunta por servicios, explica brevemente y pregunta si le gustaría más información
3. Cuando el cliente muestre interés, pide su nombre y número de teléfono de forma natural
4. Nunca presiones demasiado
5. Si el cliente te da sus datos, agradécele y confírmale que alguien se pondrá en contacto pronto

Responde siempre en el mismo idioma que el cliente use.`
        }
      });
    }
    
    // No exponer el token completo por seguridad
    const safeConfig = {
      ...config,
      token: config.token ? `${config.token.substring(0, 10)}...` : null,
      fullToken: config.token // Solo para uso interno
    };
    
    return NextResponse.json({ success: true, config: safeConfig });
  } catch (error) {
    console.error('Error getting bot config:', error);
    return NextResponse.json({ success: false, error: 'Error al obtener configuración' }, { status: 500 });
  }
}

// POST - Actualizar configuración del bot
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, systemPrompt, isActive } = body;
    
    let config = await db.botConfig.findFirst();
    
    if (!config) {
      config = await db.botConfig.create({
        data: {
          token: token || null,
          systemPrompt: systemPrompt || '',
          isActive: isActive ?? false
        }
      });
    } else {
      const updateData: Record<string, unknown> = {};
      
      if (token !== undefined) updateData.token = token;
      if (systemPrompt !== undefined) updateData.systemPrompt = systemPrompt;
      if (isActive !== undefined) updateData.isActive = isActive;
      
      config = await db.botConfig.update({
        where: { id: config.id },
        data: updateData
      });
    }
    
    return NextResponse.json({ 
      success: true, 
      config: {
        ...config,
        token: config.token ? `${config.token.substring(0, 10)}...` : null,
        fullToken: config.token
      }
    });
  } catch (error) {
    console.error('Error updating bot config:', error);
    return NextResponse.json({ success: false, error: 'Error al actualizar configuración' }, { status: 500 });
  }
}
