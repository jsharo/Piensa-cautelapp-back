import { AlarmsService } from './alarms.service';
export declare class AlarmsController {
    private readonly alarmsService;
    constructor(alarmsService: AlarmsService);
    trigger(alarmData: any): Promise<{
        status: string;
        message: string;
        logId: any;
    }>;
    snooze(data: {
        alarmId: string;
        minutes: number;
        deviceId: string;
    }): Promise<{
        status: string;
        message: string;
    }>;
    dismiss(data: {
        alarmId: string;
        deviceId: string;
    }): Promise<{
        status: string;
        message: string;
    }>;
    getLogs(): Promise<any[]>;
}
