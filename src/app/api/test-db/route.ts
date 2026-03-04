import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

export async function GET() {
  console.log('[Test DB] Testing database connection...');
  console.log('[Test DB] DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'NOT SET');
  console.log('[Test DB] DATABASE_AUTH_TOKEN:', process.env.DATABASE_AUTH_TOKEN ? 'Set' : 'NOT SET');
  
  if (!process.env.DATABASE_URL || !process.env.DATABASE_AUTH_TOKEN) {
    return NextResponse.json({
      success: false,
      error: 'Variables de entorno no configuradas',
      hasUrl: !!process.env.DATABASE_URL,
      hasToken: !!process.env.DATABASE_AUTH_TOKEN
    });
  }
  
  try {
    const client = createClient({
      url: process.env.DATABASE_URL,
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
    
    // Probar conexión con consulta simple
    await client.execute('SELECT 1 as test');
    
    // Verificar tabla BotConfig directamente
    let botConfigExists = false;
    let botConfigData = null;
    try {
      const configResult = await client.execute('SELECT * FROM BotConfig LIMIT 1');
      botConfigExists = true;
      botConfigData = configResult.rows;
    } catch (e) {
      botConfigExists = false;
      botConfigData = String(e);
    }
    
    console.log('[Test DB] Connection successful');
    
    return NextResponse.json({
      success: true,
      message: 'Conexión exitosa a Turso',
      botConfigExists,
      botConfigData,
      databaseUrl: process.env.DATABASE_URL?.substring(0, 30) + '...'
    });
  } catch (error) {
    console.error('[Test DB] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
