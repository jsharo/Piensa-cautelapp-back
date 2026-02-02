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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppController = void 0;
const common_1 = require("@nestjs/common");
const app_service_1 = require("./app.service");
const prisma_service_1 = require("./prisma/prisma.service");
let AppController = class AppController {
    appService;
    prisma;
    constructor(appService, prisma) {
        this.appService = appService;
        this.prisma = prisma;
    }
    getHello() {
        return this.appService.getHello();
    }
    async receiveDeviceOnline(body) {
        const { deviceId } = body;
        console.log(`[ESP32] Confirmación de conexión recibida:`, body);
        try {
            const device = await this.prisma.dispositivo.upsert({
                where: { id_dispositivo: deviceId },
                update: {
                    online_status: true,
                    last_seen: new Date(),
                },
                create: {
                    id_dispositivo: deviceId,
                    online_status: true,
                    last_seen: new Date(),
                }
            });
            console.log(`[ESP32] Dispositivo ${deviceId} actualizado como ONLINE`);
            return { status: 'ok', deviceId, online: true };
        }
        catch (error) {
            console.error(`[ESP32] Error actualizando dispositivo ${deviceId}:`, error);
            return { status: 'error', message: 'Error updating device status' };
        }
    }
    async getDevicesStatus() {
        try {
            const devices = await this.prisma.dispositivo.findMany({
                select: {
                    id_dispositivo: true,
                    online_status: true,
                    last_seen: true,
                    adultos: {
                        select: {
                            id_adulto: true,
                            nombre: true,
                        }
                    }
                }
            });
            const TIMEOUT_MS = 30 * 1000;
            const now = new Date();
            return {
                status: 'ok',
                devices: devices.map(device => {
                    const lastSeenTime = device.last_seen ? new Date(device.last_seen).getTime() : 0;
                    const timeSinceLastSeen = now.getTime() - lastSeenTime;
                    const isOnline = device.online_status && (timeSinceLastSeen < TIMEOUT_MS);
                    return {
                        id_dispositivo: device.id_dispositivo,
                        isOnline: isOnline,
                        lastSeen: device.last_seen,
                        adultos: device.adultos,
                    };
                })
            };
        }
        catch (error) {
            console.error('[DEVICES] Error obteniendo estado de dispositivos:', error);
            return { status: 'error', message: 'Error fetching devices status' };
        }
    }
    async getDeviceStatus(deviceId) {
        try {
            const device = await this.prisma.dispositivo.findUnique({
                where: { id_dispositivo: deviceId },
                select: {
                    id_dispositivo: true,
                    online_status: true,
                    last_seen: true,
                    adultos: {
                        select: {
                            id_adulto: true,
                            nombre: true,
                        }
                    }
                }
            });
            if (!device) {
                return {
                    status: 'error',
                    message: 'Device not found'
                };
            }
            const TIMEOUT_MS = 30 * 1000;
            const now = new Date();
            const lastSeenTime = device.last_seen ? new Date(device.last_seen).getTime() : 0;
            const timeSinceLastSeen = now.getTime() - lastSeenTime;
            const isOnline = device.online_status && (timeSinceLastSeen < TIMEOUT_MS);
            return {
                status: 'ok',
                device: {
                    id_dispositivo: device.id_dispositivo,
                    isOnline: isOnline,
                    lastSeen: device.last_seen,
                    adultos: device.adultos,
                }
            };
        }
        catch (error) {
            console.error(`[DEVICE] Error obteniendo estado del dispositivo ${deviceId}:`, error);
            return { status: 'error', message: 'Error fetching device status' };
        }
    }
};
exports.AppController = AppController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", String)
], AppController.prototype, "getHello", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "receiveDeviceOnline", null);
__decorate([
    (0, common_1.Get)('devices/status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AppController.prototype, "getDevicesStatus", null);
__decorate([
    (0, common_1.Get)('devices/:deviceId/status'),
    __param(0, (0, common_1.Param)('deviceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "getDeviceStatus", null);
exports.AppController = AppController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [app_service_1.AppService,
        prisma_service_1.PrismaService])
], AppController);
//# sourceMappingURL=app.controller.js.map