import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST - Configurar webhook en Telegram
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, webhookUrl } = body;
    
    const config = await db.botConfig.findFirst();
    
    if (!config || !config.token) {
      return NextResponse.json({ 
        success: false, 
        error: 'No hay token configurado' 
      }, { status: 400 });
    }
    
    if (action === 'set') {
      if (!webhookUrl) {
        return NextResponse.json({ 
          success: false, 
          error: 'URL del webhook es requerida' 
        }, { status: 400 });
      }
      
      // Configurar webhook en Telegram
      const url = `https://api.telegram.org/bot${config.token}/setWebhook`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: `${webhookUrl}/api/telegram/webhook`,
          allowed_updates: ['message']
        })
      });
      
      const result = await response.json();
      
      if (result.ok) {
        // Obtener info del bot
        const meUrl = `https://api.telegram.org/bot${config.token}/getMe`;
        const meResponse = await fetch(meUrl);
        const meResult = await meResponse.json();
        
        await db.botConfig.update({
          where: { id: config.id },
          data: {
            webhookUrl,
            botUsername: meResult.ok ? meResult.result.username : null,
            isActive: true
          }
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
      const url = `https://api.telegram.org/bot${config.token}/deleteWebhook`;
      const response = await fetch(url);
      const result = await response.json();
      
      if (result.ok) {
        await db.botConfig.update({
          where: { id: config.id },
          data: {
            webhookUrl: null,
            isActive: false
          }
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
      const url = `https://api.telegram.org/bot${config.token}/getWebhookInfo`;
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
      error: 'Error al procesar solicitud' 
    }, { status: 500 });
  }
}
