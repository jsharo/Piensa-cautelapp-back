import { ConflictException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { VincularDispositivoDto } from './dto/vincular-dispositivo.dto';
import { UpdateAdultoMayorDto } from './dto/update-adulto-mayor.dto';
import { Esp32ConnectionDto } from './dto/esp32-connection.dto';
import { Esp32SensorDataDto } from './dto/esp32-sensor-data.dto';
import { PrismaService } from '../prisma/prisma.service';
import { DeviceEventsService } from './device-events.service';

@Injectable()
export class DeviceService {
  // Almacenamiento temporal en memoria de dispositivos conectados (no persistente)
  private connectedDevices = new Map<string, {
    deviceId: string;
    ssid: string;
    ip: string;
    rssi?: number;
    userId?: string;
  }>();

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

  /**
   * Permite a un usuario dejar de monitorear un dispositivo
   * Valida que el usuario sea propietario del dispositivo antes de eliminarlo
   */
  async stopMonitoringDevice(userId: number, deviceId: number) {
    try {
      console.log(`[STOP_MONITORING] Iniciando eliminación para usuario ${userId}, adulto ${deviceId}`);

      // Verificar que el usuario es propietario del dispositivo
      const adultoMayor = await this.prisma.adultoMayor.findUnique({
        where: { id_adulto: deviceId },
        include: { dispositivo: true }
      });

      if (!adultoMayor) {
        console.error(`[STOP_MONITORING] AdultoMayor ${deviceId} no encontrado`);
        throw new NotFoundException('Dispositivo no encontrado');
      }

      console.log(`[STOP_MONITORING] AdultoMayor encontrado:`, {
        id_adulto: adultoMayor.id_adulto,
        nombre: adultoMayor.nombre,
        id_dispositivo: adultoMayor.id_dispositivo
      });

      // Verificar la relación usuario-adulto
      const relacion = await this.prisma.usuarioAdultoMayor.findUnique({
        where: {
          id_usuario_id_adulto: {
            id_usuario: userId,
            id_adulto: deviceId,
          },
        },
      });

      if (!relacion) {
        console.error(`[STOP_MONITORING] Usuario ${userId} no tiene relación con adulto ${deviceId}`);
        throw new ForbiddenException('No tienes permiso para dejar de monitorear este dispositivo');
      }

      console.log(`[STOP_MONITORING] Relación usuario-adulto verificada. Eliminando...`);

      // Eliminar la relación usuario-adulto mayor
      await this.prisma.usuarioAdultoMayor.delete({
        where: {
          id_usuario_id_adulto: {
            id_usuario: userId,
            id_adulto: deviceId,
          },
        },
      });
      console.log(`[STOP_MONITORING] ✓ Relación UsuarioAdultoMayor eliminada`);

      // Verificar si el adulto mayor tiene otras relaciones con otros usuarios
      const otrasRelaciones = await this.prisma.usuarioAdultoMayor.findMany({
        where: { id_adulto: deviceId },
      });

      console.log(`[STOP_MONITORING] Otras relaciones del adulto: ${otrasRelaciones.length}`);

      // Si no hay otras relaciones, eliminar el adulto mayor y el dispositivo
      if (otrasRelaciones.length === 0) {
        const dispositivo = adultoMayor.id_dispositivo;
        
        console.log(`[STOP_MONITORING] Sin otras relaciones, eliminando AdultoMayor...`);

        // Eliminar el adulto mayor
        await this.prisma.adultoMayor.delete({
          where: { id_adulto: deviceId },
        });
        console.log(`[STOP_MONITORING] ✓ AdultoMayor ${deviceId} eliminado`);

        // Eliminar el dispositivo si no tiene otros adultos mayores vinculados
        if (dispositivo) {
          console.log(`[STOP_MONITORING] Verificando si dispositivo ${dispositivo} tiene otros adultos...`);
          const otrosAdultos = await this.prisma.adultoMayor.findMany({
            where: { id_dispositivo: dispositivo },
          });

          console.log(`[STOP_MONITORING] Otros adultos en dispositivo: ${otrosAdultos.length}`);

          if (otrosAdultos.length === 0) {
            console.log(`[STOP_MONITORING] Eliminando Dispositivo ${dispositivo}...`);
            await this.prisma.dispositivo.delete({
              where: { id_dispositivo: dispositivo },
            });
            console.log(`[STOP_MONITORING] ✓ Dispositivo ${dispositivo} eliminado`);
          } else {
            console.log(`[STOP_MONITORING] Dispositivo ${dispositivo} no eliminado (aún tiene adultos)`);
          }
        }
      } else {
        console.log(`[STOP_MONITORING] Adulto ${deviceId} NO eliminado (otras relaciones existen)`);
      }

      console.log(`[STOP_MONITORING] ✓ Proceso completado exitosamente`);
      return { success: true, message: 'Dispositivo eliminado completamente' };
    } catch (error) {
      console.error(`[STOP_MONITORING] ✗ Error en eliminación:`, error);
      if (error.code === 'P2025') {
        throw new NotFoundException('Dispositivo o relación no encontrada');
      }
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
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
   * Guarda el estado en memoria (no en BD)
   */
  async handleEsp32Connection(dto: Esp32ConnectionDto) {
    console.log('[ESP32] Notificación de conexión recibida:', dto);

    // Guardar el estado de conexión en memoria
    this.connectedDevices.set(dto.deviceId, {
      deviceId: dto.deviceId,
      ssid: dto.ssid,
      ip: dto.ip,
      rssi: dto.rssi,
      userId: dto.userId,
    });

    console.log(`[ESP32] Dispositivo ${dto.deviceId} registrado en memoria`);
    if (dto.userId) {
      console.log(`[ESP32] User ID asociado: ${dto.userId}`);
      
      // Emitir evento SSE al usuario para notificar conexión exitosa
      this.deviceEventsService.emitDeviceConnection({
        deviceId: dto.deviceId,
        userId: parseInt(dto.userId),
        ssid: dto.ssid,
        ip: dto.ip,
        rssi: dto.rssi || 0,
        status: 'connected',
      });
      console.log(`[ESP32] Evento SSE emitido al usuario ${dto.userId}`);
    }
    console.log(`[ESP32] Total dispositivos en memoria: ${this.connectedDevices.size}`);

    return {
      success: true,
      message: 'Conexión registrada en memoria',
      deviceId: dto.deviceId,
      userId: dto.userId,
    };
  }

  /**
   * Consulta si un dispositivo (por nombre) está conectado
   * No consulta la BD, solo la memoria temporal
   */
  async checkDeviceConnectionStatus(deviceName: string) {
    const deviceInfo = this.connectedDevices.get(deviceName);

    if (deviceInfo) {
      console.log(`[ESP32] Dispositivo ${deviceName} encontrado: conectado`);
      return {
        connected: true,
        deviceId: deviceInfo.deviceId,
        ssid: deviceInfo.ssid,
        ip: deviceInfo.ip,
        rssi: deviceInfo.rssi,
        userId: deviceInfo.userId,
      };
    }

    console.log(`[ESP32] Dispositivo ${deviceName} no encontrado en memoria`);
    return {
      connected: false,
      message: 'Dispositivo no conectado aún',
    };
  }

  /**
   * Limpia el estado de conexión de un dispositivo de la memoria
   */
  clearDeviceConnectionStatus(deviceName: string) {
    const removed = this.connectedDevices.delete(deviceName);
    console.log(`[ESP32] Estado de ${deviceName} eliminado de memoria: ${removed}`);
    return { success: removed };
  }

  /**
   * Procesa y almacena datos de sensores enviados por el ESP32
   * Recibe datos de MPU6050 (aceleración, detección de caídas) y MAX30102 (ritmo cardíaco)
   * Los datos se guardan en la tabla SensorData para análisis histórico
   */
  async handleEsp32SensorData(dto: Esp32SensorDataDto) {
    console.log('[ESP32-SENSORS] Datos de sensores recibidos:', dto);

    try {
      // 1. Buscar o crear el dispositivo por device_id
      let dispositivo = await this.prisma.dispositivo.findUnique({
        where: { device_id: dto.deviceId },
      });

      if (!dispositivo) {
        console.log(`[ESP32-SENSORS] Dispositivo ${dto.deviceId} no encontrado, creando...`);
        dispositivo = await this.prisma.dispositivo.create({
          data: {
            device_id: dto.deviceId,
            bateria: dto.battery ?? 100,
            online_status: true,
            last_seen: new Date(),
          },
        });
      } else {
        // Actualizar estado de conexión y batería
        dispositivo = await this.prisma.dispositivo.update({
          where: { id_dispositivo: dispositivo.id_dispositivo },
          data: {
            online_status: true,
            last_seen: new Date(),
            ...(dto.battery !== undefined && { bateria: dto.battery }),
          },
        });
      }

      // 2. Guardar datos de sensores en la tabla SensorData
      const sensorData = await this.prisma.sensorData.create({
        data: {
          id_dispositivo: dispositivo.id_dispositivo,
          // Datos MPU6050
          mpu_acceleration: dto.mpu_acceleration,
          mpu_fall_detected: dto.mpu_fall_detected,
          mpu_stable: dto.mpu_stable,
          mpu_status: dto.mpu_status,
          // Datos MAX30102
          max_ir_value: dto.max_ir_value,
          max_bpm: dto.max_bpm,
          max_avg_bpm: dto.max_avg_bpm,
          max_connected: dto.max_connected,
          // Información general
          battery: dto.battery,
          wifi_ssid: dto.wifi_ssid,
          wifi_rssi: dto.wifi_rssi,
          // Timestamps
          timestamp: dto.timestamp ? new Date(dto.timestamp) : new Date(),
        },
      });

      console.log(
        `[ESP32-SENSORS] ✓ Datos de sensor guardados. Dispositivo: ${dispositivo.device_id}, BPM: ${dto.max_bpm}, Caída: ${dto.mpu_fall_detected}`
      );

      // 3. Si se detectó una caída, crear una notificación
      if (dto.mpu_fall_detected && dispositivo) {
        await this.handleFallDetection(dispositivo.id_dispositivo, dto);
      }

      // 4. Emitir evento SSE si el usuario está disponible
      if (dto.userId) {
        this.deviceEventsService.emitSensorData({
          deviceId: dto.deviceId,
          userId: parseInt(dto.userId),
          mpu_fall_detected: dto.mpu_fall_detected || false,
          max_bpm: dto.max_bpm || 0,
          battery: dto.battery || 0,
        });
        console.log(`[ESP32-SENSORS] Evento SSE emitido al usuario ${dto.userId}`);
      }

      return {
        success: true,
        message: 'Datos de sensores registrados correctamente',
        deviceId: dto.deviceId,
        sensorDataId: sensorData.id_sensor,
      };
    } catch (error) {
      console.error('[ESP32-SENSORS] ✗ Error al procesar datos de sensores:', error);
      throw error;
    }
  }

  /**
   * Maneja la detección de caídas del ESP32
   * Crea una notificación y busca el adulto mayor asociado al dispositivo
   */
  private async handleFallDetection(
    dispositivoId: number,
    sensorData: Esp32SensorDataDto
  ) {
    console.log(`[FALL-DETECTION] Caída detectada en dispositivo ${sensorData.deviceId}`);

    try {
      // Buscar el adulto mayor asociado a este dispositivo
      const adultoMayor = await this.prisma.adultoMayor.findFirst({
        where: { id_dispositivo: dispositivoId },
        include: { usuariosAdultoMayor: { select: { id_usuario: true } } },
      });

      if (!adultoMayor) {
        console.warn(
          `[FALL-DETECTION] ⚠ No se encontró adulto mayor para el dispositivo ${dispositivoId}`
        );
        return;
      }

      // Crear una notificación de caída
      const notificacion = await this.prisma.notificaciones.create({
        data: {
          id_adulto: adultoMayor.id_adulto,
          tipo: 'CAIDA',
          fecha_hora: new Date(),
          pulso: sensorData.max_avg_bpm || undefined,
          mensaje: `Caída detectada - Aceleración: ${sensorData.mpu_acceleration?.toFixed(2) || 'N/A'} g`,
        },
      });

      console.log(
        `[FALL-DETECTION] ✓ Notificación de caída creada para ${adultoMayor.nombre}:`,
        notificacion
      );

      // Emitir evento de notificación a todos los usuarios que monitorean este adulto mayor
      for (const relacion of adultoMayor.usuariosAdultoMayor) {
        this.deviceEventsService.emitNotification({
          id_notificacion: notificacion.id_notificacion,
          userId: relacion.id_usuario,
          tipo: 'CAIDA',
          usuario: adultoMayor.nombre,
          mensaje: notificacion.mensaje || `Caída detectada - Aceleración: ${sensorData.mpu_acceleration?.toFixed(2) || 'N/A'} g`,
          fecha_hora: notificacion.fecha_hora.toISOString(),
          pulso: notificacion.pulso || undefined,
        });
        console.log(`[FALL-DETECTION] Evento emitido al usuario ${relacion.id_usuario}`);
      }
    } catch (error) {
      console.error('[FALL-DETECTION] ✗ Error al crear notificación de caída:', error);
    }
  }

  /**
   * Obtiene el último BPM registrado de un dispositivo
   */
  async getLatestBpm(deviceId: number) {
    try {
      const latestSensorData = await this.prisma.sensorData.findFirst({
        where: { id_dispositivo: deviceId },
        orderBy: { received_at: 'desc' },
        select: {
          max_avg_bpm: true,
          max_bpm: true,
          timestamp: true,
          received_at: true,
        },
      });

      if (!latestSensorData) {
        return { bpm: null, timestamp: null };
      }

      return {
        bpm: latestSensorData.max_avg_bpm || latestSensorData.max_bpm || 0,
        timestamp: latestSensorData.timestamp || latestSensorData.received_at,
      };
    } catch (error) {
      console.error('[GET-BPM] Error obteniendo BPM:', error);
      return { bpm: null, timestamp: null };
    }
  }
}

