import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

const getClient = () => createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

interface EmailRequest {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

// Función para obtener configuración de email
async function getEmailConfig() {
  const client = getClient();
  const result = await client.execute('SELECT * FROM BotConfig LIMIT 1');
  const config = result.rows[0] as Record<string, unknown> | undefined;
  
  return {
    provider: (config?.emailProvider as string) || 'resend',
    resendApiKey: (config?.resendApiKey as string) || process.env.RESEND_API_KEY,
    smtpHost: config?.smtpHost as string | null,
    smtpPort: config?.smtpPort as number | null,
    smtpUser: config?.smtpUser as string | null,
    smtpPassword: config?.smtpPassword as string | null,
    emailFrom: config?.emailFrom as string | null,
  };
}

// Función para enviar email con Resend
async function sendWithResend(
  apiKey: string,
  from: string,
  email: EmailRequest
): Promise<{ id: string }> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: from,
      to: Array.isArray(email.to) ? email.to : [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error('[Resend] Error:', error);
    throw new Error(`Resend error: ${response.status}`);
  }
  
  const data = await response.json();
  return { id: data.id };
}

// Función para enviar email con SMTP (usando fetch a un servicio externo)
async function sendWithSMTP(
  config: {
    host: string;
    port: number;
    user: string;
    password: string;
  },
  from: string,
  email: EmailRequest
): Promise<{ id: string }> {
  // Para SMTP, necesitamos un servicio intermedio o nodemailer
  // Por ahora, lanzamos un error sugiriendo usar Resend
  throw new Error('SMTP no está disponible en serverless. Usa Resend para envío de emails.');
}

// POST - Enviar email
export async function POST(request: NextRequest) {
  try {
    const body: EmailRequest = await request.json();
    
    console.log('[Email] Sending email to:', body.to);
    
    if (!body.to || !body.subject || !body.html) {
      return NextResponse.json({
        success: false,
        error: 'Faltan datos requeridos: to, subject, html',
      }, { status: 400 });
    }
    
    const config = await getEmailConfig();
    
    if (!config.emailFrom) {
      return NextResponse.json({
        success: false,
        error: 'Email "from" no configurado',
      }, { status: 400 });
    }
    
    let emailId: string;
    
    if (config.provider === 'resend') {
      if (!config.resendApiKey) {
        return NextResponse.json({
          success: false,
          error: 'Resend API Key no configurada',
        }, { status: 400 });
      }
      
      emailId = (await sendWithResend(config.resendApiKey, config.emailFrom, body)).id;
    } else {
      if (!config.smtpHost || !config.smtpUser || !config.smtpPassword) {
        return NextResponse.json({
          success: false,
          error: 'SMTP no está completamente configurado',
        }, { status: 400 });
      }
      
      emailId = (await sendWithSMTP(
        {
          host: config.smtpHost,
          port: config.smtpPort || 587,
          user: config.smtpUser,
          password: config.smtpPassword,
        },
        config.emailFrom,
        body
      )).id;
    }
    
    console.log('[Email] Sent successfully:', emailId);
    
    return NextResponse.json({
      success: true,
      emailId,
    });
  } catch (error) {
    console.error('[Email] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al enviar email',
    }, { status: 500 });
  }
}

// Función helper para enviar email de confirmación de reserva
export async function sendReservationConfirmation(
  to: string,
  reservation: {
    leadName: string;
    date: string;
    time: string;
    duration: number;
    title: string;
    googleEventLink?: string;
  }
): Promise<boolean> {
  try {
    const config = await getEmailConfig();
    
    if (!config.emailFrom || !config.resendApiKey) {
      console.warn('[Email] Email not configured, skipping confirmation');
      return false;
    }
    
    const dateObj = new Date(reservation.date);
    const formattedDate = dateObj.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981, #14b8a6); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .detail-label { font-weight: bold; color: #6b7280; }
          .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 30px; color: #9ca3af; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Reserva Confirmada</h1>
          </div>
          <div class="content">
            <p>Hola ${reservation.leadName},</p>
            <p>Tu reserva ha sido confirmada exitosamente. Aquí están los detalles:</p>
            
            <div class="details">
              <div class="detail-row">
                <span class="detail-label">📅 Fecha:</span>
                <span>${formattedDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">🕐 Hora:</span>
                <span>${reservation.time}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">⏱️ Duración:</span>
                <span>${reservation.duration} minutos</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">📋 Servicio:</span>
                <span>${reservation.title}</span>
              </div>
            </div>
            
            ${reservation.googleEventLink ? `
              <p>Puedes ver este evento en tu Google Calendar:</p>
              <a href="${reservation.googleEventLink}" class="button">Ver en Google Calendar</a>
            ` : ''}
            
            <p style="margin-top: 20px;">Si necesitas cancelar o modificar tu reserva, por favor contáctanos.</p>
            
            <p>¡Gracias por tu preferencia!</p>
          </div>
          <div class="footer">
            <p>Este email fue enviado automáticamente por el sistema de reservas.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.emailFrom,
        to: [to],
        subject: `✅ Reserva Confirmada - ${formattedDate} a las ${reservation.time}`,
        html,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('[Email] Resend error:', error);
      return false;
    }
    
    console.log('[Email] Confirmation sent to:', to);
    return true;
  } catch (error) {
    console.error('[Email] Error sending confirmation:', error);
    return false;
  }
}
