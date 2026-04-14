import { Resend } from 'resend';
import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { name, email, phone, company, service, subject, message } = body;

    // Validación de campos requeridos
    if (!name || !email || !subject || !message || !service) {
      return new Response(
        JSON.stringify({ error: 'Todos los campos requeridos deben ser completados' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = import.meta.env.RESEND_API_KEY ?? process.env.RESEND_API_KEY;
    const recipient = import.meta.env.RECIPIENT_EMAIL ?? process.env.RECIPIENT_EMAIL;

    if (!apiKey || !recipient) {
      return new Response(
        JSON.stringify({ error: 'Configuración incompleta en .env' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const resend = new Resend(apiKey);

    const { data, error } = await resend.emails.send({
      from: 'Web Faynshteyn <onboarding@resend.dev>',
      to: [recipient], // ✅ Resend espera un array
      replyTo: email,
      subject: `CONSULTA WEB: ${subject}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #C5A059; color: #1a1a1a;">
          <h2 style="color: #8A6632;">Nueva Consulta Recibida</h2>
          <p><strong>Remitente:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Teléfono:</strong> ${phone || 'No proporcionado'}</p>
          <p><strong>Empresa:</strong> ${company || 'No proporcionada'}</p>
          <p><strong>Área de Interés:</strong> ${service}</p>
          <p><strong>Asunto:</strong> ${subject}</p>
          <div style="margin-top: 20px; border-top: 1px solid #eee; padding-top: 20px;">
            <p><strong>Mensaje:</strong></p>
            <p style="font-style: italic;">${message}</p>
          </div>
        </div>
      `,
    });

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ message: 'Mail Enviado', id: data?.id }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(
      JSON.stringify({ error: 'Error interno', message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};