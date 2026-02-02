export declare class Esp32SensorDataDto {
    deviceId: string;
    userId?: string;
    mpu_acceleration?: number;
    mpu_fall_detected?: boolean;
    mpu_stable?: boolean;
    mpu_status?: string;
    max_ir_value?: number;
    max_bpm?: number;
    max_avg_bpm?: number;
    max_connected?: boolean;
    battery?: number;
    wifi_ssid?: string;
    wifi_rssi?: number;
    timestamp?: string;
}
