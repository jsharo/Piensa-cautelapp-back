import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email ya registrado');
    const hash = await bcrypt.hash(dto.contrasena, 10);
    // Asignar siempre el rol "cuidador" desde BD, ignorando cualquier id_rol entrante
    const defaultRole = await this.ensureDefaultRole();
    const user = await this.prisma.usuario.create({
      data: {
        nombre: dto.nombre,
        email: dto.email,
        contrasena: hash,
        id_rol: defaultRole.id_rol,
      },
      include: { rol: true },
    });
    const { contrasena, ...rest } = user;
    return rest;
  }

  async findAll() {
    const users = await this.prisma.usuario.findMany({ include: { rol: true } });
    return users.map(({ contrasena, ...rest }) => rest);
  }

  async findOne(id: number) {
    const user = await this.prisma.usuario.findUnique({ where: { id_usuario: id }, include: { rol: true } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const { contrasena, ...rest } = user;
    return rest;
  }

  async update(id: number, dto: UpdateUserDto) {
    const data: any = {};
    
    // Solo incluir campos que están definidos
    if (dto.nombre !== undefined) {
      data.nombre = dto.nombre;
    }
    if (dto.imagen !== undefined) {
      data.imagen = dto.imagen;
    }
    if (dto.contrasena !== undefined) {
      data.contrasena = await bcrypt.hash(dto.contrasena, 10);
    }
    if (dto.email !== undefined) {
      // Verificar que el email no esté en uso por otro usuario
      const emailExists = await this.prisma.usuario.findUnique({
        where: { email: dto.email }
      });
      
      if (emailExists && emailExists.id_usuario !== id) {
        throw new ConflictException('Este correo electrónico ya está en uso');
      }
      
      data.email = dto.email;
    }
    
    if (dto.email_recuperacion !== undefined) {
      // Verificar que el email de recuperación no esté en uso
      if (dto.email_recuperacion) {
        const emailRecExists = await this.prisma.usuario.findUnique({
          where: { email_recuperacion: dto.email_recuperacion }
        });
        
        if (emailRecExists && emailRecExists.id_usuario !== id) {
          throw new ConflictException('Este correo de recuperación ya está en uso');
        }
      }
      
      data.email_recuperacion = dto.email_recuperacion;
    }

    const user = await this.prisma.usuario.update({ where: { id_usuario: id }, data, include: { rol: true } });
    const { contrasena, ...rest } = user;
    return rest;
  }

  async remove(id: number) {
    await this.prisma.usuario.delete({ where: { id_usuario: id } });
    return { success: true };
  }

  private async ensureDefaultRole() {
    return this.prisma.roles.upsert({ where: { id_rol: 1 }, update: {}, create: { nombre_rol: 'cuidador' } });
  }
}