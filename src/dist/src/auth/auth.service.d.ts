import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { EmailService } from '../email/email.service';
export declare class AuthService {
    private prisma;
    private jwt;
    private emailService;
    constructor(prisma: PrismaService, jwt: JwtService, emailService: EmailService);
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
    me(userId: number): Promise<any>;
    private signToken;
    private sanitize;
    private ensureDefaultRole;
    forgotPassword(email: string): Promise<{
        code?: string | undefined;
        message: string;
    }>;
    verifyResetCode(email: string, code: string): Promise<{
        message: string;
    }>;
    resetPassword(email: string, code: string, newPassword: string): Promise<{
        message: string;
    }>;
}
