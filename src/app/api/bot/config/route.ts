import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

const getClient = () => createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

// GET - Obtener configuración actual del bot
export async function GET() {
  try {
    const client = getClient();
    const result = await client.execute('SELECT * FROM BotConfig LIMIT 1');
    
    if (result.rows.length === 0) {
      // Crear configuración inicial
      await client.execute(`
        INSERT INTO BotConfig (id, systemPrompt, isActive, aiProvider, aiModel)
        VALUES ('default', 'Eres un asistente de atención al cliente amable y profesional. Responde de forma concisa y útil.', 0, 'gemini', 'gemini-1.5-flash')
      `);
      
      const newResult = await client.execute('SELECT * FROM BotConfig LIMIT 1');
      const config = newResult.rows[0] as Record<string, unknown>;
      
      return NextResponse.json({ 
        success: true, 
        config: {
          ...config,
          token: config.token ? String(config.token).substring(0, 10) + '...' : null,
          aiApiKey: config.aiApiKey ? '••••••••' : null, // No mostrar API key completa
        }
      });
    }
    
    const config = result.rows[0] as Record<string, unknown>;
    
    return NextResponse.json({ 
      success: true, 
      config: {
        ...config,
        token: config.token ? String(config.token).substring(0, 10) + '...' : null,
        aiApiKey: config.aiApiKey ? '••••••••' : null,
      }
    });
  } catch (error) {
    console.error('Error getting bot config:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error al obtener configuración',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST - Actualizar configuración del bot
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, systemPrompt, isActive, aiProvider, aiApiKey, aiModel } = body;
    
    console.log('[Config] Updating config:', { 
      hasToken: !!token, 
      hasSystemPrompt: !!systemPrompt, 
      isActive,
      aiProvider,
      hasAiApiKey: !!aiApiKey,
      aiModel
    });
    
    const client = getClient();
    
    // Verificar si existe configuración
    const existing = await client.execute('SELECT * FROM BotConfig LIMIT 1');
    
    if (existing.rows.length === 0) {
      // Crear nueva configuración
      const isActiveValue = isActive ? 1 : 0;
      await client.execute({
        sql: 'INSERT INTO BotConfig (id, token, systemPrompt, isActive, aiProvider, aiApiKey, aiModel) VALUES (?, ?, ?, ?, ?, ?, ?)',
        args: [
          'default', 
          token || null, 
          systemPrompt || 'Eres un asistente amable.', 
          isActiveValue,
          aiProvider || 'zai',
          aiApiKey || null,
          aiModel || 'gpt-4o-mini'
        ]
      });
      
      console.log('[Config] Created new config');
    } else {
      // Actualizar configuración existente
      const updates: string[] = [];
      const args: (string | number | null)[] = [];
      
      if (token !== undefined) {
        updates.push('token = ?');
        args.push(token || null);
      }
      if (systemPrompt !== undefined) {
        updates.push('systemPrompt = ?');
        args.push(systemPrompt);
      }
      if (isActive !== undefined) {
        updates.push('isActive = ?');
        args.push(isActive ? 1 : 0);
      }
      if (aiProvider !== undefined) {
        updates.push('aiProvider = ?');
        args.push(aiProvider);
      }
      if (aiApiKey !== undefined) {
        updates.push('aiApiKey = ?');
        args.push(aiApiKey || null);
      }
      if (aiModel !== undefined) {
        updates.push('aiModel = ?');
        args.push(aiModel);
      }
      
      if (updates.length > 0) {
        args.push('default'); // WHERE id = 'default'
        const sql = `UPDATE BotConfig SET ${updates.join(', ')}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`;
        await client.execute({ sql, args });
        console.log('[Config] Updated successfully');
      }
    }
    
    // Obtener configuración actualizada
    const result = await client.execute('SELECT * FROM BotConfig LIMIT 1');
    const config = result.rows[0] as Record<string, unknown>;
    
    return NextResponse.json({ 
      success: true, 
      config: {
        ...config,
        token: config.token ? String(config.token).substring(0, 10) + '...' : null,
        aiApiKey: config.aiApiKey ? '••••••••' : null,
      }
    });
  } catch (error) {
    console.error('Error updating bot config:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error al guardar configuración',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
