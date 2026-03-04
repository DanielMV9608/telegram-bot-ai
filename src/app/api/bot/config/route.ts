import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Obtener configuración actual del bot
export async function GET() {
  try {
    const configs = await db.botConfig.findMany();
    let config = configs[0];
    
    if (!config) {
      config = await db.botConfig.create({
        data: {
          id: 'default',
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
    };
    
    return NextResponse.json({ success: true, config: safeConfig });
  } catch (error) {
    console.error('Error getting bot config:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error al obtener configuración',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST - Actualizar configuración del bot
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, systemPrompt, isActive } = body;
    
    console.log('[Config] Updating config:', { hasToken: !!token, hasSystemPrompt: !!systemPrompt, isActive });
    
    // Buscar config existente
    const configs = await db.botConfig.findMany();
    const existingConfig = configs[0];
    
    if (!existingConfig) {
      // Crear nueva config
      const newConfig = await db.botConfig.create({
        data: {
          id: 'default',
          token: token || null,
          systemPrompt: systemPrompt || 'Eres un asistente amable.',
          isActive: isActive ?? false
        }
      });
      
      console.log('[Config] Created new config');
      
      return NextResponse.json({ 
        success: true, 
        config: {
          ...newConfig,
          token: newConfig.token ? `${newConfig.token.substring(0, 10)}...` : null,
        }
      });
    }
    
    // Actualizar config existente
    const updateData: Record<string, unknown> = {};
    
    if (token !== undefined) updateData.token = token;
    if (systemPrompt !== undefined) updateData.systemPrompt = systemPrompt;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    console.log('[Config] Update data:', updateData);
    
    const updatedConfig = await db.botConfig.update({
      where: { id: existingConfig.id },
      data: updateData
    });
    
    console.log('[Config] Updated successfully');
    
    return NextResponse.json({ 
      success: true, 
      config: {
        ...updatedConfig,
        token: updatedConfig.token ? `${updatedConfig.token.substring(0, 10)}...` : null,
      }
    });
  } catch (error) {
    console.error('Error updating bot config:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error al guardar token',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
