import { Controller, Post, Body } from '@nestjs/common';
import { AlarmsService } from './alarms.service';

@Controller('alarms')
export class AlarmsController {
    constructor(private readonly alarmsService: AlarmsService) { }

    @Post('trigger')
    async trigger(@Body() alarmData: { id: string; label: string; time: string }) {
        return this.alarmsService.triggerAlarm(alarmData);
    }
}
