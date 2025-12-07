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

  // Webhook de ESP32: encuentra dispositivo por MAC, actualiza batería, crea notificación
  async processESP32Webhook(dto: ESP32WebhookDto) {
    const mac = dto.mac_address?.trim();
    if (!mac) {
      throw new BadRequestException('MAC address is required');
    }
    const dispositivoRows =
      await this.prisma.$queryRaw<Array<{ id_dispositivo: number; bateria: number; mac_address: string | null }>>`
      SELECT "id_dispositivo", "bateria", "mac_address"
      FROM "Dispositivo"
      WHERE "mac_address" = ${mac}
      LIMIT 1
    `;
    const dispositivo = dispositivoRows[0];
    if (!dispositivo) {
      throw new NotFoundException(`Dispositivo con MAC ${dto.mac_address} no registrado`);
    }

    if (typeof dto.bateria === 'number') {
      await this.prisma.dispositivo.update({
        where: { id_dispositivo: dispositivo.id_dispositivo },
        data: { bateria: dto.bateria },
      });
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
      `ESP32 webhook OK: tipo=${notification.tipo} id=${notification.id_notificacion} adulto=${adulto.id_adulto} (${nombreAdulto}) disp=${dispositivo.id_dispositivo} mac=${mac} mensaje="${mensajeFinal}"`,
    );
    return { success: true, id_notificacion: notification.id_notificacion };
  }
}
