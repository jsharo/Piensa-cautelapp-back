import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { PrismaService } from '../prisma/prisma.service';

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
}
