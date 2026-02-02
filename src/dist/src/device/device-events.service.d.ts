export interface DeviceConnectionEvent {
    deviceId: string;
    userId: number;
    ssid: string;
    ip?: string;
    rssi: number;
    status: string;
}
export interface SensorDataEvent {
    deviceId: string;
    userId: number;
    mpu_fall_detected: boolean;
    max_bpm: number;
    battery: number;
}
export interface NotificationEvent {
    id_notificacion: number;
    userId: number;
    tipo: string;
    usuario: string;
    mensaje?: string;
    fecha_hora: string;
    pulso?: number;
}
export declare class DeviceEventsService {
    private deviceConnectionSubject;
    private sensorDataSubject;
    private notificationSubject;
    deviceConnection$: import("rxjs").Observable<DeviceConnectionEvent>;
    sensorData$: import("rxjs").Observable<SensorDataEvent>;
    notification$: import("rxjs").Observable<NotificationEvent>;
    emitDeviceConnection(event: DeviceConnectionEvent): void;
    emitSensorData(event: SensorDataEvent): void;
    emitNotification(event: NotificationEvent): void;
    emitDeviceDisconnection(deviceId: string, userIds: number[]): void;
}
