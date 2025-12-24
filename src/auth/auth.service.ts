import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService, 
    private jwt: JwtService,
    private emailService: EmailService
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email ya registrado');

    const hash = await bcrypt.hash(dto.contrasena, 10);

    // Si no se envía id_rol, asignar el primero con nombre cuidador si existe
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
        id_rol: roleId!,
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

  async login(dto: LoginDto) {
    const user = await this.prisma.usuario.findUnique({ where: { email: dto.email }, include: { rol: true } });
    if (!user) throw new UnauthorizedException('Credenciales inválidas');
    const ok = await bcrypt.compare(dto.contrasena, user.contrasena);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');
    
    // Si remember es true, el token dura 30 días, sino 7 días
    const expiresIn = dto.remember ? '30d' : '7d';
    const token = await this.signToken(user.id_usuario, user.email, user.rol?.nombre_rol, expiresIn);
    
    return { 
      user: this.sanitize(user), 
      access_token: token,
      expires_in: expiresIn 
    };
  }

  async me(userId: number) {
    const user = await this.prisma.usuario.findUnique({ where: { id_usuario: userId }, include: { rol: true } });
    return this.sanitize(user!);
  }

  private async signToken(sub: number, email: string, role?: string, expiresIn?: string) {
    const payload = { id_usuario: sub, email, role };
    if (expiresIn) {
      return this.jwt.signAsync(payload, { expiresIn } as any);
    }
    return this.jwt.signAsync(payload);
  }

  private sanitize(user: any) {
    // no devolver contrasena
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { contrasena, ...rest } = user;
    return rest;
  }

  private async ensureDefaultRole() {
    return this.prisma.roles.upsert({
      where: { id_rol: 1 },
      update: {},
      create: { nombre_rol: 'cuidador' },
    });
  }

  async forgotPassword(email: string) {
    // Buscar usuario por email de recuperación
    const user = await this.prisma.usuario.findFirst({ 
      where: { email_recuperacion: email } 
    });
    
    if (!user) {
      throw new BadRequestException('No existe una cuenta con ese correo de recuperación');
    }

    // Generar código aleatorio de 6 dígitos
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Guardar el código con expiración de 15 minutos
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

    // Enviar email con el código
    try {
      await this.emailService.sendPasswordResetEmail(email, resetCode, user.nombre);
    } catch (error) {
      console.error('Error al enviar email:', error);
      // Continuar de todos modos para desarrollo
    }

    return { 
      message: 'Se envió un código de verificación a tu correo de recuperación',
      // En producción, NO devolvemos el código
      ...(process.env.NODE_ENV === 'development' && { code: resetCode })
    };
  }

  async verifyResetCode(email: string, code: string) {
    const resetRecord = await this.prisma.passwordReset.findUnique({ where: { email } });
    
    if (!resetRecord) {
      throw new BadRequestException('No hay solicitud de reset activa para este correo');
    }

    if (resetRecord.expiresAt < new Date()) {
      throw new BadRequestException('El código ha expirado. Solicita uno nuevo');
    }

    if (resetRecord.code !== code) {
      throw new BadRequestException('Código inválido');
    }

    return { message: 'Código verificado correctamente' };
  }

  async resetPassword(email: string, code: string, newPassword: string) {
    // Verificar el código primero
    const resetRecord = await this.prisma.passwordReset.findUnique({ where: { email } });
    
    if (!resetRecord) {
      throw new BadRequestException('No hay solicitud de reset activa para este correo');
    }

    if (resetRecord.expiresAt < new Date()) {
      throw new BadRequestException('El código ha expirado. Solicita uno nuevo');
    }

    if (resetRecord.code !== code) {
      throw new BadRequestException('Código inválido');
    }

    // Validar contraseña
    if (newPassword.length < 6) {
      throw new BadRequestException('La contraseña debe tener al menos 6 caracteres');
    }

    // Buscar usuario por email de recuperación
    const user = await this.prisma.usuario.findFirst({
      where: { email_recuperacion: email }
    });

    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    // Actualizar contraseña
    const hash = await bcrypt.hash(newPassword, 10);
    
    await this.prisma.usuario.update({
      where: { id_usuario: user.id_usuario },
      data: { contrasena: hash },
    });

    // Eliminar el registro de reset
    await this.prisma.passwordReset.delete({ where: { email } });

    return { message: 'Contraseña actualizada correctamente' };
  }
}
