import { ConflictException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { VincularDispositivoDto } from './dto/vincular-dispositivo.dto';
import { UpdateAdultoMayorDto } from './dto/update-adulto-mayor.dto';
import { Esp32ConnectionDto } from './dto/esp32-connection.dto';
import { Esp32MaxDataDto } from './dto/esp32-max-data.dto';
import { Esp32MpuAlertDto } from './dto/esp32-mpu-alert.dto';
import { Esp32ButtonAlertDto } from './dto/esp32-button-alert.dto';
import { PrismaService } from '../prisma/prisma.service';
import { DeviceEventsService } from './device-events.service';
import { FirebaseService } from '../firebase/firebase.service';

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

  // ⭐ NUEVO: Mapa para rastrear el último heartbeat de cada dispositivo
  private deviceHeartbeats = new Map<string, {
    lastSeen: Date;
    deviceId: string;
    timeoutId?: NodeJS.Timeout;
  }>();

  // Timeout de desconexión: 10 segundos sin datos
  private readonly DISCONNECT_TIMEOUT_MS = 10000;

  constructor(
    private prisma: PrismaService,
    private deviceEventsService: DeviceEventsService,
    private firebaseService: FirebaseService,
  ) {
    console.log('[DeviceService] 🔍 Sistema de monitoreo de heartbeat iniciado');
  }

  /**
   * ⭐ NUEVO: Envía notificación tanto por SSE (app abierta) como por FCM (app cerrada)
   */
  private async sendNotificationToUser(
    userId: number,
    notificationData: {
      id_notificacion: number;
      tipo: string;
      usuario: string;
      mensaje: string;
      fecha_hora: string;
      pulso?: number;
    }
  ) {
    // 1. Enviar por SSE (para app abierta)
    this.deviceEventsService.emitNotification({
      ...notificationData,
      userId: userId,
    });

    // 2. Enviar por FCM (para app cerrada)
    try {
      const user = await this.prisma.usuario.findUnique({
        where: { id_usuario: userId },
        select: { fcm_token: true, nombre: true }
      });

      if (user && user.fcm_token) {
        // Determinar título y emoji según tipo
        let title = '📢 Notificación';
        if (notificationData.tipo === 'PANICO') {
          title = '⚠️ BOTÓN DE PÁNICO';
        } else if (notificationData.tipo === 'EMERGENCIA') {
          title = '🚨 EMERGENCIA';
        } else if (notificationData.tipo === 'AYUDA') {
          title = '⚠️ SOLICITUD DE AYUDA';
        }

        await this.firebaseService.sendNotification(
          user.fcm_token,
          title,
          notificationData.mensaje,
          {
            tipo: notificationData.tipo.toLowerCase(),
            notificationId: notificationData.id_notificacion.toString(),
            usuario: notificationData.usuario,
            timestamp: notificationData.fecha_hora,
            pulso: notificationData.pulso?.toString() || '',
          }
        );
        
        console.log(`[FCM] ✅ Notificación enviada a ${user.nombre} (User ID: ${userId})`);
      }
    } catch (error) {
      console.error(`[FCM] ❌ Error enviando notificación FCM al usuario ${userId}:`, error.message);
    }
  }

  /**
   * ⭐ NUEVO: Actualiza el heartbeat de un dispositivo y programa el timeout de desconexión
   */
  private updateDeviceHeartbeat(deviceId: string) {
    const existing = this.deviceHeartbeats.get(deviceId);
    
    // Cancelar timeout anterior si existe
    if (existing?.timeoutId) {
      clearTimeout(existing.timeoutId);
    }

    // Programar nuevo timeout de desconexión
    const timeoutId = setTimeout(async () => {
      console.log(`[HEARTBEAT] ⏰ Timeout: ${deviceId} sin datos por ${this.DISCONNECT_TIMEOUT_MS}ms`);
      await this.handleDeviceTimeout(deviceId);
    }, this.DISCONNECT_TIMEOUT_MS);

    // Actualizar registro de heartbeat
    this.deviceHeartbeats.set(deviceId, {
      lastSeen: new Date(),
      deviceId,
      timeoutId
    });

    // console.log(`[HEARTBEAT] ✓ ${deviceId} heartbeat actualizado`);
  }

  /**
   * ⭐ NUEVO: Maneja el timeout de un dispositivo (desconexión por inactividad)
   */
  private async handleDeviceTimeout(deviceId: string) {
    console.log(`[HEARTBEAT] 🔴 Dispositivo ${deviceId} considerado DESCONECTADO`);
    
    try {
      // Buscar el dispositivo en BD
      const dispositivo = await this.prisma.dispositivo.findUnique({
        where: { id_dispositivo: deviceId },
        include: {
          adultos: {
            include: {
              usuariosAdultoMayor: {
                select: { id_usuario: true }
              },
              sharedInGroups: {
                include: {
                  group: {
                    include: {
                      members: {
                        select: { user_id: true }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!dispositivo) {
        console.log(`[HEARTBEAT] ⚠️ Dispositivo ${deviceId} no encontrado en BD`);
        this.deviceHeartbeats.delete(deviceId);
        return;
      }

      // Actualizar estado en BD
      await this.prisma.dispositivo.update({
        where: { id_dispositivo: dispositivo.id_dispositivo },
        data: {
          online_status: false,
          last_seen: new Date()
        }
      });

      // Recopilar todos los usuarios que deben ser notificados
      const userIds = new Set<number>();
      
      dispositivo.adultos.forEach(adulto => {
        // Agregar usuarios directamente vinculados
        adulto.usuariosAdultoMayor.forEach(rel => {
          userIds.add(rel.id_usuario);
        });
        
        // Agregar usuarios de grupos compartidos
        adulto.sharedInGroups?.forEach(shared => {
          shared.group.members.forEach(member => {
            userIds.add(member.user_id);
          });
        });
      });

      // Emitir evento de desconexión a todos los usuarios
      if (userIds.size > 0) {
        this.deviceEventsService.emitDeviceDisconnection(deviceId, Array.from(userIds));
        console.log(`[HEARTBEAT] 📤 Notificación de desconexión enviada a ${userIds.size} usuario(s)`);
      }

      // Limpiar del mapa
      this.deviceHeartbeats.delete(deviceId);
      
    } catch (error) {
      console.error(`[HEARTBEAT] ✗ Error manejando timeout de ${deviceId}:`, error);
    }
  }

  async create(dto: CreateDeviceDto) {
    // Verificar si el dispositivo ya existe
    const exists = await this.prisma.dispositivo.findUnique({ where: { id_dispositivo: dto.id_dispositivo } });
    if (exists) throw new ConflictException('Dispositivo con ese ID ya está registrado');
    
    const device = await this.prisma.dispositivo.create({
      data: {
        id_dispositivo: dto.id_dispositivo,
      },
    });
    return device;
  }

  async findAll() {
    return this.prisma.dispositivo.findMany();
  }

  async findOne(id: string) {
    const device = await this.prisma.dispositivo.findUnique({ where: { id_dispositivo: id } });
    if (!device) throw new NotFoundException('Dispositivo no encontrado');
    return device;
  }

  async update(id: string, dto: UpdateDeviceDto) {
    const device = await this.prisma.dispositivo.update({
      where: { id_dispositivo: id },
      data: dto,
    });
    return device;
  }

  async remove(id: string) {
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
    console.log('[vincularDispositivoAUsuario] 🔍 VERIFICANDO DATOS RECIBIDOS:');
    console.log('[vincularDispositivoAUsuario]   - nombre_adulto:', dto.nombre_adulto, '(tipo:', typeof dto.nombre_adulto, ')');
    console.log('[vincularDispositivoAUsuario]   - fecha_nacimiento:', dto.fecha_nacimiento);
    console.log('[vincularDispositivoAUsuario]   - direccion:', dto.direccion);
    console.log('[vincularDispositivoAUsuario]   - id_dispositivo:', dto.id_dispositivo);
    
    // 0. Verificar que el usuario existe
    const usuario = await this.prisma.usuario.findUnique({
      where: { id_usuario: userId },
    });

    if (!usuario) {
      console.error(`[vincularDispositivoAUsuario] ERROR: Usuario con ID ${userId} no existe`);
      throw new Error(`Usuario con ID ${userId} no existe en la base de datos. Verifica que el usuario esté correctamente autenticado.`);
    }

    console.log('[vincularDispositivoAUsuario] Usuario encontrado:', usuario.email);

    // 1. Buscar si el dispositivo ya existe en BD
    let dispositivo = await this.prisma.dispositivo.findUnique({
      where: { id_dispositivo: dto.id_dispositivo }
    });

    if (dispositivo) {
      // ✓ Dispositivo ya existe (probablemente ya fue vinculado antes)
      console.log('[vincularDispositivoAUsuario] ✓ Dispositivo ya existe en BD:', {
        id_dispositivo: dispositivo.id_dispositivo,
      });
      
      // Actualizar estado del dispositivo existente
      console.log('[vincularDispositivoAUsuario] Actualizando dispositivo existente...');
      dispositivo = await this.prisma.dispositivo.update({
        where: { id_dispositivo: dispositivo.id_dispositivo },
        data: { 
          online_status: true,
          last_seen: new Date(),
        },
      });
      console.log('[vincularDispositivoAUsuario] ✓ Dispositivo actualizado');
    } else {
      // ⭐ NUEVO: Crear el dispositivo EN ESTE MOMENTO (después de recibir datos del adulto mayor)
      console.log('[vincularDispositivoAUsuario] ⭐ Dispositivo NO existe en BD. Creándolo ahora con datos del adulto mayor...');
      dispositivo = await this.prisma.dispositivo.create({
        data: {
          id_dispositivo: dto.id_dispositivo,
          online_status: true,
          last_seen: new Date(),
        },
      });
      console.log('[vincularDispositivoAUsuario] ✅ Dispositivo creado en BD (ID:', dispositivo.id_dispositivo, ')');
    }

    // 2. Verificar si ya existe un adulto mayor con este dispositivo
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
      // 3. Crear un adulto mayor asociado al dispositivo
      console.log('[vincularDispositivoAUsuario] Creando nuevo adulto mayor...');
      console.log('[vincularDispositivoAUsuario] 📋 Datos del adulto a crear:', {
        nombre: dto.nombre_adulto || `Dispositivo ${dto.id_dispositivo}`,
        fecha_nacimiento: dto.fecha_nacimiento,
        direccion: dto.direccion || 'Ubicación no especificada',
        id_dispositivo: dispositivo.id_dispositivo // ← VINCULACIÓN CRÍTICA
      });
      
      adultoMayor = await this.prisma.adultoMayor.create({
        data: {
          nombre: dto.nombre_adulto || `Dispositivo ${dto.id_dispositivo}`,
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
   * SOLO guarda el estado en memoria (NO crea el dispositivo en BD)
   * El dispositivo se creará en BD cuando se vincule con los datos del adulto mayor
   */
  async handleEsp32Connection(dto: Esp32ConnectionDto) {
    console.log('[ESP32-CONN] Notificación de conexión recibida:', dto);

    try {
      // ⭐ Actualizar heartbeat del dispositivo
      this.updateDeviceHeartbeat(dto.deviceId);

      // 1. VERIFICAR SI EL DISPOSITIVO YA EXISTE EN BD (para actualizar WiFi)
      let dispositivoDbId: string | undefined;
      const dispositivoExistente = await this.prisma.dispositivo.findUnique({
        where: { id_dispositivo: dto.deviceId }
      });

      if (dispositivoExistente) {
        console.log(`[ESP32-CONN] Dispositivo ${dto.deviceId} ya existe en BD, actualizando estado WiFi...`);
        // Solo actualizar estado de conexión y WiFi, NO crear si no existe
        await this.prisma.dispositivo.update({
          where: { id_dispositivo: dispositivoExistente.id_dispositivo },
          data: {
            online_status: true,
            last_seen: new Date(),
          },
        });
        console.log(`[ESP32-CONN] ✓ Dispositivo existente actualizado en BD`);
        dispositivoDbId = dispositivoExistente.id_dispositivo;
      } else {
        console.log(`[ESP32-CONN] Dispositivo ${dto.deviceId} NO existe en BD. Se creará al vincular con adulto mayor.`);
      }

      // 2. GUARDAR EN MEMORIA (para consultas rápidas antes de vincular)
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
        message: dispositivoExistente 
          ? 'Conexión WiFi actualizada en BD y registrada en memoria'
          : 'Conexión WiFi registrada en memoria (dispositivo se creará al vincular)',
        deviceId: dto.deviceId,
        dispositivoDbId: dispositivoDbId,
        inDatabase: !!dispositivoExistente,
        userId: dto.userId,
      };
    } catch (error) {
      console.error('[ESP32-CONN] ✗ Error al registrar conexión:', error);
      throw error;
    }
  }

  /**
   * Verifica si un dispositivo existe en BD y está vinculado a un usuario
   */
  async checkDeviceExistsForUser(userId: number, deviceId: string) {
    console.log(`[checkDeviceExists] Usuario ${userId} verificando dispositivo ${deviceId}`);

    try {
      // Buscar el dispositivo por id_dispositivo
      const dispositivo = await this.prisma.dispositivo.findUnique({
        where: { id_dispositivo: deviceId },
        include: {
          adultos: {
            include: {
              usuariosAdultoMayor: {
                where: {
                  id_usuario: userId
                }
              }
            }
          }
        }
      });

      if (!dispositivo) {
        console.log(`[checkDeviceExists] Dispositivo ${deviceId} NO existe en BD`);
        return {
          exists: false,
          inDatabase: false,
          vinculado: false,
          message: 'Dispositivo no encontrado'
        };
      }

      // Verificar si tiene adulto mayor vinculado al usuario
      const tieneAdultoMayorVinculado = dispositivo.adultos.some(
        adulto => adulto.usuariosAdultoMayor.length > 0
      );

      console.log(`[checkDeviceExists] Dispositivo ${deviceId}:`, {
        existe: true,
        id: dispositivo.id_dispositivo,
        tieneAdultoMayor: dispositivo.adultos.length > 0,
        vinculadoAlUsuario: tieneAdultoMayorVinculado
      });

      return {
        exists: true,
        inDatabase: true,
        vinculado: tieneAdultoMayorVinculado,
        dispositivoId: dispositivo.id_dispositivo,
        adultosMayores: dispositivo.adultos.map(a => ({
          id_adulto: a.id_adulto,
          nombre: a.nombre
        })),
        message: tieneAdultoMayorVinculado 
          ? 'Dispositivo ya vinculado' 
          : 'Dispositivo existe pero no está vinculado'
      };
    } catch (error) {
      console.error('[checkDeviceExists] Error:', error);
      return {
        exists: false,
        inDatabase: false,
        vinculado: false,
        error: 'Error al verificar dispositivo'
      };
    }
  }

  /**
   * Consulta si un dispositivo (por nombre) está conectado
   * Verifica primero la memoria temporal, luego la BD
   */
  async checkDeviceConnectionStatus(deviceName: string) {
    // 1. Verificar en memoria temporal (más rápido)
    const deviceInfo = this.connectedDevices.get(deviceName);

    if (deviceInfo) {
      console.log(`[ESP32] Dispositivo ${deviceName} encontrado en memoria: conectado`);
      return {
        connected: true,
        deviceId: deviceInfo.deviceId,
        ssid: deviceInfo.ssid,
        ip: deviceInfo.ip,
        rssi: deviceInfo.rssi,
        userId: deviceInfo.userId,
        source: 'memory'
      };
    }

    // 2. Verificar en BD (si no está en memoria)
    console.log(`[ESP32] Dispositivo ${deviceName} no encontrado en memoria, consultando BD...`);
    try {
      const dispositivo = await this.prisma.dispositivo.findUnique({
        where: { id_dispositivo: deviceName }
      });

      if (dispositivo) {
        console.log(`[ESP32] Dispositivo ${deviceName} encontrado en BD`);
        return {
          connected: true,
          deviceId: dispositivo.id_dispositivo,
          dbId: dispositivo.id_dispositivo,
          online_status: dispositivo.online_status,
          last_seen: dispositivo.last_seen,
          source: 'database'
        };
      }
    } catch (error) {
      console.error(`[ESP32] Error consultando BD para ${deviceName}:`, error);
    }

    console.log(`[ESP32] Dispositivo ${deviceName} no encontrado en memoria ni BD`);
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
    console.log('[ESP32-MAX] Datos MAX30102 recibidos (tiempo real - sin guardar en DB):', {
      deviceId: dto.deviceId,
      bpm: dto.max_bpm,
      avgBpm: dto.max_avg_bpm,
      irValue: dto.max_ir_value,
    });

    try {
      // ⭐ Actualizar heartbeat del dispositivo
      this.updateDeviceHeartbeat(dto.deviceId);

      // 1. Buscar el dispositivo (NO crear si no existe)
      const dispositivo = await this.prisma.dispositivo.findUnique({
        where: { id_dispositivo: dto.deviceId },
      });

      if (!dispositivo) {
        console.log(`[ESP32-MAX] ⚠️ Dispositivo ${dto.deviceId} no existe en BD. Ignorando datos MAX30102.`);
        console.log(`[ESP32-MAX] El dispositivo debe ser vinculado primero con datos del adulto mayor.`);
        return {
          success: false,
          message: 'Dispositivo no vinculado. Los datos del sensor se ignorarán hasta que se vincule.',
          deviceId: dto.deviceId,
        };
      }

      // 2. Actualizar solo el estado de conexión (sin batería, ya que no viene en el JSON)
      await this.prisma.dispositivo.update({
        where: { id_dispositivo: dispositivo.id_dispositivo },
        data: {
          online_status: true,
          last_seen: new Date(),
        },
      });

      // ⚠️ NO GUARDAR EN SENSORDATA - Solo transmitir en tiempo real vía SSE
      console.log(
        `[ESP32-MAX] 📡 Transmitiendo en tiempo real (sin DB). BPM: ${dto.max_bpm}, Avg: ${dto.max_avg_bpm}`
      );

      // 3. Buscar adulto mayor asociado y emitir BPM promedio via SSE
      const adultoMayor = await this.prisma.adultoMayor.findFirst({
        where: { id_dispositivo: dispositivo.id_dispositivo },
        include: { 
          usuariosAdultoMayor: { 
            select: { id_usuario: true } 
          },
          // ⭐ Incluir grupos compartidos
          sharedInGroups: {
            include: {
              group: {
                include: {
                  members: {
                    select: { user_id: true }
                  }
                }
              }
            }
          }
        },
      });

      // Separar usuarios owners de miembros de grupo
      let totalUsers = 0;
      
      if (adultoMayor) {
        const ownerIds = new Set<number>();
        const groupMemberIds = new Set<number>();
        
        // 1. Recopilar usuarios directamente vinculados (OWNERS - prioridad alta)
        adultoMayor.usuariosAdultoMayor.forEach(relacion => {
          ownerIds.add(relacion.id_usuario);
        });
        
        // 2. Recopilar usuarios de grupos compartidos (miembros - prioridad normal)
        adultoMayor.sharedInGroups?.forEach(sharedDevice => {
          sharedDevice.group.members.forEach(member => {
            // Solo agregar si NO es owner (evitar duplicados)
            if (!ownerIds.has(member.user_id)) {
              groupMemberIds.add(member.user_id);
            }
          });
        });

        totalUsers = ownerIds.size + groupMemberIds.size;
        console.log(`[ESP32-MAX] 📊 Enviando BPM ${dto.max_avg_bpm} a ${totalUsers} usuario(s) (${ownerIds.size} owners, ${groupMemberIds.size} miembros)`);

        // 3. PRIMERO: Enviar a OWNERS (dispositivos principales)
        for (const userId of ownerIds) {
          this.deviceEventsService.emitNotification({
            id_notificacion: 0,
            userId: userId,
            tipo: 'BPM_UPDATE',
            usuario: adultoMayor.nombre,
            mensaje: undefined,
            fecha_hora: new Date().toISOString(),
            pulso: dto.max_avg_bpm,
          });
          console.log(`[ESP32-MAX] 📊 [OWNER] BPM ${dto.max_avg_bpm} enviado al usuario ${userId}`);
        }
        
        // 4. SEGUNDO: Enviar a miembros del grupo
        for (const userId of groupMemberIds) {
          this.deviceEventsService.emitNotification({
            id_notificacion: 0,
            userId: userId,
            tipo: 'BPM_UPDATE',
            usuario: adultoMayor.nombre,
            mensaje: undefined,
            fecha_hora: new Date().toISOString(),
            pulso: dto.max_avg_bpm,
          });
          console.log(`[ESP32-MAX] 📊 [GROUP] BPM ${dto.max_avg_bpm} enviado al usuario ${userId}`);
        }
      }

      return {
        success: true,
        message: 'Datos MAX30102 transmitidos en tiempo real (sin almacenamiento)',
        deviceId: dto.deviceId,
        bpm: dto.max_bpm,
        avgBpm: dto.max_avg_bpm,
        streamedToUsers: totalUsers,
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
      bpm: dto.bpm,
      timestamp: dto.timestamp,
    });

    try {
      // ⭐ Actualizar heartbeat del dispositivo
      this.updateDeviceHeartbeat(dto.deviceId);

      // 1. Buscar el dispositivo (NO crear si no existe)
      let dispositivo = await this.prisma.dispositivo.findUnique({
        where: { id_dispositivo: dto.deviceId },
      });

      if (!dispositivo) {
        console.log(`[ESP32-MPU] ⚠️⚠️ ALERTA IGNORADA: Dispositivo ${dto.deviceId} no existe en BD.`);
        console.log(`[ESP32-MPU] El dispositivo debe ser vinculado primero antes de enviar alertas.`);
        return {
          success: false,
          message: 'Dispositivo no vinculado. Las alertas se ignorarán hasta que se vincule.',
          deviceId: dto.deviceId,
          alert: 'ignored',
        };
      }

      // Actualizar estado del dispositivo existente
      dispositivo = await this.prisma.dispositivo.update({
        where: { id_dispositivo: dispositivo.id_dispositivo },
        data: {
          online_status: true,
          last_seen: new Date(),
        },
      });

      console.log(`[ESP32-MPU] ✓ Dispositivo actualizado`);

      // 2. Crear notificación y emitir evento SSE (YA NO se guarda en SensorData)
      await this.handleMpuFallAlert(dispositivo.id_dispositivo, dto);

      return {
        success: true,
        message: '⚠️ Alerta de desmayo procesada',
        deviceId: dto.deviceId,
        alertType: dto.alert_type,
        bpm: dto.bpm,
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
    dispositivoId: string,
    alertData: Esp32MpuAlertDto
  ) {
    console.log(`[MPU-ALERT] Procesando alerta de desmayo para dispositivo ID ${dispositivoId}`);

    try {
      // Buscar el dispositivo para obtener su id_dispositivo
      const dispositivo = await this.prisma.dispositivo.findUnique({
        where: { id_dispositivo: dispositivoId },
      });

      if (!dispositivo) {
        console.error(`[MPU-ALERT] ✗ Dispositivo ${dispositivoId} no encontrado`);
        return;
      }

      console.log(`[MPU-ALERT] Dispositivo encontrado: ${dispositivo.id_dispositivo}`);

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
          `[MPU-ALERT] ⚠️ NO SE ENCONTRÓ ADULTO MAYOR para dispositivo ${dispositivo.id_dispositivo}`
        );
        console.warn(`[MPU-ALERT] ⚠️ Debes vincular el dispositivo desde la app con el botón "Guardar" del modal`);
        console.warn(`[MPU-ALERT] ⚠️ Esto creará la relación: Dispositivo → AdultoMayor → Usuario`);
        
        // Si hay userId en la alerta, enviar notificación directa al usuario
        if (alertData.userId) {
          const userId = parseInt(alertData.userId);
          console.log(`[MPU-ALERT] Enviando alerta directa al usuario ${userId}`);
          
          await this.sendNotificationToUser(userId, {
            id_notificacion: 0, // Notificación temporal sin ID de BD
            tipo: 'DESMAYO',
            usuario: `Dispositivo ${dispositivo.id_dispositivo}`,
            mensaje: `⚠️ ${alertData.alert_type} - Dispositivo sin vincular - BPM: ${alertData.bpm}`,
            fecha_hora: new Date().toISOString(),
            pulso: alertData.bpm,
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

      // Crear notificación de desmayo en la base de datos con valor de BPM
      const notificacion = await this.prisma.notificaciones.create({
        data: {
          id_adulto: adultoMayor.id_adulto,
          tipo: 'EMERGENCIA',
          fecha_hora: new Date(),
          mensaje: `${adultoMayor.nombre} necesita tu ayuda rápido`,
          pulso: alertData.bpm, // ⭐ Guardar el valor de BPM en la notificación
        },
      });

      console.log(
        `[MPU-ALERT] ✓ Notificación de desmayo creada (ID: ${notificacion.id_notificacion}) para ${adultoMayor.nombre} con BPM: ${alertData.bpm}`
      );

      // Buscar grupos compartidos para este adulto mayor
      const sharedGroups = await this.prisma.sharedGroupDevice.findMany({
        where: { adulto_id: adultoMayor.id_adulto },
        include: {
          group: {
            include: {
              members: {
                select: { user_id: true }
              }
            }
          }
        }
      });

      // Separar usuarios owners de miembros de grupo
      const ownerIds = new Set<number>();
      const groupMemberIds = new Set<number>();
      
      // Agregar usuarios directamente vinculados (OWNERS)
      adultoMayor.usuariosAdultoMayor.forEach(relacion => {
        ownerIds.add(relacion.usuario.id_usuario);
      });
      
      // Agregar usuarios de grupos compartidos (solo si no son owners)
      sharedGroups.forEach(sharedDevice => {
        sharedDevice.group.members.forEach(member => {
          if (!ownerIds.has(member.user_id)) {
            groupMemberIds.add(member.user_id);
          }
        });
      });

      const totalUsers = ownerIds.size + groupMemberIds.size;
      console.log(`[MPU-ALERT] 🚨 Enviando notificación EMERGENCIA a ${totalUsers} usuario(s) (${ownerIds.size} owners, ${groupMemberIds.size} miembros)`);

      if (totalUsers === 0) {
        console.warn(`[MPU-ALERT] ⚠ No hay usuarios monitoreando a ${adultoMayor.nombre}`);
      }

      // PRIMERO: Enviar a OWNERS
      for (const userId of ownerIds) {
        await this.sendNotificationToUser(userId, {
          id_notificacion: notificacion.id_notificacion,
          tipo: 'EMERGENCIA',
          usuario: adultoMayor.nombre,
          mensaje: notificacion.mensaje || `${adultoMayor.nombre} necesita tu ayuda rápido`,
          fecha_hora: notificacion.fecha_hora.toISOString(),
          pulso: alertData.bpm,
        });
        console.log(`[MPU-ALERT] 🔔 [OWNER] EMERGENCIA enviada al usuario ${userId}`);
      }
      
      // SEGUNDO: Enviar a miembros del grupo
      for (const userId of groupMemberIds) {
        await this.sendNotificationToUser(userId, {
          id_notificacion: notificacion.id_notificacion,
          tipo: 'EMERGENCIA',
          usuario: adultoMayor.nombre,
          mensaje: notificacion.mensaje || `${adultoMayor.nombre} necesita tu ayuda rápido`,
          fecha_hora: notificacion.fecha_hora.toISOString(),
          pulso: alertData.bpm,
        });
        console.log(`[MPU-ALERT] 🔔 [GROUP] EMERGENCIA enviada al usuario ${userId}`);
      }
    } catch (error) {
      console.error('[MPU-ALERT] ✗ Error al crear notificación de desmayo:', error);
      console.error('[MPU-ALERT] Stack:', error.stack);
    }
  }

  /**
   * ⭐ NUEVO: Procesa y almacena alertas del botón de pánico
   * Crea una notificación y emite eventos SSE
   */
  async handleEsp32ButtonAlert(dto: Esp32ButtonAlertDto) {
    console.log('[ESP32-BUTTON] ⚠️⚠️⚠️ ALERTA DE BOTÓN DE PÁNICO RECIBIDA ⚠️⚠️⚠️');
    console.log('[ESP32-BUTTON] Datos:', {
      deviceId: dto.deviceId,
      alertType: dto.alert_type,
      bpm: dto.bpm,
      message: dto.message,
    });

    try {
      // ⭐ Actualizar heartbeat del dispositivo
      this.updateDeviceHeartbeat(dto.deviceId);

      // 1. Buscar el dispositivo (NO crear si no existe)
      let dispositivo = await this.prisma.dispositivo.findUnique({
        where: { id_dispositivo: dto.deviceId },
      });

      if (!dispositivo) {
        console.log(`[ESP32-BUTTON] ⚠️⚠️ ALERTA DE PÁNICO IGNORADA: Dispositivo ${dto.deviceId} no existe en BD.`);
        console.log(`[ESP32-BUTTON] El dispositivo debe ser vinculado primero antes de enviar alertas.`);
        return {
          success: false,
          message: 'Dispositivo no vinculado. Las alertas de pánico se ignorarán hasta que se vincule.',
          deviceId: dto.deviceId,
          alert: 'ignored',
        };
      }

      // Actualizar estado del dispositivo existente
      dispositivo = await this.prisma.dispositivo.update({
        where: { id_dispositivo: dispositivo.id_dispositivo },
        data: {
          online_status: true,
          last_seen: new Date(),
        },
      });

      console.log(`[ESP32-BUTTON] ✓ Dispositivo actualizado`);

      // 2. Crear notificación y emitir evento SSE (YA NO se guarda en SensorData)
      await this.handleButtonPanicAlert(dispositivo.id_dispositivo, dto);

      return {
        success: true,
        message: '⚠️ Alerta de botón de pánico procesada',
        deviceId: dto.deviceId,
        alertType: dto.alert_type,
        bpm: dto.bpm,
      };
    } catch (error) {
      console.error('[ESP32-BUTTON] ✗ Error al procesar alerta de botón:', error);
      throw error;
    }
  }

  /**
   * ⭐ NUEVO: Maneja la creación de notificaciones para alertas de botón de pánico
   */
  private async handleButtonPanicAlert(
    dispositivoId: string,
    alertData: any
  ) {
    console.log(`[BUTTON-ALERT] Procesando alerta de botón para dispositivo ID ${dispositivoId}`);

    try {
      // Buscar el dispositivo
      const dispositivo = await this.prisma.dispositivo.findUnique({
        where: { id_dispositivo: dispositivoId },
      });

      if (!dispositivo) {
        console.error(`[BUTTON-ALERT] ✗ Dispositivo ${dispositivoId} no encontrado`);
        return;
      }

      console.log(`[BUTTON-ALERT] Dispositivo encontrado: ${dispositivo.id_dispositivo}`);

      // Buscar el adulto mayor asociado
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
          `[BUTTON-ALERT] ⚠️ NO SE ENCONTRÓ ADULTO MAYOR para dispositivo ${dispositivo.id_dispositivo}`
        );
        
        // Si hay userId, enviar notificación directa
        if (alertData.userId) {
          const userId = parseInt(alertData.userId);
          console.log(`[BUTTON-ALERT] Enviando alerta directa al usuario ${userId}`);
          
          await this.sendNotificationToUser(userId, {
            id_notificacion: 0,
            tipo: 'PANICO',
            usuario: `Dispositivo ${dispositivo.id_dispositivo}`,
            mensaje: `⚠️ Botón de pánico presionado - Dispositivo sin vincular`,
            fecha_hora: new Date().toISOString(),
          });
          console.log(`[BUTTON-ALERT] 🔔 Alerta directa enviada al usuario ${userId}`);
        }
        return;
      }

      console.log(`[BUTTON-ALERT] ✅ Adulto mayor encontrado:`, {
        id_adulto: adultoMayor.id_adulto,
        nombre: adultoMayor.nombre,
        usuarios_monitoreando: adultoMayor.usuariosAdultoMayor.length
      });

      // Crear notificación en la base de datos con valor de BPM
      const notificacion = await this.prisma.notificaciones.create({
        data: {
          id_adulto: adultoMayor.id_adulto,
          tipo: 'PANICO',
          fecha_hora: new Date(),
          mensaje: `${adultoMayor.nombre} presionó el botón de emergencia`,
          pulso: alertData.bpm, // ⭐ Guardar el valor de BPM en la notificación
        },
      });

      console.log(
        `[BUTTON-ALERT] ✓ Notificación creada (ID: ${notificacion.id_notificacion}) para ${adultoMayor.nombre} con BPM: ${alertData.bpm}`
      );

      // Buscar grupos compartidos para este adulto mayor
      const sharedGroups = await this.prisma.sharedGroupDevice.findMany({
        where: { adulto_id: adultoMayor.id_adulto },
        include: {
          group: {
            include: {
              members: {
                select: { user_id: true }
              }
            }
          }
        }
      });

      // Separar usuarios owners de miembros de grupo
      const ownerIds = new Set<number>();
      const groupMemberIds = new Set<number>();
      
      // Agregar usuarios directamente vinculados (OWNERS)
      adultoMayor.usuariosAdultoMayor.forEach(relacion => {
        ownerIds.add(relacion.usuario.id_usuario);
      });
      
      // Agregar usuarios de grupos compartidos (solo si no son owners)
      sharedGroups.forEach(sharedDevice => {
        sharedDevice.group.members.forEach(member => {
          if (!ownerIds.has(member.user_id)) {
            groupMemberIds.add(member.user_id);
          }
        });
      });

      const totalUsers = ownerIds.size + groupMemberIds.size;
      console.log(`[BUTTON-ALERT] 🚨 Enviando notificación PÁNICO a ${totalUsers} usuario(s) (${ownerIds.size} owners, ${groupMemberIds.size} miembros)`);

      if (totalUsers === 0) {
        console.warn(`[BUTTON-ALERT] ⚠ No hay usuarios monitoreando a ${adultoMayor.nombre}`);
      }

      // PRIMERO: Enviar a OWNERS
      for (const userId of ownerIds) {
        await this.sendNotificationToUser(userId, {
          id_notificacion: notificacion.id_notificacion,
          tipo: 'PANICO',
          usuario: adultoMayor.nombre,
          mensaje: notificacion.mensaje || `${adultoMayor.nombre} presionó el botón de emergencia`,
          fecha_hora: notificacion.fecha_hora.toISOString(),
        });
        console.log(`[BUTTON-ALERT] 🔔 [OWNER] PÁNICO enviada al usuario ${userId}`);
      }
      
      // SEGUNDO: Enviar a miembros del grupo
      for (const userId of groupMemberIds) {
        await this.sendNotificationToUser(userId, {
          id_notificacion: notificacion.id_notificacion,
          tipo: 'PANICO',
          usuario: adultoMayor.nombre,
          mensaje: notificacion.mensaje || `${adultoMayor.nombre} presionó el botón de emergencia`,
          fecha_hora: notificacion.fecha_hora.toISOString(),
        });
        console.log(`[BUTTON-ALERT] 🔔 [GROUP] PÁNICO enviada al usuario ${userId}`);
      }
    } catch (error) {
      console.error('[BUTTON-ALERT] ✗ Error al crear notificación de botón:', error);
      console.error('[BUTTON-ALERT] Stack:', error.stack);
    }
  }
}
