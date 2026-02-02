"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var NotificationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let NotificationsService = NotificationsService_1 = class NotificationsService {
    prisma;
    logger = new common_1.Logger(NotificationsService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(createNotificationDto) {
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
            await this.notifySharedGroups(notification.id_adulto, notification);
            return notification;
        }
        catch (error) {
            this.logger.error('Error creando notificación:', error);
            throw new common_1.BadRequestException('Error al crear la notificación');
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
    async findOne(id) {
        const notification = await this.prisma.notificaciones.findUnique({
            where: { id_notificacion: id },
            include: {
                adulto: { include: { dispositivo: true } },
            },
        });
        if (!notification) {
            throw new common_1.NotFoundException(`Notificación con ID ${id} no encontrada`);
        }
        return notification;
    }
    async update(id, updateNotificationDto) {
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
        }
        catch (error) {
            throw new common_1.NotFoundException(`Notificación con ID ${id} no encontrada`);
        }
    }
    async remove(id) {
        try {
            return await this.prisma.notificaciones.delete({
                where: { id_notificacion: id },
            });
        }
        catch {
            throw new common_1.NotFoundException(`Notificación con ID ${id} no encontrada`);
        }
    }
    async processESP32Webhook(dto) {
        const deviceId = dto.deviceId?.trim();
        if (!deviceId) {
            throw new common_1.BadRequestException('deviceId is required');
        }
        const dispositivo = await this.prisma.dispositivo.findUnique({
            where: { id_dispositivo: deviceId },
        });
        if (!dispositivo) {
            throw new common_1.NotFoundException(`Dispositivo con ID ${dto.deviceId} no registrado`);
        }
        const adulto = await this.prisma.adultoMayor.findFirst({
            where: { id_dispositivo: dispositivo.id_dispositivo },
        });
        if (!adulto) {
            throw new common_1.NotFoundException(`No se encontró AdultoMayor asociado al dispositivo ${dispositivo.id_dispositivo}`);
        }
        const resolvedTipo = dto.tipo ?? (dto.tipo_alerta === 'automatica' ? 'EMERGENCIA' : dto.tipo_alerta === 'manual' ? 'AYUDA' : 'EMERGENCIA');
        const resolvedMensajeBase = dto.mensaje ?? dto.mensaje_adicional;
        const fechaHora = dto.fecha_hora ? new Date(dto.fecha_hora) : new Date();
        const nombreAdulto = adulto.nombre;
        const mensajeFinal = resolvedTipo === 'EMERGENCIA'
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
        this.logger.log(`ESP32 webhook OK: tipo=${notification.tipo} id=${notification.id_notificacion} adulto=${adulto.id_adulto} (${nombreAdulto}) disp=${dispositivo.id_dispositivo} mensaje="${mensajeFinal}"`);
        await this.notifySharedGroups(adulto.id_adulto, notification);
        return { success: true, id_notificacion: notification.id_notificacion };
    }
    async notifySharedGroups(adultoId, notification) {
        try {
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
            const usersToNotify = new Set();
            sharedDevices.forEach(sd => {
                sd.group.members.forEach(member => {
                    usersToNotify.add(member.user_id);
                });
            });
            this.logger.log(`Notificación compartida con ${usersToNotify.size} usuarios en ${sharedDevices.length} grupo(s) para adulto ${adultoId}`);
        }
        catch (error) {
            this.logger.error('Error notificando a grupos compartidos:', error);
        }
    }
    async findByUser(userId) {
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
        const allNotifications = [...ownNotifications];
        const existingIds = new Set(ownNotifications.map(n => n.id_notificacion));
        sharedNotifications.forEach(n => {
            if (!existingIds.has(n.id_notificacion)) {
                allNotifications.push(n);
            }
        });
        allNotifications.sort((a, b) => new Date(b.fecha_hora).getTime() - new Date(a.fecha_hora).getTime());
        this.logger.log(`Usuario ${userId}: ${ownNotifications.length} propias + ${sharedNotifications.length} compartidas = ${allNotifications.length} total`);
        return allNotifications;
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = NotificationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map