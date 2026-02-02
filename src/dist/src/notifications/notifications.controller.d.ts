import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { ESP32WebhookDto } from './dto/esp32-webhook.dto';
export declare class NotificationsController {
    private readonly notificationsService;
    private readonly logger;
    constructor(notificationsService: NotificationsService);
    create(createNotificationDto: CreateNotificationDto): Promise<{
        adulto: {
            dispositivo: {
                id_dispositivo: string;
                online_status: boolean;
                last_seen: Date | null;
                created_at: Date;
                updated_at: Date;
            } | null;
        } & {
            id_dispositivo: string | null;
            id_adulto: number;
            nombre: string;
            fecha_nacimiento: Date;
            direccion: string;
        };
    } & {
        id_adulto: number;
        tipo: string;
        fecha_hora: Date;
        pulso: number | null;
        mensaje: string | null;
        id_notificacion: number;
    }>;
    receiveESP32(dto: ESP32WebhookDto): Promise<{
        success: boolean;
        id_notificacion: number;
    }>;
    findAll(): Promise<({
        adulto: {
            dispositivo: {
                id_dispositivo: string;
                online_status: boolean;
                last_seen: Date | null;
                created_at: Date;
                updated_at: Date;
            } | null;
        } & {
            id_dispositivo: string | null;
            id_adulto: number;
            nombre: string;
            fecha_nacimiento: Date;
            direccion: string;
        };
    } & {
        id_adulto: number;
        tipo: string;
        fecha_hora: Date;
        pulso: number | null;
        mensaje: string | null;
        id_notificacion: number;
    })[]>;
    findByUser(userId: string): Promise<any[]>;
    findOne(id: string): Promise<{
        adulto: {
            dispositivo: {
                id_dispositivo: string;
                online_status: boolean;
                last_seen: Date | null;
                created_at: Date;
                updated_at: Date;
            } | null;
        } & {
            id_dispositivo: string | null;
            id_adulto: number;
            nombre: string;
            fecha_nacimiento: Date;
            direccion: string;
        };
    } & {
        id_adulto: number;
        tipo: string;
        fecha_hora: Date;
        pulso: number | null;
        mensaje: string | null;
        id_notificacion: number;
    }>;
    update(id: string, updateNotificationDto: UpdateNotificationDto): Promise<{
        adulto: {
            dispositivo: {
                id_dispositivo: string;
                online_status: boolean;
                last_seen: Date | null;
                created_at: Date;
                updated_at: Date;
            } | null;
        } & {
            id_dispositivo: string | null;
            id_adulto: number;
            nombre: string;
            fecha_nacimiento: Date;
            direccion: string;
        };
    } & {
        id_adulto: number;
        tipo: string;
        fecha_hora: Date;
        pulso: number | null;
        mensaje: string | null;
        id_notificacion: number;
    }>;
    remove(id: string): Promise<{
        id_adulto: number;
        tipo: string;
        fecha_hora: Date;
        pulso: number | null;
        mensaje: string | null;
        id_notificacion: number;
    }>;
}
