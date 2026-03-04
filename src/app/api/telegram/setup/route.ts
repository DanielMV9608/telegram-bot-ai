import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

const getClient = () => createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

// POST - Configurar webhook en Telegram
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, webhookUrl, token } = body;
    
    const client = getClient();
    
    // Obtener configuración actual
    const configResult = await client.execute('SELECT * FROM BotConfig LIMIT 1');
    const config = configResult.rows[0] as Record<string, unknown> | undefined;
    
    // Si se envía token nuevo, guardarlo primero
    let botToken = token || config?.token;
    
    if (!botToken) {
      return NextResponse.json({ 
        success: false, 
        error: 'No hay token configurado. Pega el token de tu bot primero.' 
      }, { status: 400 });
    }
    
    if (action === 'set') {
      if (!webhookUrl) {
        return NextResponse.json({ 
          success: false, 
          error: 'URL del webhook es requerida' 
        }, { status: 400 });
      }
      
      console.log('[Setup] Setting webhook to:', `${webhookUrl}/api/telegram/webhook`);
      
      // Configurar webhook en Telegram
      const url = `https://api.telegram.org/bot${botToken}/setWebhook`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: `${webhookUrl}/api/telegram/webhook`,
          allowed_updates: ['message']
        })
      });
      
      const result = await response.json();
      console.log('[Setup] Telegram response:', result);
      
      if (result.ok) {
        // Obtener info del bot
        const meUrl = `https://api.telegram.org/bot${botToken}/getMe`;
        const meResponse = await fetch(meUrl);
        const meResult = await meResponse.json();
        
        // Actualizar en base de datos
        await client.execute({
          sql: "UPDATE BotConfig SET token = ?, webhookUrl = ?, botUsername = ?, isActive = 1, updatedAt = CURRENT_TIMESTAMP WHERE id = 'default'",
          args: [botToken, webhookUrl, meResult.ok ? meResult.result.username : null]
        });
        
        return NextResponse.json({
          success: true,
          message: 'Webhook configurado correctamente',
          botUsername: meResult.ok ? meResult.result.username : null
        });
      } else {
        return NextResponse.json({
          success: false,
          error: result.description || 'Error al configurar webhook'
        });
      }
    } else if (action === 'delete') {
      // Eliminar webhook
      const url = `https://api.telegram.org/bot${botToken}/deleteWebhook`;
      const response = await fetch(url);
      const result = await response.json();
      
      if (result.ok) {
        await client.execute({
          sql: "UPDATE BotConfig SET webhookUrl = NULL, isActive = 0, updatedAt = CURRENT_TIMESTAMP WHERE id = 'default'",
          args: []
        });
        
        return NextResponse.json({
          success: true,
          message: 'Webhook eliminado correctamente'
        });
      } else {
        return NextResponse.json({
          success: false,
          error: result.description || 'Error al eliminar webhook'
        });
      }
    } else if (action === 'info') {
      // Obtener info del webhook
      const url = `https://api.telegram.org/bot${botToken}/getWebhookInfo`;
      const response = await fetch(url);
      const result = await response.json();
      
      return NextResponse.json({
        success: true,
        webhookInfo: result.result
      });
    }
    
    return NextResponse.json({ 
      success: false, 
      error: 'Acción no válida' 
    }, { status: 400 });
  } catch (error) {
    console.error('Error in webhook setup:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error al procesar solicitud',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
