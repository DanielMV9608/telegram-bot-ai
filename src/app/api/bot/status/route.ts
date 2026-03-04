import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

const getClient = () => createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export async function GET() {
  try {
    const client = getClient();
    
    // Obtener configuración del bot
    const configResult = await client.execute('SELECT * FROM BotConfig LIMIT 1');
    const config = configResult.rows[0] as Record<string, unknown> | undefined;
    
    // Contar leads totales
    const totalLeadsResult = await client.execute('SELECT COUNT(*) as count FROM Lead');
    const totalLeads = Number(totalLeadsResult.rows[0]?.count || 0);
    
    // Contar leads de hoy
    const today = new Date().toISOString().split('T')[0];
    const todayLeadsResult = await client.execute({
      sql: "SELECT COUNT(*) as count FROM Lead WHERE date(createdAt) = ?",
      args: [today]
    });
    const todayLeads = Number(todayLeadsResult.rows[0]?.count || 0);
    
    // Contar mensajes de hoy
    const todayMessagesResult = await client.execute({
      sql: "SELECT COUNT(*) as count FROM Message WHERE date(createdAt) = ?",
      args: [today]
    });
    const todayMessages = Number(todayMessagesResult.rows[0]?.count || 0);
    
    // Contar feedback activo
    const activeFeedbackResult = await client.execute("SELECT COUNT(*) as count FROM Feedback WHERE isActive = 1");
    const activeFeedback = Number(activeFeedbackResult.rows[0]?.count || 0);
    
    return NextResponse.json({
      success: true,
      status: {
        isConnected: Boolean(config?.isActive) && !!config?.token,
        isActive: Boolean(config?.isActive),
        hasToken: !!config?.token,
        botUsername: config?.botUsername || null,
        todayStats: {
          messagesIn: 0,
          messagesOut: 0,
          leadsCaptured: todayLeads,
          uniqueUsers: 0
        },
        totalLeads,
        todayLeads,
        todayMessages,
        activeFeedback
      }
    });
  } catch (error) {
    console.error('Error getting bot status:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error al obtener estado',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
