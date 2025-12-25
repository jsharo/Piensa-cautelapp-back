import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { VincularDispositivoDto } from './dto/vincular-dispositivo.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DeviceService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateDeviceDto) {
    if (dto.mac_address) {
      const exists = await this.prisma.dispositivo.findUnique({ where: { mac_address: dto.mac_address } });
      if (exists) throw new ConflictException('mac_address ya registrado');
    }
    const device = await this.prisma.dispositivo.create({
      data: {
        bateria: dto.bateria ?? 100,
        mac_address: dto.mac_address,
      },
    });
    return device;
  }

  async findAll() {
    return this.prisma.dispositivo.findMany();
  }

  async findOne(id: number) {
    const device = await this.prisma.dispositivo.findUnique({ where: { id_dispositivo: id } });
    if (!device) throw new NotFoundException('Dispositivo no encontrado');
    return device;
  }

  async update(id: number, dto: UpdateDeviceDto) {
    if (dto.mac_address) {
      const exists = await this.prisma.dispositivo.findUnique({ where: { mac_address: dto.mac_address } });
      if (exists && exists.id_dispositivo !== id) throw new ConflictException('mac_address ya registrado en otro dispositivo');
    }
    const device = await this.prisma.dispositivo.update({
      where: { id_dispositivo: id },
      data: dto,
    });
    return device;
  }

  async remove(id: number) {
    await this.prisma.dispositivo.delete({ where: { id_dispositivo: id } });
    return { success: true };
  }

  async vincularDispositivoAUsuario(userId: number, dto: VincularDispositivoDto) {
    // 1. Verificar si el dispositivo ya existe
    let dispositivo = await this.prisma.dispositivo.findUnique({
      where: { mac_address: dto.mac_address },
    });

    // 2. Si no existe, crear el dispositivo
    if (!dispositivo) {
      dispositivo = await this.prisma.dispositivo.create({
        data: {
          mac_address: dto.mac_address,
          bateria: dto.bateria,
        },
      });
    } else {
      // Si existe, actualizar la batería
      dispositivo = await this.prisma.dispositivo.update({
        where: { id_dispositivo: dispositivo.id_dispositivo },
        data: { bateria: dto.bateria },
      });
    }

    // 3. Verificar si ya existe un adulto mayor con este dispositivo
    const adultoExistente = await this.prisma.adultoMayor.findFirst({
      where: { id_dispositivo: dispositivo.id_dispositivo },
    });

    let adultoMayor;
    if (adultoExistente) {
      // Usar el adulto mayor existente
      adultoMayor = adultoExistente;
    } else {
      // 4. Crear un adulto mayor asociado al dispositivo
      adultoMayor = await this.prisma.adultoMayor.create({
        data: {
          nombre: dto.nombre_adulto || `Dispositivo ${dto.mac_address}`,
          fecha_nacimiento: dto.fecha_nacimiento 
            ? new Date(dto.fecha_nacimiento) 
            : new Date('1950-01-01'),
          direccion: dto.direccion || 'Ubicación no especificada',
          id_dispositivo: dispositivo.id_dispositivo,
        },
      });
    }

    // 5. Verificar si ya existe la relación Usuario-AdultoMayor
    const relacionExistente = await this.prisma.usuarioAdultoMayor.findUnique({
      where: {
        id_usuario_id_adulto: {
          id_usuario: userId,
          id_adulto: adultoMayor.id_adulto,
        },
      },
    });

    // 6. Si no existe la relación, crearla
    if (!relacionExistente) {
      await this.prisma.usuarioAdultoMayor.create({
        data: {
          id_usuario: userId,
          id_adulto: adultoMayor.id_adulto,
        },
      });
    }

    // 7. Retornar la información completa
    return {
      dispositivo,
      adultoMayor,
      mensaje: relacionExistente 
        ? 'Dispositivo ya vinculado a tu cuenta' 
        : 'Dispositivo vinculado exitosamente',
    };
  }

  async obtenerDispositivosDeUsuario(userId: number) {
    // Obtener todos los adultos mayores vinculados al usuario
    const relaciones = await this.prisma.usuarioAdultoMayor.findMany({
      where: { id_usuario: userId },
      include: {
        adulto: {
          include: {
            dispositivo: true,
          },
        },
      },
    });

    // Mapear y retornar los datos
    return relaciones.map(rel => ({
      id_adulto: rel.adulto.id_adulto,
      nombre: rel.adulto.nombre,
      fecha_nacimiento: rel.adulto.fecha_nacimiento,
      direccion: rel.adulto.direccion,
      dispositivo: rel.adulto.dispositivo,
    }));
  }
}
