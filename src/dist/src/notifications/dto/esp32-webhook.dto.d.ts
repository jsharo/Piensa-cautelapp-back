export declare class ESP32WebhookDto {
    deviceId: string;
    tipo: 'EMERGENCIA' | 'AYUDA';
    tipo_alerta?: string;
    mensaje?: string;
    mensaje_adicional?: string;
    fecha_hora?: string;
    ubicacion?: string;
}
