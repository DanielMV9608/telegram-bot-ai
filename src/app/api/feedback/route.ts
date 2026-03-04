import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

const getClient = () => createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

// Generar ID único
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// GET - Obtener todos los feedbacks
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get('active') === 'true';
    
    const client = getClient();
    
    let sql = activeOnly 
      ? 'SELECT * FROM Feedback WHERE isActive = 1 ORDER BY createdAt DESC'
      : 'SELECT * FROM Feedback ORDER BY createdAt DESC';
    
    const result = await client.execute(sql);
    
    return NextResponse.json({ success: true, feedbacks: result.rows });
  } catch (error) {
    console.error('Error getting feedbacks:', error);
    return NextResponse.json({ success: false, error: 'Error al obtener feedbacks' }, { status: 500 });
  }
}

// POST - Crear nuevo feedback
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { triggerText, badResponse, correction, category } = body;
    
    if (!triggerText || !correction) {
      return NextResponse.json({ 
        success: false, 
        error: 'Texto disparador y corrección son requeridos' 
      }, { status: 400 });
    }
    
    const client = getClient();
    const id = generateId();
    
    await client.execute({
      sql: 'INSERT INTO Feedback (id, triggerText, badResponse, correction, category, isActive) VALUES (?, ?, ?, ?, ?, ?)',
      args: [id, triggerText, badResponse || null, correction, category || 'response_style', 1]
    });
    
    const result = await client.execute({
      sql: 'SELECT * FROM Feedback WHERE id = ?',
      args: [id]
    });
    
    return NextResponse.json({ success: true, feedback: result.rows[0] });
  } catch (error) {
    console.error('Error creating feedback:', error);
    return NextResponse.json({ success: false, error: 'Error al crear feedback' }, { status: 500 });
  }
}

// PUT - Actualizar feedback
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, triggerText, badResponse, correction, category, isActive } = body;
    
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID es requerido' }, { status: 400 });
    }
    
    const client = getClient();
    
    const updates: string[] = [];
    const args: (string | number | null)[] = [];
    
    if (triggerText) {
      updates.push('triggerText = ?');
      args.push(triggerText);
    }
    if (badResponse !== undefined) {
      updates.push('badResponse = ?');
      args.push(badResponse);
    }
    if (correction) {
      updates.push('correction = ?');
      args.push(correction);
    }
    if (category) {
      updates.push('category = ?');
      args.push(category);
    }
    if (isActive !== undefined) {
      updates.push('isActive = ?');
      args.push(isActive ? 1 : 0);
    }
    
    if (updates.length > 0) {
      updates.push('updatedAt = CURRENT_TIMESTAMP');
      args.push(id);
      await client.execute({
        sql: `UPDATE Feedback SET ${updates.join(', ')} WHERE id = ?`,
        args
      });
    }
    
    const result = await client.execute({
      sql: 'SELECT * FROM Feedback WHERE id = ?',
      args: [id]
    });
    
    return NextResponse.json({ success: true, feedback: result.rows[0] });
  } catch (error) {
    console.error('Error updating feedback:', error);
    return NextResponse.json({ success: false, error: 'Error al actualizar feedback' }, { status: 500 });
  }
}

// DELETE - Eliminar feedback
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID es requerido' }, { status: 400 });
    }
    
    const client = getClient();
    
    await client.execute({
      sql: 'DELETE FROM Feedback WHERE id = ?',
      args: [id]
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting feedback:', error);
    return NextResponse.json({ success: false, error: 'Error al eliminar feedback' }, { status: 500 });
  }
}
