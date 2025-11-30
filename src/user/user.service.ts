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
    const user = await this.prisma.usuario.create({
      data: {
        nombre: dto.nombre,
        email: dto.email,
        contrasena: hash,
        id_rol: dto.id_rol ?? (await this.ensureDefaultRole()).id_rol,
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
    const data: any = { ...dto };
    if (dto.contrasena) {
      data.contrasena = await bcrypt.hash(dto.contrasena, 10);
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