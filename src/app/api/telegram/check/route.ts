import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

const getClient = () => createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export async function GET() {
  try {
    const client = getClient();
    
    // Obtener configuración
    const configResult = await client.execute('SELECT * FROM BotConfig LIMIT 1');
    const config = configResult.rows[0] as Record<string, unknown>;
    
    if (!config || !config.token) {
      return NextResponse.json({
        success: false,
        error: 'No hay token configurado',
        step: 'Configura el token del bot en el dashboard'
      });
    }
    
    const token = config.token as string;
    
    // Verificar webhook con Telegram
    const webhookUrl = `https://api.telegram.org/bot${token}/getWebhookInfo`;
    const response = await fetch(webhookUrl);
    const webhookInfo = await response.json();
    
    // Verificar info del bot
    const meUrl = `https://api.telegram.org/bot${token}/getMe`;
    const meResponse = await fetch(meUrl);
    const meInfo = await meResponse.json();
    
    return NextResponse.json({
      success: true,
      bot: meInfo.ok ? {
        username: meInfo.result?.username,
        first_name: meInfo.result?.first_name,
        is_bot: meInfo.result?.is_bot
      } : null,
      webhook: webhookInfo.ok ? {
        url: webhookInfo.result?.url,
        has_custom_certificate: webhookInfo.result?.has_custom_certificate,
        pending_update_count: webhookInfo.result?.pending_update_count,
        last_error_date: webhookInfo.result?.last_error_date,
        last_error_message: webhookInfo.result?.last_error_message,
        max_connections: webhookInfo.result?.max_connections
      } : null,
      tokenValid: meInfo.ok,
      needsSetup: !webhookInfo.result?.url || webhookInfo.result?.url === ''
    });
    
  } catch (error) {
    console.error('Error checking webhook:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
