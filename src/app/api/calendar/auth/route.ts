import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

const getClient = () => createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

// GET - Iniciar flujo OAuth o verificar estado
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    
    const client = getClient();
    const configResult = await client.execute('SELECT * FROM BotConfig LIMIT 1');
    const config = configResult.rows[0] as Record<string, unknown> | undefined;
    
    const googleClientId = (config?.googleClientId as string) || process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = (config?.googleClientSecret as string) || process.env.GOOGLE_CLIENT_SECRET;
    const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI || `${request.nextUrl.origin}/api/calendar/auth`;
    
    // Si no hay código, devolver URL de autorización
    if (!code) {
      if (!googleClientId) {
        return NextResponse.json({
          success: false,
          error: 'Google Client ID no configurado',
          configured: false,
        });
      }
      
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', googleClientId);
      authUrl.searchParams.set('redirect_uri', googleRedirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar.events');
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');
      
      return NextResponse.json({
        success: true,
        authUrl: authUrl.toString(),
        configured: !!(config?.googleRefreshToken),
      });
    }
    
    // Intercambiar código por tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: googleClientId,
        client_secret: googleClientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: googleRedirectUri,
      }),
    });
    
    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('[Google Auth] Token exchange failed:', error);
      return NextResponse.redirect(new URL('/?auth=error', request.url));
    }
    
    const tokens = await tokenResponse.json();
    
    // Guardar refresh token en la base de datos
    await client.execute({
      sql: `UPDATE BotConfig SET 
        googleRefreshToken = ?,
        updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?`,
      args: [tokens.refresh_token, 'default'],
    });
    
    console.log('[Google Auth] Tokens saved successfully');
    
    // Redirigir al dashboard con éxito
    return NextResponse.redirect(new URL('/?auth=success', request.url));
  } catch (error) {
    console.error('[Google Auth] Error:', error);
    return NextResponse.redirect(new URL('/?auth=error', request.url));
  }
}

// POST - Guardar configuración de Google Calendar manualmente
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, clientSecret, calendarId, refreshToken } = body;
    
    const client = getClient();
    
    const updates: string[] = [];
    const args: (string | null)[] = [];
    
    if (clientId !== undefined) {
      updates.push('googleClientId = ?');
      args.push(clientId || null);
    }
    if (clientSecret !== undefined) {
      updates.push('googleClientSecret = ?');
      args.push(clientSecret || null);
    }
    if (calendarId !== undefined) {
      updates.push('googleCalendarId = ?');
      args.push(calendarId || null);
    }
    if (refreshToken !== undefined) {
      updates.push('googleRefreshToken = ?');
      args.push(refreshToken || null);
    }
    
    if (updates.length > 0) {
      args.push('default');
      await client.execute({
        sql: `UPDATE BotConfig SET ${updates.join(', ')}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
        args,
      });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Google Auth] Error saving config:', error);
    return NextResponse.json({
      success: false,
      error: 'Error al guardar configuración',
    }, { status: 500 });
  }
}

// DELETE - Desconectar Google Calendar
export async function DELETE() {
  try {
    const client = getClient();
    await client.execute({
      sql: `UPDATE BotConfig SET 
        googleRefreshToken = NULL,
        updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?`,
      args: ['default'],
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Google Auth] Error disconnecting:', error);
    return NextResponse.json({
      success: false,
      error: 'Error al desconectar',
    }, { status: 500 });
  }
}
