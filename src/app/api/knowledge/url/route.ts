import { NextRequest, NextResponse } from 'next/server';

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
    
    // Usar fetch directo para leer la página
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; TelegramBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(15000), // 15 segundos timeout
      });
      
      if (!response.ok) {
        return NextResponse.json({
          success: false,
          error: `No se pudo acceder a la URL (status: ${response.status})`
        }, { status: 400 });
      }
      
      const html = await response.text();
      
      // Extraer título
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : 'Sin título';
      
      // Extraer texto plano del HTML
      const plainText = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&[a-z]+;/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Limitar a 10000 caracteres para no sobrecargar el contexto
      const content = plainText.substring(0, 10000);
      
      console.log('[Knowledge] Extracted content length:', content.length);
      
      return NextResponse.json({
        success: true,
        data: {
          title,
          url: url,
          content,
        }
      });
      
    } catch (fetchError) {
      console.error('[Knowledge] Fetch error:', fetchError);
      return NextResponse.json({
        success: false,
        error: 'No se pudo acceder a la URL. Verifica que sea accesible.'
      }, { status: 400 });
    }
    
  } catch (error) {
    console.error('[Knowledge] Error extracting from URL:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al extraer contenido'
    }, { status: 500 });
  }
}
