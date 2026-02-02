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
exports.AlarmsController = void 0;
const common_1 = require("@nestjs/common");
const alarms_service_1 = require("./alarms.service");
let AlarmsController = class AlarmsController {
    alarmsService;
    constructor(alarmsService) {
        this.alarmsService = alarmsService;
    }
    async trigger(alarmData) {
        return this.alarmsService.triggerAlarm(alarmData);
    }
    async snooze(data) {
        return this.alarmsService.snoozeAlarm(data);
    }
    async dismiss(data) {
        return this.alarmsService.dismissAlarm(data);
    }
    async getLogs() {
        return this.alarmsService.getAlarmLogs();
    }
};
exports.AlarmsController = AlarmsController;
__decorate([
    (0, common_1.Post)('trigger'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AlarmsController.prototype, "trigger", null);
__decorate([
    (0, common_1.Post)('snooze'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AlarmsController.prototype, "snooze", null);
__decorate([
    (0, common_1.Post)('dismiss'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AlarmsController.prototype, "dismiss", null);
__decorate([
    (0, common_1.Get)('logs'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AlarmsController.prototype, "getLogs", null);
exports.AlarmsController = AlarmsController = __decorate([
    (0, common_1.Controller)('alarms'),
    __metadata("design:paramtypes", [alarms_service_1.AlarmsService])
], AlarmsController);
//# sourceMappingURL=alarms.controller.js.map