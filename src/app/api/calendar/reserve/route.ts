import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

const getClient = () => createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

interface ReservationRequest {
  leadId: string;
  leadName: string;
  leadEmail?: string;
  leadPhone?: string;
  date: string; // ISO date string
  time: string; // HH:MM
  duration?: number; // in minutes, default 60
  title?: string;
  description?: string;
}

// Función para obtener tokens de Google
async function getGoogleTokens() {
  const client = getClient();
  const result = await client.execute('SELECT * FROM BotConfig LIMIT 1');
  const config = result.rows[0] as Record<string, unknown> | undefined;
  
  return {
    clientId: config?.googleClientId as string | null,
    clientSecret: config?.googleClientSecret as string | null,
    refreshToken: config?.googleRefreshToken as string | null,
    calendarId: config?.googleCalendarId as string | null,
  };
}

// Función para obtener un nuevo access token usando refresh token
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
    const error = await response.text();
    console.error('[Google] Token refresh failed:', error);
    throw new Error('Failed to refresh Google access token');
  }
  
  const data = await response.json();
  return data.access_token;
}

// Función para crear evento en Google Calendar
async function createGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  reservation: ReservationRequest
): Promise<{ id: string; htmlLink: string }> {
  const startDateTime = new Date(`${reservation.date}T${reservation.time}`);
  const endDateTime = new Date(startDateTime.getTime() + (reservation.duration || 60) * 60000);
  
  const event = {
    summary: reservation.title || `Reserva - ${reservation.leadName}`,
    description: reservation.description || `Reserva realizada via Telegram Bot\nTeléfono: ${reservation.leadPhone || 'No proporcionado'}\nEmail: ${reservation.leadEmail || 'No proporcionado'}`,
    start: {
      dateTime: startDateTime.toISOString(),
      timeZone: 'America/Mexico_City',
    },
    end: {
      dateTime: endDateTime.toISOString(),
      timeZone: 'America/Mexico_City',
    },
    attendees: reservation.leadEmail ? [{ email: reservation.leadEmail }] : [],
    reminders: {
      useDefault: true,
    },
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
    console.error('[Google Calendar] Event creation failed:', error);
    throw new Error(`Google Calendar error: ${response.status}`);
  }
  
  const data = await response.json();
  return {
    id: data.id,
    htmlLink: data.htmlLink,
  };
}

// Función para guardar reserva en la base de datos
async function saveReservation(
  reservation: ReservationRequest,
  googleEventId: string,
  googleEventLink: string
): Promise<string> {
  const client = getClient();
  const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  
  const startDateTime = new Date(`${reservation.date}T${reservation.time}`);
  const endDateTime = new Date(startDateTime.getTime() + (reservation.duration || 60) * 60000);
  
  await client.execute({
    sql: `INSERT INTO Reservation (
      id, leadId, leadName, leadEmail, leadPhone, 
      dateTime, endTime, title, description, 
      googleEventId, googleEventLink, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      reservation.leadId,
      reservation.leadName,
      reservation.leadEmail || null,
      reservation.leadPhone || null,
      startDateTime.toISOString(),
      endDateTime.toISOString(),
      reservation.title || `Reserva - ${reservation.leadName}`,
      reservation.description || null,
      googleEventId,
      googleEventLink,
      'confirmed',
    ],
  });
  
  return id;
}

// POST - Crear una reserva
export async function POST(request: NextRequest) {
  try {
    const body: ReservationRequest = await request.json();
    
    console.log('[Reservation] Creating reservation:', body);
    
    if (!body.leadId || !body.leadName || !body.date || !body.time) {
      return NextResponse.json({
        success: false,
        error: 'Faltan datos requeridos: leadId, leadName, date, time',
      }, { status: 400 });
    }
    
    const tokens = await getGoogleTokens();
    
    if (!tokens.clientId || !tokens.clientSecret || !tokens.refreshToken || !tokens.calendarId) {
      console.error('[Reservation] Google Calendar not configured');
      return NextResponse.json({
        success: false,
        error: 'Google Calendar no está configurado. Ve a Configuración para configurarlo.',
      }, { status: 400 });
    }
    
    const accessToken = await getGoogleAccessToken(
      tokens.clientId,
      tokens.clientSecret,
      tokens.refreshToken
    );
    
    const event = await createGoogleCalendarEvent(accessToken, tokens.calendarId, body);
    
    console.log('[Reservation] Google Calendar event created:', event.id);
    
    const reservationId = await saveReservation(body, event.id, event.htmlLink);
    
    console.log('[Reservation] Saved to database:', reservationId);
    
    return NextResponse.json({
      success: true,
      reservation: {
        id: reservationId,
        googleEventId: event.id,
        googleEventLink: event.htmlLink,
      },
    });
  } catch (error) {
    console.error('[Reservation] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear la reserva',
    }, { status: 500 });
  }
}

// GET - Listar reservas
export async function GET(request: NextRequest) {
  try {
    const client = getClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    
    let sql = 'SELECT * FROM Reservation';
    const args: string[] = [];
    
    if (status) {
      sql += ' WHERE status = ?';
      args.push(status);
    }
    
    sql += ' ORDER BY dateTime DESC LIMIT 50';
    
    const result = await client.execute({ sql, args });
    
    return NextResponse.json({
      success: true,
      reservations: result.rows,
    });
  } catch (error) {
    console.error('[Reservation] Error listing:', error);
    return NextResponse.json({
      success: false,
      error: 'Error al obtener reservas',
    }, { status: 500 });
  }
}
