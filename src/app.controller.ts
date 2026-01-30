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

      return {
        status: 'ok',
        devices: devices.map(device => ({
          id_dispositivo: device.id_dispositivo,
          isOnline: device.online_status,
          lastSeen: device.last_seen,
          adultos: device.adultos,
        }))
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
      
      return {
        status: 'ok',
        device: {
          id_dispositivo: device.id_dispositivo,
          isOnline: device.online_status,
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
