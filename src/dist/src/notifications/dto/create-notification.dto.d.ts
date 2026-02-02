export declare class CreateNotificationDto {
    id_adulto: number;
    tipo: 'EMERGENCIA' | 'AYUDA';
    fecha_hora?: string;
    pulso?: number;
    mensaje?: string;
}
