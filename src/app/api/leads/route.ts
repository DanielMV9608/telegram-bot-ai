import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Obtener todos los leads
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    const where: Record<string, unknown> = {};
    if (status && status !== 'all') {
      where.status = status;
    }
    
    const leads = await db.lead.findMany({
      where,
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });
    
    const total = await db.lead.count({ where });
    
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
    
    // Verificar si ya existe
    const existing = await db.lead.findFirst({
      where: { telegramId }
    });
    
    if (existing) {
      return NextResponse.json({ 
        success: false, 
        error: 'Ya existe un lead con este Telegram ID',
        lead: existing 
      }, { status: 400 });
    }
    
    const lead = await db.lead.create({
      data: {
        telegramId,
        firstName,
        lastName,
        username,
        phone,
        email,
        notes,
        conversation,
        status: 'new'
      }
    });
    
    return NextResponse.json({ success: true, lead });
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
    
    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    
    const lead = await db.lead.update({
      where: { id },
      data: updateData
    });
    
    return NextResponse.json({ success: true, lead });
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
    
    // Eliminar mensajes asociados primero
    await db.message.deleteMany({
      where: { leadId: id }
    });
    
    await db.lead.delete({
      where: { id }
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting lead:', error);
    return NextResponse.json({ success: false, error: 'Error al eliminar lead' }, { status: 500 });
  }
}
