"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceEventsService = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
let DeviceEventsService = class DeviceEventsService {
    deviceConnectionSubject = new rxjs_1.Subject();
    sensorDataSubject = new rxjs_1.Subject();
    notificationSubject = new rxjs_1.Subject();
    deviceConnection$ = this.deviceConnectionSubject.asObservable();
    sensorData$ = this.sensorDataSubject.asObservable();
    notification$ = this.notificationSubject.asObservable();
    emitDeviceConnection(event) {
        console.log('[DeviceEventsService] Emitiendo evento de conexión:', event);
        this.deviceConnectionSubject.next(event);
    }
    emitSensorData(event) {
        console.log('[DeviceEventsService] Emitiendo evento de datos de sensores:', event);
        this.sensorDataSubject.next(event);
    }
    emitNotification(event) {
        console.log('[DeviceEventsService] Emitiendo evento de notificación:', event);
        this.notificationSubject.next(event);
    }
    emitDeviceDisconnection(deviceId, userIds) {
        console.log(`[DeviceEventsService] 🔴 Emitiendo desconexión para dispositivo ${deviceId} a ${userIds.length} usuario(s)`);
        userIds.forEach(userId => {
            this.deviceConnectionSubject.next({
                deviceId,
                userId,
                ssid: '',
                rssi: 0,
                status: 'disconnected'
            });
        });
    }
};
exports.DeviceEventsService = DeviceEventsService;
exports.DeviceEventsService = DeviceEventsService = __decorate([
    (0, common_1.Injectable)()
], DeviceEventsService);
//# sourceMappingURL=device-events.service.js.map