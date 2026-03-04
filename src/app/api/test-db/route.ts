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
    
    // Probar conexión
    const result = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
    
    console.log('[Test DB] Tables found:', result.rows.length);
    
    return NextResponse.json({
      success: true,
      message: 'Conexión exitosa a Turso',
      tables: result.rows.map(r => r.name),
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
