import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Obtener todos los feedbacks
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get('active') === 'true';
    
    const where: Record<string, unknown> = {};
    if (activeOnly) {
      where.isActive = true;
    }
    
    const feedbacks = await db.feedback.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
    
    return NextResponse.json({ success: true, feedbacks });
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
    
    const feedback = await db.feedback.create({
      data: {
        triggerText,
        badResponse,
        correction,
        category: category || 'response_style',
        isActive: true
      }
    });
    
    return NextResponse.json({ success: true, feedback });
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
    
    const updateData: Record<string, unknown> = {};
    if (triggerText) updateData.triggerText = triggerText;
    if (badResponse !== undefined) updateData.badResponse = badResponse;
    if (correction) updateData.correction = correction;
    if (category) updateData.category = category;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    const feedback = await db.feedback.update({
      where: { id },
      data: updateData
    });
    
    return NextResponse.json({ success: true, feedback });
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
    
    await db.feedback.delete({
      where: { id }
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting feedback:', error);
    return NextResponse.json({ success: false, error: 'Error al eliminar feedback' }, { status: 500 });
  }
}
