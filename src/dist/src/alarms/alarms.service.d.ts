export declare class AlarmsService {
    private readonly logger;
    private alarmLogs;
    triggerAlarm(alarmData: any): Promise<{
        status: string;
        message: string;
        logId: any;
    }>;
    snoozeAlarm(data: any): Promise<{
        status: string;
        message: string;
    }>;
    dismissAlarm(data: any): Promise<{
        status: string;
        message: string;
    }>;
    getAlarmLogs(): any[];
}
