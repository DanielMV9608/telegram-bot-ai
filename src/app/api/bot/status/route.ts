import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const config = await db.botConfig.findFirst();
    
    // Obtener estadísticas de hoy
    const today = new Date().toISOString().split('T')[0];
    const todayStats = await db.botStats.findUnique({
      where: { date: today }
    });
    
    // Contar leads totales
    const totalLeads = await db.lead.count();
    
    // Contar leads de hoy
    const todayLeads = await db.lead.count({
      where: {
        createdAt: {
          gte: new Date(today)
        }
      }
    });
    
    // Contar mensajes de hoy
    const todayMessages = await db.message.count({
      where: {
        createdAt: {
          gte: new Date(today)
        }
      }
    });

    // Contar feedback activo
    const activeFeedback = await db.feedback.count({
      where: { isActive: true }
    });
    
    return NextResponse.json({
      success: true,
      status: {
        isConnected: config?.isActive && !!config?.token,
        isActive: config?.isActive || false,
        hasToken: !!config?.token,
        botUsername: config?.botUsername || null,
        todayStats: {
          messagesIn: todayStats?.messagesIn || 0,
          messagesOut: todayStats?.messagesOut || 0,
          leadsCaptured: todayStats?.leadsCaptured || 0,
          uniqueUsers: todayStats?.uniqueUsers || 0
        },
        totalLeads,
        todayLeads,
        todayMessages,
        activeFeedback
      }
    });
  } catch (error) {
    console.error('Error getting bot status:', error);
    return NextResponse.json({ success: false, error: 'Error al obtener estado' }, { status: 500 });
  }
}
