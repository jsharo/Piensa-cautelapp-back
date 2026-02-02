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
exports.DeviceController = void 0;
const common_1 = require("@nestjs/common");
const device_service_1 = require("./device.service");
const update_device_dto_1 = require("./dto/update-device.dto");
const vincular_dispositivo_dto_1 = require("./dto/vincular-dispositivo.dto");
const update_adulto_mayor_dto_1 = require("./dto/update-adulto-mayor.dto");
const esp32_connection_dto_1 = require("./dto/esp32-connection.dto");
const esp32_max_data_dto_1 = require("./dto/esp32-max-data.dto");
const esp32_mpu_alert_dto_1 = require("./dto/esp32-mpu-alert.dto");
const esp32_button_alert_dto_1 = require("./dto/esp32-button-alert.dto");
const jwt_guard_1 = require("../auth/jwt.guard");
const sse_jwt_guard_1 = require("../auth/sse-jwt.guard");
const device_events_service_1 = require("./device-events.service");
const rxjs_1 = require("rxjs");
let DeviceController = class DeviceController {
    deviceService;
    deviceEventsService;
    constructor(deviceService, deviceEventsService) {
        this.deviceService = deviceService;
        this.deviceEventsService = deviceEventsService;
    }
    async vincularDispositivo(req, dto) {
        const userId = req.user.id_usuario;
        console.log('[vincularDispositivo] Usuario:', userId, 'intentando vincular:', dto.id_dispositivo);
        try {
            return await this.deviceService.vincularDispositivoAUsuario(userId, dto);
        }
        catch (error) {
            console.error('[vincularDispositivo] Error:', error.message);
            throw error;
        }
    }
    obtenerMisDispositivos(req) {
        const userId = req.user.id_usuario;
        return this.deviceService.obtenerDispositivosDeUsuario(userId);
    }
    actualizarAdultoMayor(req, id, dto) {
        const userId = req.user.id_usuario;
        return this.deviceService.updateAdultoMayor(userId, +id, dto);
    }
    findAll() {
        return this.deviceService.findAll();
    }
    findOne(id) {
        return this.deviceService.findOne(id);
    }
    update(id, updateDeviceDto) {
        return this.deviceService.update(id, updateDeviceDto);
    }
    remove(req, id) {
        const userId = req.user.id_usuario;
        console.log(`[CONTROLLER] DELETE /device/${id} - Usuario ${userId}`);
        return this.deviceService.stopMonitoringDevice(userId, +id);
    }
    stopMonitoring(req, adultoId) {
        const userId = req.user.id_usuario;
        console.log(`[CONTROLLER] POST /device/stop-monitoring/${adultoId} - Usuario ${userId}`);
        return this.deviceService.stopMonitoringDevice(userId, +adultoId);
    }
    handleEsp32Connection(dto) {
        return this.deviceService.handleEsp32Connection(dto);
    }
    checkDeviceStatus(deviceName) {
        if (!deviceName) {
            return { error: 'Parámetro "device" requerido' };
        }
        return this.deviceService.checkDeviceConnectionStatus(deviceName);
    }
    async checkDeviceExists(req, macAddress) {
        const userId = req.user.id_usuario;
        return this.deviceService.checkDeviceExistsForUser(userId, macAddress);
    }
    handleEsp32MaxData(dto) {
        console.log('[CONTROLLER] Datos MAX30102 recibidos');
        return this.deviceService.handleEsp32MaxData(dto);
    }
    handleEsp32MpuAlert(dto) {
        console.log('[CONTROLLER] ⚠️ Alerta MPU6050 recibida');
        return this.deviceService.handleEsp32MpuAlert(dto);
    }
    handleEsp32ButtonAlert(dto) {
        console.log('[CONTROLLER] ⚠️ Alerta de botón de pánico recibida');
        return this.deviceService.handleEsp32ButtonAlert(dto);
    }
    deviceConnectionEvents(req) {
        const userId = req.user.id_usuario;
        console.log(`[SSE] Usuario ${userId} conectado a eventos de dispositivo`);
        return this.deviceEventsService.deviceConnection$.pipe((0, rxjs_1.filter)(event => event.userId === userId), (0, rxjs_1.map)(event => ({
            data: event,
        })));
    }
    notificationEvents(req) {
        const userId = req.user.id_usuario;
        console.log(`[SSE] Usuario ${userId} conectado a eventos de notificaciones`);
        return this.deviceEventsService.notification$.pipe((0, rxjs_1.filter)(event => event.userId === userId), (0, rxjs_1.map)(event => ({
            data: event,
        })));
    }
    getConnectedDevices() {
        return this.deviceService.getConnectedDevicesDebug();
    }
};
exports.DeviceController = DeviceController;
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Post)('vincular'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, vincular_dispositivo_dto_1.VincularDispositivoDto]),
    __metadata("design:returntype", Promise)
], DeviceController.prototype, "vincularDispositivo", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Get)('mis-dispositivos'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DeviceController.prototype, "obtenerMisDispositivos", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Patch)('adulto-mayor/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_adulto_mayor_dto_1.UpdateAdultoMayorDto]),
    __metadata("design:returntype", void 0)
], DeviceController.prototype, "actualizarAdultoMayor", null);
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeviceController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], DeviceController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_device_dto_1.UpdateDeviceDto]),
    __metadata("design:returntype", void 0)
], DeviceController.prototype, "update", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], DeviceController.prototype, "remove", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Post)('stop-monitoring/:adultoId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('adultoId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], DeviceController.prototype, "stopMonitoring", null);
__decorate([
    (0, common_1.Post)('esp32/connection'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [esp32_connection_dto_1.Esp32ConnectionDto]),
    __metadata("design:returntype", void 0)
], DeviceController.prototype, "handleEsp32Connection", null);
__decorate([
    (0, common_1.Get)('esp32/status'),
    __param(0, (0, common_1.Query)('device')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], DeviceController.prototype, "checkDeviceStatus", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Get)('check-exists/:macAddress'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('macAddress')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], DeviceController.prototype, "checkDeviceExists", null);
__decorate([
    (0, common_1.Post)('esp32/sensor-data/max'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [esp32_max_data_dto_1.Esp32MaxDataDto]),
    __metadata("design:returntype", void 0)
], DeviceController.prototype, "handleEsp32MaxData", null);
__decorate([
    (0, common_1.Post)('esp32/sensor-data/mpu-alert'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [esp32_mpu_alert_dto_1.Esp32MpuAlertDto]),
    __metadata("design:returntype", void 0)
], DeviceController.prototype, "handleEsp32MpuAlert", null);
__decorate([
    (0, common_1.Post)('esp32/sensor-data/button-alert'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [esp32_button_alert_dto_1.Esp32ButtonAlertDto]),
    __metadata("design:returntype", void 0)
], DeviceController.prototype, "handleEsp32ButtonAlert", null);
__decorate([
    (0, common_1.UseGuards)(sse_jwt_guard_1.SseJwtAuthGuard),
    (0, common_1.Sse)('events/connection'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", rxjs_1.Observable)
], DeviceController.prototype, "deviceConnectionEvents", null);
__decorate([
    (0, common_1.UseGuards)(sse_jwt_guard_1.SseJwtAuthGuard),
    (0, common_1.Sse)('events/notifications'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", rxjs_1.Observable)
], DeviceController.prototype, "notificationEvents", null);
__decorate([
    (0, common_1.Get)('debug/connected-devices'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DeviceController.prototype, "getConnectedDevices", null);
exports.DeviceController = DeviceController = __decorate([
    (0, common_1.Controller)('device'),
    __metadata("design:paramtypes", [device_service_1.DeviceService,
        device_events_service_1.DeviceEventsService])
], DeviceController);
//# sourceMappingURL=device.controller.js.map