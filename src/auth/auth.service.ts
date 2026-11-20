import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { LoginAttemptTracker } from './login-attempt.tracker';
import { PasswordResetService } from './password-reset.service';
import { normalizeEmail } from './normalize-email';
import { resolveCuidadorRoleId } from './cuidador-role';

const SESSION_TTL = '7d';
const REMEMBER_TTL = '30d';
const DUMMY_PASSWORD_HASH = '$2b$10$vdAScm0hNN9eKZoMx6MjouDv8DGF3bLssmfNKYjFlph6x1dloGDf2';

type PublicUser = {
  id_usuario: number;
  nombre: string;
  email: string;
  email_recuperacion: string | null;
  imagen: string | null;
  id_rol: number;
  created_at: Date;
  updated_at: Date;
  rol: { id_rol: number; nombre_rol: string; descripcion: string | null } | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly passwordReset: PasswordResetService,
    private readonly loginAttempts: LoginAttemptTracker,
  ) {}

  async register(dto: RegisterDto) {
    const email = normalizeEmail(dto.email);
    const existing = await this.prisma.usuario.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (existing) {
      throw new ConflictException('Email ya registrado');
    }

    const hash = await bcrypt.hash(dto.contrasena, 10);
    const roleId = await resolveCuidadorRoleId(this.prisma);

    try {
      const user = await this.prisma.usuario.create({
        data: {
          nombre: dto.nombre.trim(),
          email,
          contrasena: hash,
          id_rol: roleId,
        },
        include: { rol: true },
      });
      const token = await this.signToken(
        user.id_usuario,
        user.email,
        user.rol?.nombre_rol,
        user.token_version,
        SESSION_TTL,
      );
      return { user: this.toPublicUser(user), access_token: token, expires_in: SESSION_TTL };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email ya registrado');
      }
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const email = normalizeEmail(dto.email);
    this.loginAttempts.beginAttempt(email);
    let outcome: 'success' | 'failure' | 'cancel' = 'cancel';
    try {
      const users = await this.prisma.usuario.findMany({
        where: { email: { equals: email, mode: 'insensitive' } },
        include: { rol: true },
        take: 2,
      });
      const user = users.length === 1 ? users[0] : null;
      const passwordMatches = await bcrypt.compare(
        dto.contrasena,
        user?.contrasena ?? DUMMY_PASSWORD_HASH,
      );
      if (!user || !passwordMatches) {
        outcome = 'failure';
        throw new UnauthorizedException('Credenciales inválidas');
      }

      outcome = 'success';
      const expiresIn = dto.remember ? REMEMBER_TTL : SESSION_TTL;
      const token = await this.signToken(
        user.id_usuario,
        user.email,
        user.rol?.nombre_rol,
        user.token_version,
        expiresIn,
      );
      return { user: this.toPublicUser(user), access_token: token, expires_in: expiresIn };
    } finally {
      if (outcome === 'success') {
        this.loginAttempts.completeAttempt(email, true);
      } else if (outcome === 'failure') {
        this.loginAttempts.completeAttempt(email, false);
      } else {
        this.loginAttempts.cancelAttempt(email);
      }
    }
  }

  async me(userId: number) {
    const user = await this.prisma.usuario.findUnique({
      where: { id_usuario: userId },
      include: { rol: true },
    });
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado. Token inválido o usuario eliminado.');
    }
    return this.toPublicUser(user);
  }

  requestPasswordReset(email: string) {
    return this.passwordReset.requestCode(email);
  }

  verifyResetCode(email: string, code: string) {
    return this.passwordReset.verifyCode(email, code);
  }

  resetPassword(email: string, code: string, newPassword: string) {
    return this.passwordReset.resetPassword(email, code, newPassword);
  }

  private async signToken(
    sub: number,
    email: string,
    role: string | undefined,
    tokenVersion: number,
    expiresIn: string,
  ) {
    const payload = { id_usuario: sub, email, role, tv: tokenVersion };
    const options: JwtSignOptions = { expiresIn: expiresIn as JwtSignOptions['expiresIn'] };
    return this.jwt.signAsync(payload, options);
  }

  private toPublicUser(user: PublicUser): PublicUser {
    return {
      id_usuario: user.id_usuario,
      nombre: user.nombre,
      email: user.email,
      email_recuperacion: user.email_recuperacion,
      imagen: user.imagen,
      id_rol: user.id_rol,
      created_at: user.created_at,
      updated_at: user.updated_at,
      rol: user.rol
        ? {
            id_rol: user.rol.id_rol,
            nombre_rol: user.rol.nombre_rol,
            descripcion: user.rol.descripcion,
          }
        : null,
    };
  }
}
