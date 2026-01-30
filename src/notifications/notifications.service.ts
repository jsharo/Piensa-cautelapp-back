import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { PrismaService } from '../prisma/prisma.service';
import { ESP32WebhookDto } from './dto/esp32-webhook.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  async create(createNotificationDto: CreateNotificationDto) {
    try {
      const notification = await this.prisma.notificaciones.create({
        data: {
          id_adulto: createNotificationDto.id_adulto,
          tipo: createNotificationDto.tipo,
          fecha_hora: createNotificationDto.fecha_hora
            ? new Date(createNotificationDto.fecha_hora)
            : new Date(),
          pulso: createNotificationDto.pulso,
          mensaje: createNotificationDto.mensaje,
        },
        include: {
          adulto: {
            include: { dispositivo: true },
          },
        },
      });

      this.logger.log(`Notificación creada con ID: ${notification.id_notificacion}`);
      
      // Enviar notificación a grupos compartidos
      await this.notifySharedGroups(notification.id_adulto, notification);
      
      return notification;
    } catch (error) {
      this.logger.error('Error creando notificación:', error);
      throw new BadRequestException('Error al crear la notificación');
    }
  }

  async findAll() {
    return await this.prisma.notificaciones.findMany({
      include: {
        adulto: { include: { dispositivo: true } },
      },
      orderBy: { fecha_hora: 'desc' },
    });
  }

  async findOne(id: number) {
    const notification = await this.prisma.notificaciones.findUnique({
      where: { id_notificacion: id },
      include: {
        adulto: { include: { dispositivo: true } },
      },
    });

    if (!notification) {
      throw new NotFoundException(`Notificación con ID ${id} no encontrada`);
    }

    return notification;
  }

  async update(id: number, updateNotificationDto: UpdateNotificationDto) {
    try {
      return await this.prisma.notificaciones.update({
        where: { id_notificacion: id },
        data: {
          id_adulto: updateNotificationDto.id_adulto,
          tipo: updateNotificationDto.tipo,
          fecha_hora: updateNotificationDto.fecha_hora
            ? new Date(updateNotificationDto.fecha_hora)
            : undefined,
          pulso: updateNotificationDto.pulso,
          mensaje: updateNotificationDto.mensaje,
        },
        include: {
          adulto: { include: { dispositivo: true } },
        },
      });
    } catch (error) {
      throw new NotFoundException(`Notificación con ID ${id} no encontrada`);
    }
  }

  async remove(id: number) {
    try {
      return await this.prisma.notificaciones.delete({
        where: { id_notificacion: id },
      });
    } catch {
      throw new NotFoundException(`Notificación con ID ${id} no encontrada`);
    }
  }

  // Webhook de ESP32: encuentra dispositivo por deviceId, crea notificación
  async processESP32Webhook(dto: ESP32WebhookDto) {
    const deviceId = dto.deviceId?.trim();
    if (!deviceId) {
      throw new BadRequestException('deviceId is required');
    }

    // Buscar dispositivo por id_dispositivo
    const dispositivo = await this.prisma.dispositivo.findUnique({
      where: { id_dispositivo: deviceId },
    });

    if (!dispositivo) {
      throw new NotFoundException(`Dispositivo con ID ${dto.deviceId} no registrado`);
    }

    const adulto = await this.prisma.adultoMayor.findFirst({
      where: { id_dispositivo: dispositivo.id_dispositivo },
    });
    if (!adulto) {
      throw new NotFoundException(
        `No se encontró AdultoMayor asociado al dispositivo ${dispositivo.id_dispositivo}`,
      );
    }

    const resolvedTipo = dto.tipo ?? (dto.tipo_alerta === 'automatica' ? 'EMERGENCIA' : dto.tipo_alerta === 'manual' ? 'AYUDA' : 'EMERGENCIA');
    const resolvedMensajeBase = dto.mensaje ?? dto.mensaje_adicional;
    const fechaHora = dto.fecha_hora ? new Date(dto.fecha_hora) : new Date();

    // Mensaje final según reglas solicitadas, usando el nombre del adulto
    const nombreAdulto = adulto.nombre;
    const mensajeFinal =
      resolvedTipo === 'EMERGENCIA'
        ? `Emergencia ${nombreAdulto} necesita asistencia de inmediato.`
        : `Ayuda ${nombreAdulto} necesita que lo ayudes en algo.`;

    const notification = await this.prisma.notificaciones.create({
      data: {
        id_adulto: adulto.id_adulto,
        tipo: resolvedTipo,
        fecha_hora: fechaHora,
        mensaje: mensajeFinal,
      },
      include: { adulto: { include: { dispositivo: true } } },
    });
    this.logger.log(
      `ESP32 webhook OK: tipo=${notification.tipo} id=${notification.id_notificacion} adulto=${adulto.id_adulto} (${nombreAdulto}) disp=${dispositivo.id_dispositivo} mensaje="${mensajeFinal}"`,
    );
    
    // Enviar notificación a grupos compartidos
    await this.notifySharedGroups(adulto.id_adulto, notification);
    
    return { success: true, id_notificacion: notification.id_notificacion };
  }

  // ========== MÉTODOS PARA NOTIFICACIONES COMPARTIDAS ==========
  
  /**
   * Notifica a todos los usuarios de grupos que tienen acceso al dispositivo
   */
  private async notifySharedGroups(adultoId: number, notification: any) {
    try {
      // Buscar grupos que tienen acceso a este dispositivo
      const sharedDevices = await this.prisma.sharedGroupDevice.findMany({
        where: { adulto_id: adultoId },
        include: {
          group: {
            include: {
              members: {
                include: {
                  user: true
                }
              }
            }
          }
        }
      });

      if (sharedDevices.length === 0) {
        this.logger.log(`No hay grupos compartidos para el adulto ${adultoId}`);
        return;
      }

      // Obtener todos los usuarios únicos de todos los grupos
      const usersToNotify = new Set<number>();
      sharedDevices.forEach(sd => {
        sd.group.members.forEach(member => {
          usersToNotify.add(member.user_id);
        });
      });

      this.logger.log(
        `Notificación compartida con ${usersToNotify.size} usuarios en ${sharedDevices.length} grupo(s) para adulto ${adultoId}`
      );

      // Aquí podrías agregar lógica adicional para enviar push notifications
      // o almacenar las notificaciones en una tabla de notificaciones por usuario
      
    } catch (error) {
      this.logger.error('Error notificando a grupos compartidos:', error);
      // No lanzamos error para no bloquear la creación de la notificación principal
    }
  }

  /**
   * Obtiene notificaciones para un usuario específico (propias + compartidas)
   */
  async findByUser(userId: number) {
    // 1. Obtener notificaciones de dispositivos propios
    const ownNotifications = await this.prisma.notificaciones.findMany({
      where: {
        adulto: {
          usuariosAdultoMayor: {
            some: { id_usuario: userId }
          }
        }
      },
      include: {
        adulto: {
          include: { 
            dispositivo: true,
            usuariosAdultoMayor: true
          }
        }
      },
      orderBy: { fecha_hora: 'desc' }
    });

    // 2. Obtener notificaciones de dispositivos compartidos en grupos
    const sharedNotifications = await this.prisma.notificaciones.findMany({
      where: {
        adulto: {
          sharedInGroups: {
            some: {
              group: {
                members: {
                  some: { user_id: userId }
                }
              }
            }
          }
        }
      },
      include: {
        adulto: {
          include: { 
            dispositivo: true,
            sharedInGroups: {
              include: {
                group: true
              }
            }
          }
        }
      },
      orderBy: { fecha_hora: 'desc' }
    });

    // Combinar y eliminar duplicados por ID
    const allNotifications: any[] = [...ownNotifications];
    const existingIds = new Set(ownNotifications.map(n => n.id_notificacion));
    
    sharedNotifications.forEach(n => {
      if (!existingIds.has(n.id_notificacion)) {
        allNotifications.push(n as any);
      }
    });

    // Ordenar por fecha
    allNotifications.sort((a, b) => 
      new Date(b.fecha_hora).getTime() - new Date(a.fecha_hora).getTime()
    );

    this.logger.log(
      `Usuario ${userId}: ${ownNotifications.length} propias + ${sharedNotifications.length} compartidas = ${allNotifications.length} total`
    );

    return allNotifications;
  }
}
