import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { getJwtSecret } from './jwt-secret';
import { JwtPayload, toAuthenticatedUser } from './auth-user';
import { SessionService } from './session.service';

/**
 * Guard para SSE que permite JWT desde query params o header.
 * EventSource no soporta headers personalizados, así que el token se pasa como query param.
 */
@Injectable()
export class SseJwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const tokenFromQuery = request.query?.token;

    if (typeof tokenFromQuery === 'string' && tokenFromQuery.length > 0) {
      try {
        const payload = this.jwtService.verify<JwtPayload>(tokenFromQuery, {
          secret: getJwtSecret(),
        });
        const authUser = toAuthenticatedUser(payload);
        const current = await this.prisma.usuario.findUnique({
          where: { id_usuario: authUser.id_usuario },
          select: { token_version: true },
        });
        if (!current || current.token_version !== authUser.token_version) {
          throw new UnauthorizedException('Token inválido');
        }
        if (authUser.sid) {
          await this.sessions.assertActive(authUser.sid, authUser.id_usuario);
        }
        request.user = authUser;
        return true;
      } catch (error) {
        if (error instanceof UnauthorizedException) {
          throw error;
        }
        throw new UnauthorizedException('Token inválido');
      }
    }

    return super.canActivate(context) as Promise<boolean>;
  }
}
