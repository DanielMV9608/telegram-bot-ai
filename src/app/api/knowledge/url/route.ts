import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;
    
    if (!url) {
      return NextResponse.json({ 
        success: false, 
        error: 'URL es requerida' 
      }, { status: 400 });
    }
    
    console.log('[Knowledge] Extracting from URL:', url);
    
    const zai = await ZAI.create();
    
    const result = await zai.functions.invoke('page_reader', {
      url: url
    });
    
    if (result.code !== 200 || !result.data) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo extraer contenido de la URL'
      }, { status: 400 });
    }
    
    // Extraer texto plano del HTML
    const plainText = result.data.html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Limitar a 10000 caracteres para no sobrecargar el contexto
    const content = plainText.substring(0, 10000);
    
    return NextResponse.json({
      success: true,
      data: {
        title: result.data.title || 'Sin título',
        url: url,
        content: content,
        publishedTime: result.data.publishedTime
      }
    });
    
  } catch (error) {
    console.error('[Knowledge] Error extracting from URL:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al extraer contenido'
    }, { status: 500 });
  }
}
