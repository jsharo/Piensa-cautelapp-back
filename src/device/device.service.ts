import { ConflictException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { VincularDispositivoDto } from './dto/vincular-dispositivo.dto';
import { UpdateAdultoMayorDto } from './dto/update-adulto-mayor.dto';
import { Esp32ConnectionDto } from './dto/esp32-connection.dto';
import { PrismaService } from '../prisma/prisma.service';
import { DeviceEventsService } from './device-events.service';

@Injectable()
export class DeviceService {
  constructor(
    private prisma: PrismaService,
    private deviceEventsService: DeviceEventsService,
  ) {}

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
    try {
      // Obtener los adultos mayores vinculados a este dispositivo
      const adultosMayores = await this.prisma.adultoMayor.findMany({
        where: { id_dispositivo: id },
        select: { id_adulto: true }
      });

      // Eliminar las relaciones UsuarioAdultoMayor
      if (adultosMayores.length > 0) {
        const adultoIds = adultosMayores.map(a => a.id_adulto);
        await this.prisma.usuarioAdultoMayor.deleteMany({
          where: { id_adulto: { in: adultoIds } }
        });
      }

      // Eliminar los AdultoMayor asociados al dispositivo
      await this.prisma.adultoMayor.deleteMany({
        where: { id_dispositivo: id }
      });

      // Ahora sí eliminar el dispositivo
      await this.prisma.dispositivo.delete({ where: { id_dispositivo: id } });
      return { success: true };
    } catch (error) {
      if (error.code === 'P2025') {
        // Prisma error: record not found
        throw new NotFoundException('Dispositivo no encontrado');
      }
      if (error.code === 'P2003') {
        throw new ConflictException('No se puede eliminar el dispositivo porque está vinculado a otros registros.');
      }
      throw error;
    }
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

    // Mapear y retornar solo los datos que tienen dispositivo asociado
    return relaciones
      .filter(rel => rel.adulto.id_dispositivo !== null)
      .map(rel => ({
        id_adulto: rel.adulto.id_adulto,
        nombre: rel.adulto.nombre,
        fecha_nacimiento: rel.adulto.fecha_nacimiento,
        direccion: rel.adulto.direccion,
        dispositivo: rel.adulto.dispositivo,
      }));
  }

  async updateAdultoMayor(userId: number, adultoId: number, dto: UpdateAdultoMayorDto) {
    // Verificar que el adulto mayor pertenece al usuario
    const relacion = await this.prisma.usuarioAdultoMayor.findUnique({
      where: {
        id_usuario_id_adulto: {
          id_usuario: userId,
          id_adulto: adultoId,
        },
      },
    });

    if (!relacion) {
      throw new ForbiddenException('No tienes permiso para editar este adulto mayor');
    }

    // Actualizar el adulto mayor
    const adultoMayorActualizado = await this.prisma.adultoMayor.update({
      where: { id_adulto: adultoId },
      data: {
        ...(dto.nombre && { nombre: dto.nombre }),
        ...(dto.fecha_nacimiento && { fecha_nacimiento: new Date(dto.fecha_nacimiento) }),
        ...(dto.direccion && { direccion: dto.direccion }),
      },
      include: {
        dispositivo: true,
      },
    });

    return {
      id_adulto: adultoMayorActualizado.id_adulto,
      nombre: adultoMayorActualizado.nombre,
      fecha_nacimiento: adultoMayorActualizado.fecha_nacimiento,
      direccion: adultoMayorActualizado.direccion,
      dispositivo: adultoMayorActualizado.dispositivo,
    };
  }

  /**
   * Maneja la notificación de conexión WiFi del ESP32
   * Si se proporciona mac_address, notifica solo a los usuarios del dispositivo específico
   * Si no se proporciona, notifica a todos los usuarios con dispositivos (fallback)
   */
  async handleEsp32Connection(dto: Esp32ConnectionDto) {
    console.log('[ESP32] Notificación de conexión recibida:', dto);

    let notifiedUsers = 0;
    let notifiedDevices = 0;

    // Si se proporciona mac_address, buscar dispositivo específico
    if (dto.mac_address) {
      const dispositivo = await this.prisma.dispositivo.findUnique({
        where: { mac_address: dto.mac_address },
        include: {
          adultos: {
            include: {
              usuariosAdultoMayor: {
                select: {
                  id_usuario: true,
                },
              },
            },
          },
        },
      });

      if (dispositivo) {
        console.log(`[ESP32] Dispositivo encontrado: ${dispositivo.mac_address}`);
        notifiedDevices = 1;

        // Notificar solo a los usuarios de este dispositivo específico
        for (const adultoMayor of dispositivo.adultos) {
          for (const relacion of adultoMayor.usuariosAdultoMayor) {
            this.deviceEventsService.emitDeviceConnection({
              userId: relacion.id_usuario,
              deviceId: dispositivo.id_dispositivo,
              macAddress: dispositivo.mac_address || 'unknown',
              status: dto.status,
              ssid: dto.ssid,
              rssi: dto.rssi,
              ip: dto.ip,
              timestamp: new Date(),
            });
            notifiedUsers++;
          }
        }

        return {
          success: true,
          message: 'Conexión registrada y usuarios notificados',
          notifiedDevices,
          notifiedUsers,
        };
      } else {
        console.warn(`[ESP32] Dispositivo no encontrado: ${dto.mac_address}`);
        return {
          success: false,
          message: 'Dispositivo no encontrado en la base de datos',
          notifiedDevices: 0,
          notifiedUsers: 0,
        };
      }
    }

    // Fallback: Si no hay mac_address, notificar a todos los dispositivos
    console.log('[ESP32] No se proporcionó mac_address, notificando a todos los dispositivos');
    
    const dispositivos = await this.prisma.dispositivo.findMany({
      include: {
        adultos: {
          include: {
            usuariosAdultoMayor: {
              select: {
                id_usuario: true,
              },
            },
          },
        },
      },
    });

    notifiedDevices = dispositivos.length;

    for (const dispositivo of dispositivos) {
      for (const adultoMayor of dispositivo.adultos) {
        for (const relacion of adultoMayor.usuariosAdultoMayor) {
          this.deviceEventsService.emitDeviceConnection({
            userId: relacion.id_usuario,
            deviceId: dispositivo.id_dispositivo,
            macAddress: dispositivo.mac_address || 'unknown',
            status: dto.status,
            ssid: dto.ssid,
            rssi: dto.rssi,
            ip: dto.ip,
            timestamp: new Date(),
          });
          notifiedUsers++;
        }
      }
    }

    return {
      success: true,
      message: 'Conexión registrada (broadcast a todos los dispositivos)',
      notifiedDevices,
      notifiedUsers,
    };
  }
}
