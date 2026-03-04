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

// GET - Obtener todos los leads
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    const client = getClient();
    
    let sql = 'SELECT * FROM Lead';
    const args: string[] = [];
    
    if (status && status !== 'all') {
      sql += ' WHERE status = ?';
      args.push(status);
    }
    
    sql += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
    args.push(String(limit), String(offset));
    
    const leadsResult = await client.execute({ sql, args });
    
    // Obtener mensajes para cada lead
    const leads = [];
    for (const row of leadsResult.rows) {
      const lead = row as Record<string, unknown>;
      const messagesResult = await client.execute({
        sql: 'SELECT * FROM Message WHERE leadId = ? ORDER BY createdAt DESC LIMIT 5',
        args: [lead.id as string]
      });
      leads.push({
        ...lead,
        messages: messagesResult.rows
      });
    }
    
    // Contar total
    const countSql = status && status !== 'all' 
      ? 'SELECT COUNT(*) as count FROM Lead WHERE status = ?'
      : 'SELECT COUNT(*) as count FROM Lead';
    const countArgs = status && status !== 'all' ? [status] : [];
    const countResult = await client.execute({ sql: countSql, args: countArgs });
    const total = Number(countResult.rows[0]?.count || 0);
    
    return NextResponse.json({
      success: true,
      leads,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + leads.length < total
      }
    });
  } catch (error) {
    console.error('Error getting leads:', error);
    return NextResponse.json({ success: false, error: 'Error al obtener leads' }, { status: 500 });
  }
}

// POST - Crear nuevo lead manualmente
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { telegramId, firstName, lastName, username, phone, email, notes, conversation } = body;
    
    if (!telegramId) {
      return NextResponse.json({ success: false, error: 'Telegram ID es requerido' }, { status: 400 });
    }
    
    const client = getClient();
    
    // Verificar si ya existe
    const existing = await client.execute({
      sql: 'SELECT * FROM Lead WHERE telegramId = ?',
      args: [telegramId]
    });
    
    if (existing.rows.length > 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Ya existe un lead con este Telegram ID',
        lead: existing.rows[0] 
      }, { status: 400 });
    }
    
    const id = generateId();
    await client.execute({
      sql: 'INSERT INTO Lead (id, telegramId, firstName, lastName, username, phone, email, notes, conversation, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [id, telegramId, firstName || null, lastName || null, username || null, phone || null, email || null, notes || null, conversation || null, 'new']
    });
    
    const result = await client.execute({
      sql: 'SELECT * FROM Lead WHERE id = ?',
      args: [id]
    });
    
    return NextResponse.json({ success: true, lead: result.rows[0] });
  } catch (error) {
    console.error('Error creating lead:', error);
    return NextResponse.json({ success: false, error: 'Error al crear lead' }, { status: 500 });
  }
}

// PUT - Actualizar lead
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, notes, phone, email } = body;
    
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID es requerido' }, { status: 400 });
    }
    
    const client = getClient();
    
    const updates: string[] = [];
    const args: (string | null)[] = [];
    
    if (status) {
      updates.push('status = ?');
      args.push(status);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      args.push(notes);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      args.push(phone);
    }
    if (email !== undefined) {
      updates.push('email = ?');
      args.push(email);
    }
    
    if (updates.length > 0) {
      updates.push('updatedAt = CURRENT_TIMESTAMP');
      args.push(id);
      await client.execute({
        sql: `UPDATE Lead SET ${updates.join(', ')} WHERE id = ?`,
        args
      });
    }
    
    const result = await client.execute({
      sql: 'SELECT * FROM Lead WHERE id = ?',
      args: [id]
    });
    
    return NextResponse.json({ success: true, lead: result.rows[0] });
  } catch (error) {
    console.error('Error updating lead:', error);
    return NextResponse.json({ success: false, error: 'Error al actualizar lead' }, { status: 500 });
  }
}

// DELETE - Eliminar lead
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID es requerido' }, { status: 400 });
    }
    
    const client = getClient();
    
    // Eliminar mensajes asociados primero
    await client.execute({
      sql: 'DELETE FROM Message WHERE leadId = ?',
      args: [id]
    });
    
    await client.execute({
      sql: 'DELETE FROM Lead WHERE id = ?',
      args: [id]
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting lead:', error);
    return NextResponse.json({ success: false, error: 'Error al eliminar lead' }, { status: 500 });
  }
}
