"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var EmailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const common_1 = require("@nestjs/common");
const nodemailer = __importStar(require("nodemailer"));
const sgMail = require("@sendgrid/mail");
let EmailService = EmailService_1 = class EmailService {
    transporter;
    logger = new common_1.Logger(EmailService_1.name);
    useSendGrid = false;
    constructor() {
        this.logger.log(`[DEBUG] SMTP_HOST: ${process.env.SMTP_HOST || 'NO CONFIGURADO'}`);
        this.logger.log(`[DEBUG] SMTP_PORT: ${process.env.SMTP_PORT || 'NO CONFIGURADO'}`);
        this.logger.log(`[DEBUG] SMTP_USER: ${process.env.SMTP_USER || 'NO CONFIGURADO'}`);
        this.logger.log(`[DEBUG] SMTP_PASS existe: ${process.env.SMTP_PASS ? 'SÍ' : 'NO'}`);
        this.logger.log(`[DEBUG] SMTP_PASS longitud: ${process.env.SMTP_PASS?.length || 0} caracteres`);
        this.logger.log(`[DEBUG] SENDGRID_API_KEY existe: ${process.env.SENDGRID_API_KEY ? 'SÍ' : 'NO'}`);
        if (process.env.SENDGRID_API_KEY) {
            this.useSendGrid = true;
            sgMail.setApiKey(process.env.SENDGRID_API_KEY);
            this.logger.log('✅ SendGrid configurado correctamente');
        }
        else {
            this.transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: parseInt(process.env.SMTP_PORT || '465'),
                secure: true,
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });
            this.verifyConnection();
        }
    }
    async verifyConnection() {
        try {
            this.logger.log('[DEBUG] Intentando verificar conexión SMTP...');
            await this.transporter.verify();
            this.logger.log('✅ Servidor de email conectado correctamente');
        }
        catch (error) {
            this.logger.error('❌ Error al conectar con el servidor SMTP:');
            this.logger.error(`[ERROR] Mensaje: ${error.message}`);
            this.logger.error(`[ERROR] Código: ${error.code}`);
            this.logger.error(`[ERROR] Comando: ${error.command}`);
            this.logger.warn('⚠️  No se pudo conectar al servidor de email. Los emails se mostrarán en consola.');
            this.logger.warn('Configura SMTP_HOST, SMTP_PORT, SMTP_USER y SMTP_PASS en el archivo .env');
        }
    }
    async sendPasswordResetEmail(email, code, userName) {
        try {
            this.logger.log(`[EMAIL] Iniciando envío de email a: ${email}`);
            if (this.useSendGrid) {
                this.logger.log(`[EMAIL] Usando SendGrid para enviar email...`);
                const msg = {
                    to: email,
                    from: process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_USER || 'noreply@cautelapp.com',
                    subject: '🔐 Código de Recuperación de Contraseña - CautelApp',
                    html: this.getPasswordResetEmailTemplate(code, userName || 'Usuario'),
                };
                await sgMail.send(msg);
                this.logger.log(`✅ Email enviado exitosamente vía SendGrid`);
                return true;
            }
            this.logger.log(`[EMAIL] SMTP_USER configurado: ${process.env.SMTP_USER ? 'Sí' : 'No'}`);
            this.logger.log(`[EMAIL] SMTP_PASS configurado: ${process.env.SMTP_PASS ? 'Sí (oculto)' : 'No'}`);
            if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
                this.logger.log(`\n${'='.repeat(60)}`);
                this.logger.log(`📧 EMAIL DE RECUPERACIÓN DE CONTRASEÑA`);
                this.logger.log(`${'='.repeat(60)}`);
                this.logger.log(`Para: ${email}`);
                this.logger.log(`Nombre: ${userName || 'Usuario'}`);
                this.logger.log(`Código: ${code}`);
                this.logger.log(`${'='.repeat(60)}\n`);
                return true;
            }
            this.logger.log(`[EMAIL] Enviando email real vía SMTP...`);
            const info = await this.transporter.sendMail({
                from: `"CautelApp - Recuperación de Contraseña" <${process.env.SMTP_USER}>`,
                to: email,
                subject: '🔐 Código de Recuperación de Contraseña - CautelApp',
                html: this.getPasswordResetEmailTemplate(code, userName || 'Usuario'),
            });
            this.logger.log(`✅ Email enviado exitosamente: ${info.messageId}`);
            this.logger.log(`[EMAIL] Respuesta del servidor: ${info.response}`);
            return true;
        }
        catch (error) {
            this.logger.error('❌ Error al enviar email:', error);
            this.logger.error(`[EMAIL] Detalles del error: ${error.message}`);
            this.logger.log(`\n${'='.repeat(60)}`);
            this.logger.log(`📧 EMAIL DE RECUPERACIÓN (FALLBACK)`);
            this.logger.log(`${'='.repeat(60)}`);
            this.logger.log(`Para: ${email}`);
            this.logger.log(`Código: ${code}`);
            this.logger.log(`${'='.repeat(60)}\n`);
            return true;
        }
    }
    getPasswordResetEmailTemplate(code, userName) {
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
};
exports.EmailService = EmailService;
exports.EmailService = EmailService = EmailService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], EmailService);
//# sourceMappingURL=email.service.js.map