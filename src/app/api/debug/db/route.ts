import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

const getClient = () => createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

// GET - Diagnosticar la base de datos
export async function GET() {
  try {
    const client = getClient();
    
    // Verificar estructura de la tabla BotConfig
    const tableInfo = await client.execute("PRAGMA table_info(BotConfig)");
    const columns = tableInfo.rows.map(r => ({
      name: r.name,
      type: r.type,
      notnull: r.notnull,
      defaultValue: r.dflt_value
    }));
    
    // Verificar si existen las columnas de AI
    const hasAiProvider = columns.some(c => c.name === 'aiProvider');
    const hasAiApiKey = columns.some(c => c.name === 'aiApiKey');
    const hasAiModel = columns.some(c => c.name === 'aiModel');
    
    // Obtener configuración actual
    const configResult = await client.execute('SELECT * FROM BotConfig LIMIT 1');
    const config = configResult.rows[0] as Record<string, unknown> | undefined;
    
    return NextResponse.json({
      success: true,
      database: {
        table: 'BotConfig',
        columnsCount: columns.length,
        columns,
        aiColumns: {
          aiProvider: hasAiProvider,
          aiApiKey: hasAiApiKey,
          aiModel: hasAiModel
        }
      },
      currentConfig: config ? {
        id: config.id,
        hasToken: !!config.token,
        hasAiApiKey: !!config.aiApiKey,
        aiProvider: config.aiProvider || 'NO DEFINIDO',
        aiModel: config.aiModel || 'NO DEFINIDO',
        isActive: config.isActive
      } : null,
      envVars: {
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        hasDatabaseAuthToken: !!process.env.DATABASE_AUTH_TOKEN
      }
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null
    }, { status: 500 });
  }
}

// POST - Crear columnas faltantes o actualizar modelo
export async function POST() {
  try {
    const client = getClient();
    
    // Primero, corregir el modelo si es inválido
    const configResult = await client.execute('SELECT id, aiModel FROM BotConfig LIMIT 1');
    const config = configResult.rows[0] as Record<string, unknown> | undefined;
    
    if (config) {
      const currentModel = config.aiModel as string;
      const invalidModels = [
        'gemini-2.5-flash-preview-05-20',
        'gemini-2.5-pro-preview-05-06',
        'gemini-2.5-flash',
        'gemini-2.5-pro',
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite',
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-pro'
      ];
      
      if (!currentModel || invalidModels.includes(currentModel)) {
        console.log('[Migration] Fixing invalid model:', currentModel, '-> gemini-3.1-flash-lite');
        await client.execute({
          sql: "UPDATE BotConfig SET aiModel = 'gemini-3.1-flash-lite' WHERE id = ?",
          args: [config.id as string]
        });
      }
    }
    
    // Verificar qué columnas faltan
    const tableInfo = await client.execute("PRAGMA table_info(BotConfig)");
    const existingColumns = tableInfo.rows.map(r => r.name as string);
    
    const columnsToAdd: string[] = [];
    
    if (!existingColumns.includes('aiProvider')) {
      columnsToAdd.push("ADD COLUMN aiProvider TEXT DEFAULT 'gemini'");
    }
    if (!existingColumns.includes('aiApiKey')) {
      columnsToAdd.push('ADD COLUMN aiApiKey TEXT');
    }
    if (!existingColumns.includes('aiModel')) {
      columnsToAdd.push("ADD COLUMN aiModel TEXT DEFAULT 'gemini-2.0-flash'");
    }
    if (!existingColumns.includes('googleClientId')) {
      columnsToAdd.push('ADD COLUMN googleClientId TEXT');
    }
    if (!existingColumns.includes('googleClientSecret')) {
      columnsToAdd.push('ADD COLUMN googleClientSecret TEXT');
    }
    if (!existingColumns.includes('googleRefreshToken')) {
      columnsToAdd.push('ADD COLUMN googleRefreshToken TEXT');
    }
    if (!existingColumns.includes('googleCalendarId')) {
      columnsToAdd.push('ADD COLUMN googleCalendarId TEXT');
    }
    if (!existingColumns.includes('resendApiKey')) {
      columnsToAdd.push('ADD COLUMN resendApiKey TEXT');
    }
    if (!existingColumns.includes('emailFrom')) {
      columnsToAdd.push('ADD COLUMN emailFrom TEXT');
    }
    
    // SQLite no soporta múltiples ADD COLUMN en una sentencia
    // Necesitamos ejecutar una por una
    for (const columnDef of columnsToAdd) {
      try {
        await client.execute(`ALTER TABLE BotConfig ${columnDef}`);
        console.log('Added column:', columnDef);
      } catch (e) {
        console.log('Column might already exist:', columnDef, e);
      }
    }
    
    // Verificar resultado
    const newTableInfo = await client.execute("PRAGMA table_info(BotConfig)");
    const newColumns = newTableInfo.rows.map(r => r.name);
    
    // Obtener config actualizada
    const updatedConfigResult = await client.execute('SELECT id, aiProvider, aiModel FROM BotConfig LIMIT 1');
    const updatedConfig = updatedConfigResult.rows[0] as Record<string, unknown> | undefined;
    
    return NextResponse.json({
      success: true,
      message: 'Migración completada',
      columnsAdded: columnsToAdd,
      currentColumns: newColumns,
      modelFixed: config ? true : false,
      updatedConfig: updatedConfig ? {
        id: updatedConfig.id,
        aiProvider: updatedConfig.aiProvider,
        aiModel: updatedConfig.aiModel
      } : null
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
