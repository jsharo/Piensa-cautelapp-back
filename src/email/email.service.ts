import { Injectable, Logger } from '@nestjs/common';
import { BrevoClient, BrevoError } from '@getbrevo/brevo';
import { PasswordResetMailer } from './password-reset-mailer';

const DISPLAY_NAME_LIMIT = 70;

function readEnv(name: string): string {
  return process.env[name]?.trim() ?? '';
}

function displayName(value: string, fallback: string): string {
  const cleaned = value.replace(/[\r\n\t]/g, ' ').trim();
  const chosen = cleaned || fallback;
  return Array.from(chosen).slice(0, DISPLAY_NAME_LIMIT).join('');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class EmailService implements PasswordResetMailer {
  private readonly logger = new Logger(EmailService.name);
  private readonly client: BrevoClient | null;
  private readonly senderEmail: string;
  private readonly senderName: string;

  constructor() {
    const apiKey = readEnv('BREVO_API_KEY');
    this.senderEmail = readEnv('BREVO_SENDER_EMAIL');
    this.senderName = displayName(readEnv('BREVO_SENDER_NAME'), 'Tatara');
    this.client = apiKey
      ? new BrevoClient({
          apiKey,
          maxRetries: 1,
          timeoutInSeconds: 15,
          logging: { silent: true },
        })
      : null;

    if (this.canSend()) {
      this.logger.log('Brevo configurado');
    } else {
      this.logger.warn('Brevo no configurado: define BREVO_API_KEY y BREVO_SENDER_EMAIL');
    }
  }

  canSend(): boolean {
    return Boolean(this.client && this.senderEmail.includes('@'));
  }

  async sendPasswordResetEmail(email: string, code: string, userName?: string): Promise<boolean> {
    if (!this.client || !this.canSend()) {
      this.logger.error('No se envió el correo de recuperación: Brevo no está configurado');
      return false;
    }

    const recipientName = displayName(userName ?? '', 'Usuario');

    try {
      await this.client.transactionalEmails.sendTransacEmail({
        sender: { email: this.senderEmail, name: this.senderName },
        to: [{ email, name: recipientName, contactPixelTrackingConsent: false }],
        subject: '🔐 Código de Recuperación de Contraseña - Tatara',
        htmlContent: this.getPasswordResetEmailTemplate(escapeHtml(code), escapeHtml(recipientName)),
        textContent: `Hola ${recipientName}. Tu código de verificación de Tatara es ${code}. Expira en 15 minutos. Si no solicitaste este cambio, ignora este mensaje.`,
      });
      this.logger.log('Correo de recuperación enviado');
      return true;
    } catch (error: unknown) {
      const status = error instanceof BrevoError ? error.statusCode : undefined;
      this.logger.error(
        status === undefined
          ? 'No se pudo enviar el correo de recuperación'
          : `No se pudo enviar el correo de recuperación (HTTP ${status})`,
      );
      return false;
    }
  }

  private getPasswordResetEmailTemplate(code: string, userName: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Recuperación de Contraseña - Tatara</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #DEEFE7;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
          }
          .header {
            background: linear-gradient(135deg, #159A9C 0%, #0f7d7f 100%);
            padding: 40px 20px;
            text-align: center;
          }
          .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 28px;
            font-weight: 700;
          }
          .content {
            padding: 40px 30px;
          }
          .greeting {
            font-size: 18px;
            color: #002333;
            margin-bottom: 20px;
            font-weight: 600;
          }
          .message {
            font-size: 15px;
            color: #555;
            line-height: 1.6;
            margin-bottom: 30px;
          }
          .code-container {
            background: linear-gradient(135deg, #DEEFE7 0%, #c8e9e6 100%);
            border-radius: 12px;
            padding: 30px;
            text-align: center;
            margin: 30px 0;
            border: 2px solid #159A9C;
          }
          .code-label {
            font-size: 14px;
            color: #002333;
            font-weight: 600;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .code {
            font-size: 36px;
            font-weight: 700;
            color: #159A9C;
            letter-spacing: 8px;
            margin: 10px 0;
            font-family: 'Courier New', monospace;
          }
          .warning {
            background: #fef5f5;
            border-left: 4px solid #e74c3c;
            padding: 15px;
            margin: 20px 0;
            border-radius: 6px;
          }
          .warning p {
            margin: 0;
            font-size: 14px;
            color: #c0392b;
          }
          .info {
            background: #e3f2fd;
            border-left: 4px solid #2196F3;
            padding: 15px;
            margin: 20px 0;
            border-radius: 6px;
          }
          .info p {
            margin: 0;
            font-size: 14px;
            color: #1976D2;
          }
          .footer {
            background: #f8f9fa;
            padding: 30px;
            text-align: center;
            color: #777;
            font-size: 13px;
            line-height: 1.6;
          }
          .footer strong {
            color: #159A9C;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Tatara</h1>
          </div>
          
          <div class="content">
            <p class="greeting">Hola ${userName},</p>
            
            <p class="message">
              Hemos recibido una solicitud para recuperar tu contraseña. 
              Usa el siguiente código de verificación para continuar con el proceso:
            </p>
            
            <div class="code-container">
              <div class="code-label">Tu Código de Verificación</div>
              <div class="code">${code}</div>
            </div>
            
            <div class="warning">
              <p><strong>⚠️ Importante:</strong> Este código expira en 15 minutos por seguridad.</p>
            </div>
            
            <div class="info">
              <p><strong>ℹ️ ¿No solicitaste este cambio?</strong> Si no fuiste tú quien solicitó recuperar la contraseña, ignora este email. Tu cuenta permanece segura.</p>
            </div>
            
            <p class="message">
              Este código es único y solo puede usarse una vez. 
              Ingrésalo en la aplicación Tatara para crear tu nueva contraseña.
            </p>
          </div>
          
          <div class="footer">
            <p><strong>Tatara</strong> - Sistema de Monitoreo para Adultos Mayores</p>
            <p>Este es un email automático, por favor no respondas a este mensaje.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
