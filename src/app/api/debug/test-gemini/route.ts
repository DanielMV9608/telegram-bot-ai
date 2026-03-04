import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

const getClient = () => createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { testMessage } = body;
    
    const client = getClient();
    
    // 1. Verificar configuración en BD
    const configResult = await client.execute('SELECT * FROM BotConfig LIMIT 1');
    const config = configResult.rows[0] as Record<string, unknown> | undefined;
    
    if (!config) {
      return NextResponse.json({
        success: false,
        step: 'config',
        error: 'No hay configuración en la base de datos'
      });
    }
    
    const aiProvider = (config.aiProvider as string) || 'gemini';
    const aiApiKey = config.aiApiKey as string | null;
    const aiModel = (config.aiModel as string) || 'gemini-3.1-flash-lite';
    
    // 2. Verificar API Key
    if (!aiApiKey) {
      return NextResponse.json({
        success: false,
        step: 'api_key',
        error: 'No hay API Key configurada',
        config: {
          id: config.id,
          aiProvider,
          aiModel,
          hasApiKey: false
        }
      });
    }
    
    // 3. Probar API de Gemini
    const message = testMessage || 'Hola, ¿cómo estás?';
    const model = aiModel;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${aiApiKey}`;
    
    console.log('[Test Gemini] Testing model:', model);
    console.log('[Test Gemini] API Key length:', aiApiKey.length);
    console.log('[Test Gemini] API Key prefix:', aiApiKey.substring(0, 10) + '...');
    
    const requestBody = {
      contents: [{
        role: 'user',
        parts: [{ text: message }]
      }],
      generationConfig: {
        maxOutputTokens: 100,
        temperature: 0.7
      }
    };
    
    const startTime = Date.now();
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      const responseTime = Date.now() - startTime;
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { raw: errorText };
        }
        
        return NextResponse.json({
          success: false,
          step: 'gemini_api',
          error: `Gemini API error: ${response.status}`,
          status: response.status,
          errorData,
          config: {
            aiProvider,
            aiModel,
            hasApiKey: true,
            apiKeyLength: aiApiKey.length
          },
          request: {
            url: url.replace(aiApiKey, 'API_KEY_HIDDEN'),
            body: requestBody
          }
        });
      }
      
      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      return NextResponse.json({
        success: true,
        step: 'complete',
        responseTime,
        model,
        message,
        response: content,
        fullResponse: data,
        config: {
          aiProvider,
          aiModel,
          hasApiKey: true,
          apiKeyLength: aiApiKey.length
        }
      });
      
    } catch (fetchError) {
      return NextResponse.json({
        success: false,
        step: 'fetch',
        error: fetchError instanceof Error ? fetchError.message : 'Fetch error',
        config: {
          aiProvider,
          aiModel,
          hasApiKey: true
        }
      });
    }
    
  } catch (error) {
    console.error('[Test Gemini] Error:', error);
    return NextResponse.json({
      success: false,
      step: 'unknown',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    const client = getClient();
    
    // Verificar estructura de la tabla
    const tableInfo = await client.execute("PRAGMA table_info(BotConfig)");
    const columns = tableInfo.rows.map(r => r.name);
    
    // Obtener configuración
    const configResult = await client.execute('SELECT * FROM BotConfig LIMIT 1');
    const config = configResult.rows[0] as Record<string, unknown> | undefined;
    
    return NextResponse.json({
      success: true,
      database: {
        tableExists: true,
        columns,
        hasAiProvider: columns.includes('aiProvider'),
        hasAiApiKey: columns.includes('aiApiKey'),
        hasAiModel: columns.includes('aiModel')
      },
      config: config ? {
        id: config.id,
        aiProvider: config.aiProvider || 'NO CONFIGURADO',
        aiModel: config.aiModel || 'NO CONFIGURADO',
        hasApiKey: !!config.aiApiKey,
        apiKeyPrefix: config.aiApiKey ? String(config.aiApiKey).substring(0, 10) + '...' : null,
        isActive: config.isActive
      } : null
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
