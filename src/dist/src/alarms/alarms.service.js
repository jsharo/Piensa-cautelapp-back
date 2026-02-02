"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var AlarmsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlarmsService = void 0;
const common_1 = require("@nestjs/common");
let AlarmsService = AlarmsService_1 = class AlarmsService {
    logger = new common_1.Logger(AlarmsService_1.name);
    alarmLogs = [];
    async triggerAlarm(alarmData) {
        const logEntry = {
            ...alarmData,
            type: 'ALARM_TRIGGERED',
            receivedAt: new Date().toISOString(),
            serverTime: new Date().toLocaleTimeString()
        };
        this.alarmLogs.push(logEntry);
        this.logger.log(`Alarma disparada: ${alarmData.label} a las ${alarmData.time} (ID: ${alarmData.id})`);
        this.logger.log(`Dispositivo: ${alarmData.deviceId || 'N/A'}`);
        if (this.alarmLogs.length > 100) {
            this.alarmLogs = this.alarmLogs.slice(-100);
        }
        return {
            status: 'success',
            message: 'Alarma registrada en el servidor',
            logId: logEntry.receivedAt
        };
    }
    async snoozeAlarm(data) {
        this.logger.log(`Alarma pospuesta: ${data.alarmId} por ${data.minutes} minutos`);
        return { status: 'success', message: 'Pospuesto registrado' };
    }
    async dismissAlarm(data) {
        this.logger.log(`Alarma cancelada: ${data.alarmId}`);
        return { status: 'success', message: 'Cancelación registrada' };
    }
    getAlarmLogs() {
        return this.alarmLogs;
    }
};
exports.AlarmsService = AlarmsService;
exports.AlarmsService = AlarmsService = AlarmsService_1 = __decorate([
    (0, common_1.Injectable)()
], AlarmsService);
//# sourceMappingURL=alarms.service.js.map