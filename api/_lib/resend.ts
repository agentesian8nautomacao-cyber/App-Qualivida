/**
 * Helper de envio de e-mail via Resend (apenas backend).
 * Usado por /api/send-invite-email e /api/test-email.
 */

import { Resend } from 'resend';

const FROM_VERIFIED = 'SentinelaAUT <no-reply@phmsdev.com.br>';

export function getResendFrom(): string {
  const from =
    (process.env.RESEND_FROM || process.env.APP_SENDER_EMAIL || FROM_VERIFIED).trim();
  return from;
}

export function isResendConfigured(): boolean {
  const key = (process.env.RESEND_API_KEY || '').trim();
  return key.length > 0;
}

export type SendEmailResult = { success: true; id?: string } | { success: false; error: unknown };

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}): Promise<SendEmailResult> {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) {
    return { success: false, error: new Error('RESEND_API_KEY não definida') };
  }

  const resend = new Resend(apiKey);
  const from = params.from || getResendFrom();

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    if (error) {
      console.error('[resend] API retornou erro:', JSON.stringify(error, null, 2));
      return { success: false, error };
    }
    return { success: true, id: data?.id };
  } catch (err) {
    console.error('[resend] Exceção ao enviar:', err);
    return { success: false, error: err };
  }
}

/** Extrai mensagem legível do erro retornado pelo Resend (objeto ou Error). */
export function getResendErrorMessage(err: unknown): string {
  if (err == null) return 'Erro desconhecido ao enviar e-mail.';
  if (err instanceof Error) return err.message;
  const o = err as Record<string, unknown>;
  if (typeof o?.message === 'string') return o.message;
  if (Array.isArray(o?.errors) && o.errors[0] && typeof (o.errors[0] as any)?.message === 'string') {
    return (o.errors[0] as any).message;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
