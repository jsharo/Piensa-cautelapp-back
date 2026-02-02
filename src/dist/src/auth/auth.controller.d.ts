import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
export declare class AuthController {
    private auth;
    constructor(auth: AuthService);
    register(dto: RegisterDto): Promise<{
        user: any;
        access_token: string;
        expires_in: string;
    }>;
    login(dto: LoginDto): Promise<{
        user: any;
        access_token: string;
        expires_in: string;
    }>;
    me(req: any): Promise<any>;
    forgotPassword(body: {
        email: string;
    }): Promise<{
        code?: string | undefined;
        message: string;
    }>;
    verifyResetCode(body: {
        email: string;
        code: string;
    }): Promise<{
        message: string;
    }>;
    resetPassword(body: {
        email: string;
        code: string;
        newPassword: string;
    }): Promise<{
        message: string;
    }>;
}
