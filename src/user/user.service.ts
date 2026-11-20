import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeEmail } from '../auth/normalize-email';
import { resolveCuidadorRoleId } from '../auth/cuidador-role';
import { SessionService } from '../auth/session.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private sessions: SessionService,
  ) {}

  async create(dto: CreateUserDto) {
    const email = normalizeEmail(dto.email);
    const exists = await this.prisma.usuario.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (exists) throw new ConflictException('Email ya registrado');
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
      return this.toPublicUser(user);
    } catch (error) {
      this.rethrowKnown(error);
    }
  }

  async findAll(callerId: number) {
    const users = await this.prisma.usuario.findMany({
      where: { id_usuario: callerId },
      include: { rol: true },
    });
    return users.map((user) => this.toPublicUser(user));
  }

  async findOne(id: number) {
    const user = await this.prisma.usuario.findUnique({ where: { id_usuario: id }, include: { rol: true } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const { contrasena, fcm_token, token_version, ...rest } = user;
    return rest;
  }

  async update(id: number, dto: UpdateUserDto) {
    const data: Prisma.UsuarioUpdateInput = {};

    if (dto.nombre !== undefined) {
      data.nombre = dto.nombre.trim();
    }
    if (dto.imagen !== undefined) {
      data.imagen = dto.imagen;
    }
    if (dto.contrasena !== undefined) {
      if (!dto.contrasena_actual) {
        throw new BadRequestException('Debes indicar la contraseña actual');
      }
      const current = await this.prisma.usuario.findUnique({
        where: { id_usuario: id },
        select: { contrasena: true },
      });
      if (!current) throw new NotFoundException('Usuario no encontrado');
      const matches = await bcrypt.compare(dto.contrasena_actual, current.contrasena);
      if (!matches) {
        throw new BadRequestException('La contraseña actual no es correcta');
      }
      data.contrasena = await bcrypt.hash(dto.contrasena, 10);
      data.token_version = { increment: 1 };
    }
    if (dto.email !== undefined) {
      const email = normalizeEmail(dto.email);
      const emailExists = await this.prisma.usuario.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
      });
      if (emailExists && emailExists.id_usuario !== id) {
        throw new ConflictException('Este correo electrónico ya está en uso');
      }
      data.email = email;
    }
    if (dto.email_recuperacion !== undefined) {
      const recovery = normalizeEmail(dto.email_recuperacion);
      const emailRecExists = await this.prisma.usuario.findFirst({
        where: { email_recuperacion: { equals: recovery, mode: 'insensitive' } },
      });
      if (emailRecExists && emailRecExists.id_usuario !== id) {
        throw new ConflictException('Este correo de recuperación ya está en uso');
      }
      data.email_recuperacion = recovery;
    }

    try {
      const user = await this.prisma.usuario.update({
        where: { id_usuario: id },
        data,
        include: { rol: true },
      });
      if (dto.contrasena !== undefined) {
        await this.sessions.revokeAll(id);
      }
      return this.toPublicUser(user);
    } catch (error) {
      this.rethrowKnown(error);
    }
  }

  async remove(id: number) {
    try {
      await this.prisma.usuario.delete({ where: { id_usuario: id } });
    } catch (error) {
      this.rethrowKnown(error);
    }
    return { success: true };
  }

  // Métodos para manejar tokens FCM
  async saveFcmToken(userId: number, fcmToken: string): Promise<void> {
    if (fcmToken.length === 0 || fcmToken.length > 4096) {
      throw new BadRequestException('Token de notificaciones inválido');
    }
    try {
      await this.prisma.usuario.update({
        where: { id_usuario: userId },
        data: { fcm_token: fcmToken },
      });
    } catch (error) {
      this.rethrowKnown(error);
    }
  }

  async deleteFcmToken(userId: number): Promise<void> {
    await this.prisma.usuario.update({
      where: { id_usuario: userId },
      data: { fcm_token: null },
    });
  }

  async getUsersByFcmToken(): Promise<any[]> {
    return this.prisma.usuario.findMany({
      where: {
        fcm_token: {
          not: null,
        },
      },
      select: {
        id_usuario: true,
        nombre: true,
        email: true,
        fcm_token: true,
      },
    });
  }

  private toPublicUser<T extends { contrasena: string; fcm_token: string | null; token_version: number }>(user: T) {
    const { contrasena, fcm_token, token_version, ...rest } = user;
    return rest;
  }

  private rethrowKnown(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException('Este correo ya está en uso');
      }
      if (error.code === 'P2025') {
        throw new NotFoundException('Usuario no encontrado');
      }
    }
    throw error;
  }

}