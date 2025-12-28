import { Controller, Post, Body, Get } from '@nestjs/common';
import { AlarmsService } from './alarms.service';

@Controller('alarms')
export class AlarmsController {
    constructor(private readonly alarmsService: AlarmsService) { }

    @Post('trigger')
    async trigger(@Body() alarmData: any) {
        return this.alarmsService.triggerAlarm(alarmData);
    }

    @Post('snooze')
    async snooze(@Body() data: { alarmId: string; minutes: number; deviceId: string }) {
        return this.alarmsService.snoozeAlarm(data);
    }

    @Post('dismiss')
    async dismiss(@Body() data: { alarmId: string; deviceId: string }) {
        return this.alarmsService.dismissAlarm(data);
    }

    @Get('logs')
    async getLogs() {
        return this.alarmsService.getAlarmLogs();
    }
}