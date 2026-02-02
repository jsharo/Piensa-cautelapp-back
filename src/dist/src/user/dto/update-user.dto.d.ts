import { CreateUserDto } from './create-user.dto';
declare const UpdateUserDto_base: import("@nestjs/mapped-types").MappedType<Partial<CreateUserDto>>;
export declare class UpdateUserDto extends UpdateUserDto_base {
    nombre?: string;
    email?: string;
    email_recuperacion?: string;
    contrasena?: string;
    imagen?: string;
}
export {};
