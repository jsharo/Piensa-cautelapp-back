import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';

/**
 * Guard para SSE que permite JWT desde query params o header
 * EventSource no soporta headers personalizados, así que el token se pasa como query param
 */
@Injectable()
export class SseJwtAuthGuard extends AuthGuard('jwt') {
  constructor(private jwtService: JwtService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Intentar obtener token desde query params primero (para SSE)
    const tokenFromQuery = request.query?.token;
    
    if (tokenFromQuery) {
      try {
        // Verificar y decodificar el token
        const payload = this.jwtService.verify(tokenFromQuery, {
          secret: process.env.JWT_SECRET || 'change-me',
        });
        
        // Adjuntar el usuario al request
        request.user = {
          id_usuario: payload.id_usuario || payload.sub,
          email: payload.email,
          role: payload.role,
        };
        
        return true;
      } catch (error) {
        console.error('[SseJwtAuthGuard] Error verificando token:', error.message);
        return false;
      }
    }
    
    // Si no hay token en query, intentar el flujo normal (header)
    return super.canActivate(context) as Promise<boolean>;
  }
}
