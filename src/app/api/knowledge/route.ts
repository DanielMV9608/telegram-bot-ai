import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

const getClient = () => createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// GET - Obtener todo el conocimiento
export async function GET() {
  try {
    const client = getClient();
    const result = await client.execute(
      "SELECT * FROM KnowledgeBase WHERE isActive = 1 ORDER BY createdAt DESC"
    );
    
    return NextResponse.json({ success: true, knowledge: result.rows });
  } catch (error) {
    console.error('Error getting knowledge:', error);
    return NextResponse.json({ success: false, error: 'Error al obtener conocimiento' }, { status: 500 });
  }
}

// POST - Agregar nuevo conocimiento
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, type, content, sourceUrl, fileName } = body;
    
    if (!title || !type || !content) {
      return NextResponse.json({ 
        success: false, 
        error: 'Título, tipo y contenido son requeridos' 
      }, { status: 400 });
    }
    
    const client = getClient();
    const id = generateId();
    
    await client.execute({
      sql: 'INSERT INTO KnowledgeBase (id, title, type, content, sourceUrl, fileName, isActive) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [id, title, type, content, sourceUrl || null, fileName || null, 1]
    });
    
    return NextResponse.json({ success: true, id, message: 'Conocimiento agregado correctamente' });
  } catch (error) {
    console.error('Error adding knowledge:', error);
    return NextResponse.json({ success: false, error: 'Error al agregar conocimiento' }, { status: 500 });
  }
}

// DELETE - Eliminar conocimiento
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID es requerido' }, { status: 400 });
    }
    
    const client = getClient();
    await client.execute({
      sql: 'UPDATE KnowledgeBase SET isActive = 0, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
      args: [id]
    });
    
    return NextResponse.json({ success: true, message: 'Conocimiento eliminado' });
  } catch (error) {
    console.error('Error deleting knowledge:', error);
    return NextResponse.json({ success: false, error: 'Error al eliminar' }, { status: 500 });
  }
}
