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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcrypt"));
const prisma_service_1 = require("../prisma/prisma.service");
const email_service_1 = require("../email/email.service");
let AuthService = class AuthService {
    prisma;
    jwt;
    emailService;
    constructor(prisma, jwt, emailService) {
        this.prisma = prisma;
        this.jwt = jwt;
        this.emailService = emailService;
    }
    async register(dto) {
        const exists = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
        if (exists)
            throw new common_1.ConflictException('Email ya registrado');
        const hash = await bcrypt.hash(dto.contrasena, 10);
        let roleId = dto.id_rol;
        if (!roleId) {
            const cuidador = await this.prisma.roles.findFirst({ where: { nombre_rol: 'cuidador' } });
            roleId = cuidador?.id_rol || (await this.ensureDefaultRole()).id_rol;
        }
        const user = await this.prisma.usuario.create({
            data: {
                nombre: dto.nombre,
                email: dto.email,
                contrasena: hash,
                id_rol: roleId,
            },
            include: { rol: true },
        });
        const expiresIn = '7d';
        const token = await this.signToken(user.id_usuario, user.email, user.rol?.nombre_rol, expiresIn);
        return {
            user: this.sanitize(user),
            access_token: token,
            expires_in: expiresIn
        };
    }
    async login(dto) {
        const user = await this.prisma.usuario.findUnique({ where: { email: dto.email }, include: { rol: true } });
        if (!user)
            throw new common_1.UnauthorizedException('Credenciales inválidas');
        const ok = await bcrypt.compare(dto.contrasena, user.contrasena);
        if (!ok)
            throw new common_1.UnauthorizedException('Credenciales inválidas');
        const expiresIn = dto.remember ? '30d' : '7d';
        const token = await this.signToken(user.id_usuario, user.email, user.rol?.nombre_rol, expiresIn);
        return {
            user: this.sanitize(user),
            access_token: token,
            expires_in: expiresIn
        };
    }
    async me(userId) {
        console.log('[AuthService.me] Buscando usuario con ID:', userId);
        const user = await this.prisma.usuario.findUnique({
            where: { id_usuario: userId },
            include: { rol: true }
        });
        if (!user) {
            console.error('[AuthService.me] ERROR: Usuario no encontrado con ID:', userId);
            throw new common_1.UnauthorizedException('Usuario no encontrado. Token inválido o usuario eliminado.');
        }
        console.log('[AuthService.me] Usuario encontrado:', user.email);
        return this.sanitize(user);
    }
    async signToken(sub, email, role, expiresIn) {
        const payload = { id_usuario: sub, email, role };
        if (expiresIn) {
            return this.jwt.signAsync(payload, { expiresIn });
        }
        return this.jwt.signAsync(payload);
    }
    sanitize(user) {
        const { contrasena, ...rest } = user;
        return rest;
    }
    async ensureDefaultRole() {
        return this.prisma.roles.upsert({
            where: { id_rol: 1 },
            update: {},
            create: { nombre_rol: 'cuidador' },
        });
    }
    async forgotPassword(email) {
        const user = await this.prisma.usuario.findFirst({
            where: { email_recuperacion: email }
        });
        if (!user) {
            throw new common_1.BadRequestException('No existe una cuenta con ese correo de recuperación');
        }
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        await this.prisma.passwordReset.upsert({
            where: { email },
            update: { code: resetCode, expiresAt },
            create: {
                email,
                code: resetCode,
                expiresAt,
            },
        });
        try {
            console.log(`[AUTH] Intentando enviar email a: ${email} con código: ${resetCode}`);
            await this.emailService.sendPasswordResetEmail(email, resetCode, user.nombre);
            console.log(`[AUTH] ✅ Email enviado exitosamente a: ${email}`);
        }
        catch (error) {
            console.error('[AUTH] ❌ Error al enviar email:', error);
        }
        return {
            message: 'Se envió un código de verificación a tu correo de recuperación',
            ...(process.env.NODE_ENV === 'development' && { code: resetCode })
        };
    }
    async verifyResetCode(email, code) {
        const resetRecord = await this.prisma.passwordReset.findUnique({ where: { email } });
        if (!resetRecord) {
            throw new common_1.BadRequestException('No hay solicitud de reset activa para este correo');
        }
        if (resetRecord.expiresAt < new Date()) {
            throw new common_1.BadRequestException('El código ha expirado. Solicita uno nuevo');
        }
        if (resetRecord.code !== code) {
            throw new common_1.BadRequestException('Código inválido');
        }
        return { message: 'Código verificado correctamente' };
    }
    async resetPassword(email, code, newPassword) {
        const resetRecord = await this.prisma.passwordReset.findUnique({ where: { email } });
        if (!resetRecord) {
            throw new common_1.BadRequestException('No hay solicitud de reset activa para este correo');
        }
        if (resetRecord.expiresAt < new Date()) {
            throw new common_1.BadRequestException('El código ha expirado. Solicita uno nuevo');
        }
        if (resetRecord.code !== code) {
            throw new common_1.BadRequestException('Código inválido');
        }
        if (newPassword.length < 6) {
            throw new common_1.BadRequestException('La contraseña debe tener al menos 6 caracteres');
        }
        const user = await this.prisma.usuario.findFirst({
            where: { email_recuperacion: email }
        });
        if (!user) {
            throw new common_1.BadRequestException('Usuario no encontrado');
        }
        const hash = await bcrypt.hash(newPassword, 10);
        await this.prisma.usuario.update({
            where: { id_usuario: user.id_usuario },
            data: { contrasena: hash },
        });
        await this.prisma.passwordReset.delete({ where: { email } });
        return { message: 'Contraseña actualizada correctamente' };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        email_service_1.EmailService])
], AuthService);
//# sourceMappingURL=auth.service.js.map