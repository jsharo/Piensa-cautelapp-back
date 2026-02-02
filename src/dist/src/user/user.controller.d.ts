import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
export declare class UserController {
    private readonly userService;
    constructor(userService: UserService);
    create(createUserDto: CreateUserDto): Promise<{
        rol: {
            id_rol: number;
            nombre_rol: string;
            descripcion: string | null;
        };
        nombre: string;
        email: string;
        id_rol: number;
        id_usuario: number;
        email_recuperacion: string | null;
        imagen: string | null;
        fcm_token: string | null;
    }>;
    findAll(): Promise<{
        rol: {
            id_rol: number;
            nombre_rol: string;
            descripcion: string | null;
        };
        nombre: string;
        email: string;
        id_rol: number;
        id_usuario: number;
        email_recuperacion: string | null;
        imagen: string | null;
        fcm_token: string | null;
    }[]>;
    findOne(id: string): Promise<{
        rol: {
            id_rol: number;
            nombre_rol: string;
            descripcion: string | null;
        };
        nombre: string;
        email: string;
        id_rol: number;
        id_usuario: number;
        email_recuperacion: string | null;
        imagen: string | null;
        fcm_token: string | null;
    }>;
    update(req: any, id: string, updateUserDto: UpdateUserDto): Promise<{
        rol: {
            id_rol: number;
            nombre_rol: string;
            descripcion: string | null;
        };
        nombre: string;
        email: string;
        id_rol: number;
        id_usuario: number;
        email_recuperacion: string | null;
        imagen: string | null;
        fcm_token: string | null;
    }>;
    remove(id: string): Promise<{
        success: boolean;
    }>;
    saveFcmToken(data: {
        userId: number;
        fcmToken: string;
        platform?: string;
    }): Promise<{
        message: string;
    }>;
    deleteFcmToken(userId: string): Promise<{
        message: string;
    }>;
}
