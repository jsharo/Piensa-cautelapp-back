import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

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
    const payload = { sub, email, role };
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
}
