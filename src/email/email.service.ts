import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import sgMail = require('@sendgrid/mail');

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class EmailService {
  private transporter!: nodemailer.Transporter;
  private readonly logger = new Logger(EmailService.name);
  private useSendGrid: boolean = false;

  constructor() {
    if (process.env.SENDGRID_API_KEY) {
      this.useSendGrid = true;
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      this.logger.log('SendGrid configurado');
      return;
    }

    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    this.logger.log(this.canSend() ? 'SMTP configurado' : 'SMTP no configurado');
    if (this.canSend()) {
      this.verifyConnection();
    }
  }

  private async verifyConnection() {
    try {
      this.logger.log('[DEBUG] Intentando verificar conexión SMTP...');
      await this.transporter.verify();
      this.logger.log('✅ Servidor de email conectado correctamente');
    } catch {
      this.logger.error('No se pudo conectar con el servidor SMTP');
      this.logger.warn('Configura SMTP_HOST, SMTP_PORT, SMTP_USER y SMTP_PASS en el archivo .env');
    }
  }

  canSend(): boolean {
    return this.useSendGrid || Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
  }

  async sendPasswordResetEmail(email: string, code: string, userName?: string): Promise<boolean> {
    try {
      this.logger.log('Iniciando envío de correo de recuperación');

      if (this.useSendGrid) {
        const msg = {
          to: email,
          from: process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_USER || 'noreply@cautelapp.com',
          subject: 'Código de Recuperación de Contraseña - CautelApp',
          html: this.getPasswordResetEmailTemplate(escapeHtml(code), escapeHtml(userName || 'Usuario')),
        };

        await sgMail.send(msg);
        this.logger.log('Correo de recuperación enviado por SendGrid');
        return true;
      }

      if (!this.canSend()) {
        this.logger.error('No se envió el correo de recuperación: SMTP no está configurado');
        return false;
      }

      const info = await this.transporter.sendMail({
        from: `"CautelApp - Recuperación de Contraseña" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Código de Recuperación de Contraseña - CautelApp',
        html: this.getPasswordResetEmailTemplate(escapeHtml(code), escapeHtml(userName || 'Usuario')),
      });

      this.logger.log(`Correo de recuperación enviado: ${info.messageId}`);
      return true;
    } catch {
      this.logger.error('No se pudo enviar el correo de recuperación');
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
        <title>Recuperación de Contraseña - CautelApp</title>
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
            <h1>🔐 CautelApp</h1>
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
              Ingrésalo en la aplicación CautelApp para crear tu nueva contraseña.
            </p>
          </div>
          
          <div class="footer">
            <p><strong>CautelApp</strong> - Sistema de Monitoreo para Adultos Mayores</p>
            <p>Este es un email automático, por favor no respondas a este mensaje.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
