import { Controller, Get, Post, Body, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // Endpoint para recibir confirmación de conexión desde ESP32
  @Post()
  @HttpCode(HttpStatus.OK)
  async receiveDeviceOnline(@Body() body: { deviceId: string }) {
    const { deviceId } = body;
    console.log(`[ESP32] Confirmación de conexión recibida:`, body);
    
    try {
      // Buscar o crear el dispositivo
      const device = await this.prisma.dispositivo.upsert({
        where: { id_dispositivo: deviceId },
        update: {
          online_status: true,
          last_seen: new Date(),
        },
        create: {
          id_dispositivo: deviceId,
          online_status: true,
          last_seen: new Date(),
        }
      });
      
      console.log(`[ESP32] Dispositivo ${deviceId} actualizado como ONLINE`);
      return { status: 'ok', deviceId, online: true };
    } catch (error) {
      console.error(`[ESP32] Error actualizando dispositivo ${deviceId}:`, error);
      return { status: 'error', message: 'Error updating device status' };
    }
  }

  // Endpoint para consultar el estado de conexión de dispositivos
  @Get('devices/status')
  async getDevicesStatus() {
    try {
      const devices = await this.prisma.dispositivo.findMany({
        select: {
          id_dispositivo: true,
          online_status: true,
          last_seen: true,
          adultos: {
            select: {
              id_adulto: true,
              nombre: true,
            }
          }
        }
      });

      // ⭐ Timeout: 30 segundos sin datos = dispositivo offline
      const TIMEOUT_MS = 30 * 1000;
      const now = new Date();

      return {
        status: 'ok',
        devices: devices.map(device => {
          const lastSeenTime = device.last_seen ? new Date(device.last_seen).getTime() : 0;
          const timeSinceLastSeen = now.getTime() - lastSeenTime;
          const isOnline = device.online_status && (timeSinceLastSeen < TIMEOUT_MS);
          
          return {
            id_dispositivo: device.id_dispositivo,
            isOnline: isOnline,
            lastSeen: device.last_seen,
            adultos: device.adultos,
          };
        })
      };
    } catch (error) {
      console.error('[DEVICES] Error obteniendo estado de dispositivos:', error);
      return { status: 'error', message: 'Error fetching devices status' };
    }
  }

  // Endpoint para consultar estado específico de un dispositivo
  @Get('devices/:deviceId/status')
  async getDeviceStatus(@Param('deviceId') deviceId: string) {
    try {
      const device = await this.prisma.dispositivo.findUnique({
        where: { id_dispositivo: deviceId },
        select: {
          id_dispositivo: true,
          online_status: true,
          last_seen: true,
          adultos: {
            select: {
              id_adulto: true,
              nombre: true,
            }
          }
        }
      });

      if (!device) {
        return {
          status: 'error',
          message: 'Device not found'
        };
      }
      
      // ⭐ Timeout: 30 segundos sin datos = dispositivo offline
      const TIMEOUT_MS = 30 * 1000;
      const now = new Date();
      const lastSeenTime = device.last_seen ? new Date(device.last_seen).getTime() : 0;
      const timeSinceLastSeen = now.getTime() - lastSeenTime;
      const isOnline = device.online_status && (timeSinceLastSeen < TIMEOUT_MS);
      
      return {
        status: 'ok',
        device: {
          id_dispositivo: device.id_dispositivo,
          isOnline: isOnline,
          lastSeen: device.last_seen,
          adultos: device.adultos,
        }
      };
    } catch (error) {
      console.error(`[DEVICE] Error obteniendo estado del dispositivo ${deviceId}:`, error);
      return { status: 'error', message: 'Error fetching device status' };
    }
  }
}
