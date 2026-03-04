import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

const getClient = () => createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

// Función para obtener tokens de Google
async function getGoogleTokens() {
  const client = getClient();
  const result = await client.execute('SELECT googleClientId, googleClientSecret, googleRefreshToken, googleCalendarId FROM BotConfig LIMIT 1');
  const config = result.rows[0] as Record<string, unknown> | undefined;
  
  return {
    clientId: config?.googleClientId as string | null,
    clientSecret: config?.googleClientSecret as string | null,
    refreshToken: config?.googleRefreshToken as string | null,
    calendarId: config?.googleCalendarId as string | null,
  };
}

// Función para obtener access token de Google
async function getGoogleAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to refresh Google access token');
  }
  
  const data = await response.json();
  return data.access_token;
}

// Función para crear evento en Google Calendar
async function createGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  reservation: { 
    name: string; 
    email?: string; 
    phone?: string; 
    date: string; 
    time: string;
    space?: string;
    people?: number;
  }
): Promise<{ id: string; htmlLink: string }> {
  const startDateTime = new Date(`${reservation.date}T${reservation.time}`);
  const endDateTime = new Date(startDateTime.getTime() + 60 * 60000);
  
  const event = {
    summary: `Reserva - ${reservation.name}${reservation.people ? ` (${reservation.people} personas)` : ''}`,
    description: `Reserva realizada via Telegram Bot
Cliente: ${reservation.name}
Teléfono: ${reservation.phone || 'No proporcionado'}
Email: ${reservation.email || 'No proporcionado'}
Espacio: ${reservation.space || 'Sala de Juntas'}`,
    start: {
      dateTime: startDateTime.toISOString(),
      timeZone: 'America/Mexico_City',
    },
    end: {
      dateTime: endDateTime.toISOString(),
      timeZone: 'America/Mexico_City',
    },
    attendees: reservation.email ? [{ email: reservation.email }] : [],
  };
  
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    console.error('[Google Calendar] Error:', error);
    throw new Error(`Google Calendar error: ${response.status}`);
  }
  
  const data = await response.json();
  return { id: data.id, htmlLink: data.htmlLink };
}

// Función para enviar email de confirmación
async function sendConfirmationEmail(
  to: string,
  reservation: { name: string; date: string; time: string; googleEventLink?: string }
): Promise<boolean> {
  try {
    const client = getClient();
    const configResult = await client.execute('SELECT resendApiKey, emailFrom FROM BotConfig LIMIT 1');
    const config = configResult.rows[0] as Record<string, unknown> | undefined;
    
    const resendApiKey = (config?.resendApiKey as string) || process.env.RESEND_API_KEY;
    const emailFrom = config?.emailFrom as string;
    
    if (!resendApiKey || !emailFrom) {
      console.log('[Email] Email not configured');
      return false;
    }
    
    const dateObj = new Date(reservation.date);
    const formattedDate = dateObj.toLocaleDateString('es-ES', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981, #14b8a6); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1>✅ Reserva Confirmada</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>Hola ${reservation.name},</p>
          <p>Tu reserva ha sido confirmada:</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>📅 Fecha:</strong> ${formattedDate}</p>
            <p><strong>🕐 Hora:</strong> ${reservation.time}</p>
            <p><strong>⏱️ Duración:</strong> 60 minutos</p>
          </div>
          ${reservation.googleEventLink ? `<a href="${reservation.googleEventLink}" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Ver en Google Calendar</a>` : ''}
          <p style="margin-top: 20px;">¡Gracias por elegir Cúspide & Grano!</p>
        </div>
      </body>
      </html>
    `;
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [to],
        subject: `✅ Reserva Confirmada - ${formattedDate} a las ${reservation.time}`,
        html,
      }),
    });
    
    if (!response.ok) {
      console.error('[Email] Failed to send:', await response.text());
      return false;
    }
    
    console.log('[Email] Confirmation sent to:', to);
    return true;
  } catch (error) {
    console.error('[Email] Error:', error);
    return false;
  }
}

// POST - Crear nueva reserva
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leadId, name, email, phone, date, time, space, people } = body;
    
    console.log('[Reservation] Creating reservation:', { name, email, date, time, space, people });
    
    const client = getClient();
    
    // Verificar configuración de Google Calendar
    const googleTokens = await getGoogleTokens();
    const hasGoogleConfig = !!(googleTokens.clientId && googleTokens.clientSecret && googleTokens.refreshToken && googleTokens.calendarId);
    
    let googleEventId: string | null = null;
    let googleEventLink: string | null = null;
    
    if (hasGoogleConfig) {
      try {
        const accessToken = await getGoogleAccessToken(
          googleTokens.clientId!,
          googleTokens.clientSecret!,
          googleTokens.refreshToken!
        );
        
        const event = await createGoogleCalendarEvent(accessToken, googleTokens.calendarId!, {
          name,
          email,
          phone,
          date,
          time,
          space,
          people,
        });
        
        googleEventId = event.id;
        googleEventLink = event.htmlLink;
        
        console.log('[Reservation] Google Calendar event created:', event.id);
      } catch (e) {
        console.error('[Reservation] Google Calendar error:', e);
      }
    }
    
    // Guardar reserva en BD
    const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const startDateTime = new Date(`${date}T${time}`);
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60000);
    
    await client.execute({
      sql: `INSERT INTO Reservation (id, leadId, leadName, leadEmail, leadPhone, dateTime, endTime, title, googleEventId, googleEventLink, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id, 
        leadId || null, 
        name, 
        email || null, 
        phone || null,
        startDateTime.toISOString(), 
        endDateTime.toISOString(), 
        `Reserva - ${name}`,
        googleEventId, 
        googleEventLink, 
        'confirmed'
      ],
    });
    
    // Enviar email de confirmación si hay email
    let emailSent = false;
    if (email) {
      emailSent = await sendConfirmationEmail(email, {
        name,
        date,
        time,
        googleEventLink: googleEventLink || undefined,
      });
    }
    
    // Formatear fecha para respuesta
    const dateObj = new Date(date);
    const formattedDate = dateObj.toLocaleDateString('es-ES', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    
    return NextResponse.json({
      success: true,
      reservation: {
        id,
        date: formattedDate,
        time,
        googleEventLink,
        emailSent,
      },
    });
  } catch (error) {
    console.error('[Reservation] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// GET - Verificar configuración de reservas
export async function GET() {
  try {
    const googleTokens = await getGoogleTokens();
    
    const client = getClient();
    const configResult = await client.execute('SELECT resendApiKey, emailFrom FROM BotConfig LIMIT 1');
    const config = configResult.rows[0] as Record<string, unknown> | undefined;
    
    return NextResponse.json({
      success: true,
      googleCalendar: {
        configured: !!(googleTokens.clientId && googleTokens.clientSecret && googleTokens.refreshToken && googleTokens.calendarId),
        hasRefreshToken: !!googleTokens.refreshToken,
      },
      email: {
        configured: !!(config?.resendApiKey || process.env.RESEND_API_KEY),
        hasFrom: !!config?.emailFrom,
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
