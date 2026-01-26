import { ConflictException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { VincularDispositivoDto } from './dto/vincular-dispositivo.dto';
import { UpdateAdultoMayorDto } from './dto/update-adulto-mayor.dto';
import { Esp32ConnectionDto } from './dto/esp32-connection.dto';
import { Esp32SensorDataDto } from './dto/esp32-sensor-data.dto';
import { Esp32MaxDataDto } from './dto/esp32-max-data.dto';
import { Esp32MpuAlertDto } from './dto/esp32-mpu-alert.dto';
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
    console.log('[vincularDispositivoAUsuario] Iniciando con userId:', userId, 'y dto:', JSON.stringify(dto, null, 2));
    
    // 0. Verificar que el usuario existe
    const usuario = await this.prisma.usuario.findUnique({
      where: { id_usuario: userId },
    });

    if (!usuario) {
      console.error(`[vincularDispositivoAUsuario] ERROR: Usuario con ID ${userId} no existe`);
      throw new Error(`Usuario con ID ${userId} no existe en la base de datos. Verifica que el usuario esté correctamente autenticado.`);
    }

    console.log('[vincularDispositivoAUsuario] Usuario encontrado:', usuario.email);

    // 1. Verificar si el dispositivo ya existe (buscar por mac_address o device_id)
    let dispositivo = await this.prisma.dispositivo.findFirst({
      where: {
        OR: [
          { mac_address: dto.mac_address },
          { device_id: dto.mac_address },
        ]
      },
    });

    if (dispositivo) {
      console.log('[vincularDispositivoAUsuario] ✓ Dispositivo encontrado:', {
        id: dispositivo.id_dispositivo,
        mac_address: dispositivo.mac_address,
        device_id: dispositivo.device_id,
        bateria: dispositivo.bateria
      });
    } else {
      console.log('[vincularDispositivoAUsuario] Dispositivo no encontrado, se creará uno nuevo');
    }

    // 2. Si no existe, crear el dispositivo
    if (!dispositivo) {
      console.log('[vincularDispositivoAUsuario] Creando nuevo dispositivo...');
      dispositivo = await this.prisma.dispositivo.create({
        data: {
          mac_address: dto.mac_address,
          device_id: dto.mac_address, // Asignar también como device_id
          bateria: dto.bateria,
          online_status: true, // Marcarlo como online al vincular
          last_seen: new Date(),
        },
      });
      console.log('[vincularDispositivoAUsuario] ✓ Dispositivo creado con ID:', dispositivo.id_dispositivo);
    } else {
      console.log('[vincularDispositivoAUsuario] Actualizando dispositivo existente...');
      // Si existe, actualizar la batería y asegurar que tiene AMBOS campos
      dispositivo = await this.prisma.dispositivo.update({
        where: { id_dispositivo: dispositivo.id_dispositivo },
        data: { 
          bateria: dto.bateria,
          mac_address: dispositivo.mac_address || dto.mac_address, // Asegurar que tiene mac_address
          device_id: dispositivo.device_id || dto.mac_address, // Asegurar que tiene device_id
          online_status: true,
          last_seen: new Date(),
        },
      });
      console.log('[vincularDispositivoAUsuario] ✓ Dispositivo actualizado:', {
        id: dispositivo.id_dispositivo,
        mac_address: dispositivo.mac_address,
        device_id: dispositivo.device_id
      });
    }

    // 3. Verificar si ya existe un adulto mayor con este dispositivo
    const adultoExistente = await this.prisma.adultoMayor.findFirst({
      where: { id_dispositivo: dispositivo.id_dispositivo },
    });

    console.log('[vincularDispositivoAUsuario] Adulto existente para dispositivo:', adultoExistente ? `ID ${adultoExistente.id_adulto} - ${adultoExistente.nombre}` : 'No encontrado');

    let adultoMayor;
    if (adultoExistente) {
      // ACTUALIZAR el adulto mayor existente con los nuevos datos del modal
      console.log('[vincularDispositivoAUsuario] Actualizando adulto mayor existente con datos del modal...');
      adultoMayor = await this.prisma.adultoMayor.update({
        where: { id_adulto: adultoExistente.id_adulto },
        data: {
          nombre: dto.nombre_adulto || adultoExistente.nombre,
          fecha_nacimiento: dto.fecha_nacimiento 
            ? new Date(dto.fecha_nacimiento) 
            : adultoExistente.fecha_nacimiento,
          direccion: dto.direccion || adultoExistente.direccion,
        },
      });
      console.log('[vincularDispositivoAUsuario] ✓ Adulto mayor actualizado:', adultoMayor.nombre);
    } else {
      // 4. Crear un adulto mayor asociado al dispositivo
      console.log('[vincularDispositivoAUsuario] Creando nuevo adulto mayor...');
      console.log('[vincularDispositivoAUsuario] 📋 Datos del adulto a crear:', {
        nombre: dto.nombre_adulto || `Dispositivo ${dto.mac_address}`,
        fecha_nacimiento: dto.fecha_nacimiento,
        direccion: dto.direccion || 'Ubicación no especificada',
        id_dispositivo: dispositivo.id_dispositivo // ← VINCULACIÓN CRÍTICA
      });
      
      adultoMayor = await this.prisma.adultoMayor.create({
        data: {
          nombre: dto.nombre_adulto || `Dispositivo ${dto.mac_address}`,
          fecha_nacimiento: dto.fecha_nacimiento 
            ? new Date(dto.fecha_nacimiento) 
            : new Date('1950-01-01'),
          direccion: dto.direccion || 'Ubicación no especificada',
          id_dispositivo: dispositivo.id_dispositivo, // ← VINCULA AL DISPOSITIVO CORRECTO
        },
      });
      
      console.log('[vincularDispositivoAUsuario] ✅ Adulto mayor creado:', {
        id_adulto: adultoMayor.id_adulto,
        nombre: adultoMayor.nombre,
        id_dispositivo: adultoMayor.id_dispositivo // ← Confirmar FK correcta
      });
    }

    // 5. Verificar si ya existe la relación Usuario-AdultoMayor
    console.log('[vincularDispositivoAUsuario] Verificando relación existente entre userId:', userId, 'y adultoId:', adultoMayor.id_adulto);
    
    const relacionExistente = await this.prisma.usuarioAdultoMayor.findUnique({
      where: {
        id_usuario_id_adulto: {
          id_usuario: userId,
          id_adulto: adultoMayor.id_adulto,
        },
      },
    });

    // 6. Si no existe la relación, crearla
    console.log('[vincularDispositivoAUsuario] ✅ VINCULACIÓN EXITOSA:', {
      dispositivo_id: dispositivo.id_dispositivo,
      device_id: dispositivo.device_id,
      mac_address: dispositivo.mac_address,
      adulto_id: adultoMayor.id_adulto,
      adulto_nombre: adultoMayor.nombre,
      adulto_id_dispositivo: adultoMayor.id_dispositivo, // ← Confirmar FK
      usuario_id: userId,
      relacion_creada: !relacionExistente
    });
    
    // VERIFICACIÓN ADICIONAL: Confirmar que la relación está correcta
    if (adultoMayor.id_dispositivo !== dispositivo.id_dispositivo) {
      console.error('[vincularDispositivoAUsuario] ⚠️ ERROR DE VINCULACIÓN: AdultoMayor NO está vinculado al dispositivo correcto!');
      console.error('[vincularDispositivoAUsuario] Esperado:', dispositivo.id_dispositivo, 'Actual:', adultoMayor.id_dispositivo);
    } else {
      console.log('[vincularDispositivoAUsuario] ✅ VERIFICACIÓN: AdultoMayor correctamente vinculado al Dispositivo', dispositivo.id_dispositivo);
    }

    if (!relacionExistente) {
      console.log('[vincularDispositivoAUsuario] Creando relación Usuario-AdultoMayor');
      try {
        await this.prisma.usuarioAdultoMayor.create({
          data: {
            id_usuario: userId,
            id_adulto: adultoMayor.id_adulto,
          },
        });
        console.log('[vincularDispositivoAUsuario] Relación creada exitosamente');
      } catch (error) {
        console.error('[vincularDispositivoAUsuario] Error al crear relación:', error);
        throw error;
      }
    } else {
      console.log('[vincularDispositivoAUsuario] Relación ya existe, no se crea nuevamente');
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
   * Guarda el estado en memoria Y en la base de datos
   */
  async handleEsp32Connection(dto: Esp32ConnectionDto) {
    console.log('[ESP32-CONN] Notificación de conexión recibida:', dto);

    try {
      // 1. GUARDAR/ACTUALIZAR EN BASE DE DATOS
      let dispositivo = await this.prisma.dispositivo.findFirst({
        where: {
          OR: [
            { device_id: dto.deviceId },
            { mac_address: dto.deviceId },
          ]
        }
      });

      if (!dispositivo) {
        console.log(`[ESP32-CONN] Dispositivo ${dto.deviceId} no existe en BD, creando...`);
        dispositivo = await this.prisma.dispositivo.create({
          data: {
            device_id: dto.deviceId,
            mac_address: dto.deviceId,
            bateria: 100, // Valor por defecto al conectar WiFi
            online_status: true,
            last_seen: new Date(),
          },
        });
        console.log(`[ESP32-CONN] ✓ Dispositivo creado en BD (ID: ${dispositivo.id_dispositivo})`);
      } else {
        console.log(`[ESP32-CONN] Dispositivo ${dto.deviceId} ya existe en BD (ID: ${dispositivo.id_dispositivo}), actualizando...`);
        dispositivo = await this.prisma.dispositivo.update({
          where: { id_dispositivo: dispositivo.id_dispositivo },
          data: {
            online_status: true,
            last_seen: new Date(),
            mac_address: dispositivo.mac_address || dto.deviceId, // Asegurar que tiene mac_address
            device_id: dispositivo.device_id || dto.deviceId,     // Asegurar que tiene device_id
          },
        });
        console.log(`[ESP32-CONN] ✓ Dispositivo actualizado en BD`);
      }

      // 2. GUARDAR EN MEMORIA (para consultas rápidas)
      this.connectedDevices.set(dto.deviceId, {
        deviceId: dto.deviceId,
        ssid: dto.ssid,
        ip: dto.ip,
        rssi: dto.rssi,
        userId: dto.userId,
      });

      console.log(`[ESP32-CONN] ✓ Dispositivo ${dto.deviceId} registrado en memoria`);

      // 3. EMITIR EVENTO SSE AL USUARIO
      if (dto.userId) {
        console.log(`[ESP32-CONN] User ID asociado: ${dto.userId}`);
        
        this.deviceEventsService.emitDeviceConnection({
          deviceId: dto.deviceId,
          userId: parseInt(dto.userId),
          ssid: dto.ssid,
          ip: dto.ip,
          rssi: dto.rssi || 0,
          status: 'connected',
        });
        console.log(`[ESP32-CONN] ✓ Evento SSE emitido al usuario ${dto.userId}`);
      }

      console.log(`[ESP32-CONN] Total dispositivos en memoria: ${this.connectedDevices.size}`);

      return {
        success: true,
        message: 'Conexión registrada en BD y memoria',
        deviceId: dto.deviceId,
        dispositivoDbId: dispositivo.id_dispositivo,
        userId: dto.userId,
      };
    } catch (error) {
      console.error('[ESP32-CONN] ✗ Error al registrar conexión:', error);
      throw error;
    }
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

  /**
   * Método de debug para verificar los últimos datos de sensores recibidos
   */
  async getLatestSensorDataForDebug() {
    try {
      const latestData = await this.prisma.sensorData.findMany({
        take: 10,
        orderBy: { received_at: 'desc' },
        include: {
          dispositivo: {
            include: {
              adultos: {
                select: {
                  nombre: true,
                },
              },
            },
          },
        },
      });

      return {
        success: true,
        message: 'Últimos 10 registros de sensor data recibidos del ESP32',
        count: latestData.length,
        data: latestData.map(record => ({
          id: record.id_sensor,
          deviceId: record.id_dispositivo,
          deviceMac: record.dispositivo.mac_address,
          adultoMayor: record.dispositivo.adultos.length > 0
            ? record.dispositivo.adultos[0].nombre
            : 'Sin vincular',
          timestamp: record.timestamp,
          receivedAt: record.received_at,
          bpm: record.max_avg_bpm || record.max_bpm,
          aceleracion: record.mpu_acceleration,
          fallDetected: record.mpu_fall_detected,
          stable: record.mpu_stable,
          status: record.mpu_status,
          battery: record.battery,
          wifi: record.wifi_ssid ? {
            ssid: record.wifi_ssid,
            rssi: record.wifi_rssi,
          } : null,
          minutesAgo: Math.round((Date.now() - new Date(record.received_at).getTime()) / 60000),
        })),
      };
    } catch (error) {
      console.error('[DEBUG] Error obteniendo sensor data:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Método de debug para ver dispositivos conectados en memoria
   */
  getConnectedDevicesDebug() {
    const devices = Array.from(this.connectedDevices.entries()).map(([key, value]) => ({
      key,
      ...value,
    }));

    return {
      success: true,
      count: devices.length,
      devices,
      message: `${devices.length} dispositivo(s) conectado(s) en memoria`,
    };
  }

  // ============ NUEVOS MÉTODOS PARA ESP32 ============

  /**
   * ⭐ NUEVO: Procesa y almacena datos del sensor MAX30102 (cada 5 segundos)
   * Recibe datos periódicos de ritmo cardíaco del ESP32
   */
  async handleEsp32MaxData(dto: Esp32MaxDataDto) {
    console.log('[ESP32-MAX] Datos MAX30102 recibidos:', {
      deviceId: dto.deviceId,
      bpm: dto.max_bpm,
      avgBpm: dto.max_avg_bpm,
      irValue: dto.max_ir_value,
      battery: dto.battery,
    });

    try {
      // 1. Buscar o crear el dispositivo por device_id
      let dispositivo = await this.prisma.dispositivo.findUnique({
        where: { device_id: dto.deviceId },
      });

      if (!dispositivo) {
        console.log(`[ESP32-MAX] Dispositivo ${dto.deviceId} no encontrado, creando...`);
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
            bateria: dto.battery,
          },
        });
      }

      // 2. Guardar datos del MAX30102 en la tabla SensorData
      const sensorData = await this.prisma.sensorData.create({
        data: {
          id_dispositivo: dispositivo.id_dispositivo,
          // Datos MAX30102
          max_ir_value: dto.max_ir_value,
          max_bpm: dto.max_bpm,
          max_avg_bpm: dto.max_avg_bpm,
          max_connected: dto.max_connected,
          // Información general
          battery: dto.battery,
          wifi_rssi: dto.wifi_rssi,
          // Clasificación
          sensor_type: dto.sensor_type, // "MAX30102"
          is_alert: false, // Los datos del MAX no son alertas
          // Timestamps
          timestamp: new Date(dto.timestamp),
          received_at: new Date(),
        },
      });

      console.log(
        `[ESP32-MAX] ✓ Datos guardados. ID: ${sensorData.id_sensor}, BPM: ${dto.max_bpm}, Avg: ${dto.max_avg_bpm}`
      );

      // 3. Emitir evento SSE si hay userId
      if (dto.userId) {
        this.deviceEventsService.emitSensorData({
          deviceId: dto.deviceId,
          userId: parseInt(dto.userId),
          mpu_fall_detected: false,
          max_bpm: dto.max_bpm,
          battery: dto.battery,
        });
      }

      return {
        success: true,
        message: 'Datos MAX30102 registrados correctamente',
        deviceId: dto.deviceId,
        sensorDataId: sensorData.id_sensor,
        bpm: dto.max_bpm,
        avgBpm: dto.max_avg_bpm,
      };
    } catch (error) {
      console.error('[ESP32-MAX] ✗ Error al procesar datos MAX30102:', error);
      throw error;
    }
  }

  /**
   * ⭐ NUEVO: Procesa y almacena alertas del sensor MPU6050 (solo cuando detecta desmayo)
   * Crea una notificación y emite eventos SSE urgentes
   */
  async handleEsp32MpuAlert(dto: Esp32MpuAlertDto) {
    console.log('[ESP32-MPU] ⚠️⚠️⚠️ ALERTA DE DESMAYO RECIBIDA ⚠️⚠️⚠️');
    console.log('[ESP32-MPU] Datos:', {
      deviceId: dto.deviceId,
      alertType: dto.alert_type,
      acceleration: dto.mpu_acceleration,
      status: dto.mpu_status,
    });

    try {
      // 1. Buscar o crear el dispositivo
      let dispositivo = await this.prisma.dispositivo.findUnique({
        where: { device_id: dto.deviceId },
      });

      if (!dispositivo) {
        console.log(`[ESP32-MPU] Dispositivo ${dto.deviceId} no encontrado, creando...`);
        dispositivo = await this.prisma.dispositivo.create({
          data: {
            device_id: dto.deviceId,
            bateria: dto.battery ?? 100,
            online_status: true,
            last_seen: new Date(),
          },
        });
      } else {
        // Actualizar estado
        dispositivo = await this.prisma.dispositivo.update({
          where: { id_dispositivo: dispositivo.id_dispositivo },
          data: {
            online_status: true,
            last_seen: new Date(),
            bateria: dto.battery,
          },
        });
      }

      // 2. Guardar alerta en SensorData
      const sensorData = await this.prisma.sensorData.create({
        data: {
          id_dispositivo: dispositivo.id_dispositivo,
          // Datos MPU6050
          mpu_acceleration: dto.mpu_acceleration,
          mpu_fall_detected: dto.mpu_fall_detected,
          mpu_stable: dto.mpu_stable,
          mpu_status: dto.mpu_status,
          // Información general
          battery: dto.battery,
          wifi_ssid: dto.wifi_ssid,
          wifi_rssi: dto.wifi_rssi,
          // Clasificación (IMPORTANTE)
          sensor_type: dto.sensor_type, // "MPU6050"
          alert_type: dto.alert_type, // "DESMAYO_CONFIRMADO"
          is_alert: true, // ⚠️ ESTO ES UNA ALERTA URGENTE
          // Timestamps
          timestamp: new Date(dto.timestamp),
          received_at: new Date(),
        },
      });

      console.log(`[ESP32-MPU] ✓ Alerta guardada. ID: ${sensorData.id_sensor}`);

      // 3. Crear notificación y emitir evento SSE
      await this.handleMpuFallAlert(dispositivo.id_dispositivo, dto);

      return {
        success: true,
        message: '⚠️ Alerta de desmayo procesada',
        deviceId: dto.deviceId,
        sensorDataId: sensorData.id_sensor,
        alertType: dto.alert_type,
        acceleration: dto.mpu_acceleration,
      };
    } catch (error) {
      console.error('[ESP32-MPU] ✗ Error al procesar alerta MPU:', error);
      throw error;
    }
  }

  /**
   * ⭐ NUEVO: Maneja la creación de notificaciones para alertas de desmayo del MPU6050
   */
  private async handleMpuFallAlert(
    dispositivoId: number,
    alertData: Esp32MpuAlertDto
  ) {
    console.log(`[MPU-ALERT] Procesando alerta de desmayo para dispositivo ID ${dispositivoId}`);

    try {
      // Buscar el dispositivo para obtener su device_id
      const dispositivo = await this.prisma.dispositivo.findUnique({
        where: { id_dispositivo: dispositivoId },
      });

      if (!dispositivo) {
        console.error(`[MPU-ALERT] ✗ Dispositivo ${dispositivoId} no encontrado`);
        return;
      }

      console.log(`[MPU-ALERT] Dispositivo encontrado: ${dispositivo.device_id} (ID: ${dispositivoId})`);

      // Buscar el adulto mayor asociado a este dispositivo
      console.log(`[MPU-ALERT] Buscando adulto mayor con id_dispositivo = ${dispositivoId}...`);
      const adultoMayor = await this.prisma.adultoMayor.findFirst({
        where: { id_dispositivo: dispositivoId },
        include: { 
          usuariosAdultoMayor: { 
            include: { 
              usuario: { 
                select: { id_usuario: true, nombre: true, email: true } 
              } 
            } 
          } 
        },
      });

      if (!adultoMayor) {
        console.warn(
          `[MPU-ALERT] ⚠️ NO SE ENCONTRÓ ADULTO MAYOR para dispositivo ${dispositivo.device_id} (ID: ${dispositivoId})`
        );
        console.warn(`[MPU-ALERT] ⚠️ Debes vincular el dispositivo desde la app con el botón "Guardar" del modal`);
        console.warn(`[MPU-ALERT] ⚠️ Esto creará la relación: Dispositivo → AdultoMayor → Usuario`);
        
        // Si hay userId en la alerta, enviar notificación directa al usuario
        if (alertData.userId) {
          const userId = parseInt(alertData.userId);
          console.log(`[MPU-ALERT] Enviando alerta directa al usuario ${userId}`);
          
          this.deviceEventsService.emitNotification({
            id_notificacion: 0, // Notificación temporal sin ID de BD
            userId: userId,
            tipo: 'DESMAYO',
            usuario: `Dispositivo ${dispositivo.device_id}`,
            mensaje: `⚠️ ${alertData.alert_type} - Dispositivo sin vincular - Aceleración: ${alertData.mpu_acceleration.toFixed(2)} g`,
            fecha_hora: new Date().toISOString(),
          });
          console.log(`[MPU-ALERT] 🔔 Alerta directa enviada al usuario ${userId} (dispositivo sin vincular)`);
        }
        return;
      }

      console.log(`[MPU-ALERT] ✅ Adulto mayor encontrado:`, {
        id_adulto: adultoMayor.id_adulto,
        nombre: adultoMayor.nombre,
        id_dispositivo: adultoMayor.id_dispositivo,
        usuarios_monitoreando: adultoMayor.usuariosAdultoMayor.length
      });

      // Crear notificación de desmayo en la base de datos
      const notificacion = await this.prisma.notificaciones.create({
        data: {
          id_adulto: adultoMayor.id_adulto,
          tipo: 'DESMAYO',
          fecha_hora: new Date(),
          mensaje: `⚠️ EMERGENCIA: ${alertData.alert_type} - ${adultoMayor.nombre} - Aceleración: ${alertData.mpu_acceleration.toFixed(2)} g`,
        },
      });

      console.log(
        `[MPU-ALERT] ✓ Notificación de desmayo creada (ID: ${notificacion.id_notificacion}) para ${adultoMayor.nombre}`
      );

      // Emitir evento SSE urgente a todos los usuarios que monitorean a este adulto
      if (adultoMayor.usuariosAdultoMayor.length === 0) {
        console.warn(`[MPU-ALERT] ⚠ No hay usuarios monitoreando a ${adultoMayor.nombre}`);
      }

      for (const relacion of adultoMayor.usuariosAdultoMayor) {
        this.deviceEventsService.emitNotification({
          id_notificacion: notificacion.id_notificacion,
          userId: relacion.usuario.id_usuario,
          tipo: 'DESMAYO',
          usuario: adultoMayor.nombre,
          mensaje: notificacion.mensaje || `⚠️ EMERGENCIA: Desmayo confirmado`,
          fecha_hora: notificacion.fecha_hora.toISOString(),
        });
        console.log(`[MPU-ALERT] 🔔 Notificación de EMERGENCIA enviada al usuario ${relacion.usuario.id_usuario} (${relacion.usuario.nombre})`);
      }
    } catch (error) {
      console.error('[MPU-ALERT] ✗ Error al crear notificación de desmayo:', error);
      console.error('[MPU-ALERT] Stack:', error.stack);
    }
  }
}
