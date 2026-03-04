import { NextRequest, NextResponse } from 'next/server';

// POST - Extraer información de reserva del mensaje
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, conversationHistory, leadId, leadName, leadEmail, leadPhone } = body;
    
    // Usar la fecha actual como referencia
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // Detectar intención de reserva
    const reservationKeywords = [
      'reservar', 'reserva', 'cita', 'agendar', 'programar', 
      'apartar', 'quiero una cita', 'quisiera una cita',
      'necesito una cita', 'me gustaría reservar', 'confirmar reserva',
      'sí confirmo', 'si confirmo', 'confirmar', 'proceder'
    ];
    
    const isReservation = reservationKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
    
    if (!isReservation) {
      return NextResponse.json({
        isReservation: false,
        needsMoreInfo: false,
      });
    }
    
    // Detectar fecha
    let date: string | null = null;
    const lowerMessage = message.toLowerCase();
    
    // Mañana
    if (lowerMessage.includes('mañana') || lowerMessage.includes('manana')) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      date = tomorrow.toISOString().split('T')[0];
    }
    // Hoy
    else if (lowerMessage.includes('hoy')) {
      date = today;
    }
    // Pasado mañana
    else if (lowerMessage.includes('pasado')) {
      const dayAfter = new Date(now);
      dayAfter.setDate(dayAfter.getDate() + 2);
      date = dayAfter.toISOString().split('T')[0];
    }
    // Días de la semana
    else {
      const dayNames: Record<string, number> = {
        'domingo': 0, 'lunes': 1, 'martes': 2, 'miércoles': 3, 'miercoles': 3,
        'jueves': 4, 'viernes': 5, 'sábado': 6, 'sabado': 6
      };
      
      for (const [dayName, dayIndex] of Object.entries(dayNames)) {
        if (lowerMessage.includes(dayName)) {
          const targetDate = new Date(now);
          const currentDay = now.getDay();
          let daysUntil = dayIndex - currentDay;
          if (daysUntil <= 0) daysUntil += 7;
          targetDate.setDate(now.getDate() + daysUntil);
          date = targetDate.toISOString().split('T')[0];
          break;
        }
      }
    }
    
    // Buscar fecha en historial si no está en mensaje actual
    if (!date && conversationHistory && Array.isArray(conversationHistory)) {
      for (const msg of [...conversationHistory].reverse()) {
        const msgContent = typeof msg === 'string' ? msg : msg.content || '';
        const msgLower = msgContent.toLowerCase();
        if (msgLower.includes('mañana') || msgLower.includes('manana')) {
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          date = tomorrow.toISOString().split('T')[0];
          break;
        }
        if (msgLower.includes('hoy')) {
          date = today;
          break;
        }
      }
    }
    
    // Detectar hora
    let time: string | null = null;
    const timePatterns = [
      /(?:a\s+las?\s+)?(\d{1,2}):(\d{2})/i,
      /(?:a\s+las?\s+)?(\d{1,2})\s*(am|pm)/i,
      /(?:a\s+las?\s+)?(\d{1,2})(am|pm)/i,
    ];
    
    for (const pattern of timePatterns) {
      const match = message.match(pattern);
      if (match) {
        let hour = parseInt(match[1]);
        const minutes = match[2] && !isNaN(parseInt(match[2])) && match[2].length === 2 ? parseInt(match[2]) : 0;
        const period = match[2]?.toString().toLowerCase() || match[3]?.toLowerCase() || '';
        
        if (period.includes('pm') && hour < 12) hour += 12;
        else if (period.includes('am') && hour === 12) hour = 0;
        
        time = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        break;
      }
    }
    
    // Buscar hora en historial
    if (!time && conversationHistory && Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory) {
        const msgContent = typeof msg === 'string' ? msg : msg.content || '';
        for (const pattern of timePatterns) {
          const match = msgContent.match(pattern);
          if (match) {
            let hour = parseInt(match[1]);
            const minutes = match[2] && !isNaN(parseInt(match[2])) && match[2].length === 2 ? parseInt(match[2]) : 0;
            const period = match[2]?.toString().toLowerCase() || match[3]?.toLowerCase() || '';
            
            if (period.includes('pm') && hour < 12) hour += 12;
            else if (period.includes('am') && hour === 12) hour = 0;
            
            time = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            break;
          }
        }
        if (time) break;
      }
    }
    
    // Detectar número de personas
    let people: number | null = null;
    const peopleMatch = message.match(/(\d+)\s*(?:personas?|person|people|pax)/i);
    if (peopleMatch) {
      people = parseInt(peopleMatch[1]);
    } else {
      // Buscar solo número que podría ser personas
      const numMatch = message.match(/(?:somos|para|seremos)\s*(\d+)/i);
      if (numMatch) {
        people = parseInt(numMatch[1]);
      }
    }
    
    // Detectar email en mensaje
    let email = leadEmail;
    const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (emailMatch) {
      email = emailMatch[0];
    }
    
    // Detectar confirmación
    const isConfirmation = 
      lowerMessage.includes('confirmo') || 
      lowerMessage.includes('sí') ||
      lowerMessage.includes('si,') ||
      lowerMessage.includes('sí,') ||
      lowerMessage.includes('proceder') ||
      lowerMessage.includes('adelante') ||
      lowerMessage.includes('ok') ||
      lowerMessage.includes('dale') ||
      lowerMessage.includes('perfecto') ||
      lowerMessage.includes('claro');
    
    // Verificar si tenemos toda la información necesaria
    const hasAllInfo = date && time && email;
    
    return NextResponse.json({
      isReservation: true,
      hasAllInfo,
      isConfirmation,
      extracted: {
        date,
        time,
        people,
        email,
        name: leadName,
        phone: leadPhone,
        leadId,
      },
      needsMoreInfo: {
        date: !date,
        time: !time,
        email: !email,
        people: !people,
      },
      canCreate: hasAllInfo && isConfirmation,
    });
  } catch (error) {
    console.error('[Reservation Extract] Error:', error);
    return NextResponse.json({
      isReservation: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
