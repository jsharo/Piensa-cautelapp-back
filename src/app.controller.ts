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
    
    // TODO: Descomentar cuando la migración de BD esté aplicada
    /*
    try {
      // Buscar o crear el dispositivo
      const device = await this.prisma.dispositivo.upsert({
        where: { device_id: deviceId },
        update: {
          online_status: true,
          last_seen: new Date(),
        },
        create: {
          device_id: deviceId,
          bateria: 100, // Valor por defecto
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
    */
    
    // Respuesta temporal hasta que se aplique la migración
    return { status: 'ok', deviceId, online: true, message: 'Connection received' };
  }

  // Endpoint para consultar el estado de conexión de dispositivos
  @Get('devices/status')
  async getDevicesStatus() {
    try {
      const devices = await this.prisma.dispositivo.findMany({
        select: {
          id_dispositivo: true,
          mac_address: true,
          bateria: true,
          // TODO: Descomentar cuando la migración esté aplicada
          // device_id: true,
          // online_status: true,
          // last_seen: true,
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
          id: device.id_dispositivo,
          deviceId: 'Unknown', // device.device_id,
          macAddress: device.mac_address,
          isOnline: false, // device.online_status,
          lastSeen: null, // device.last_seen,
          battery: device.bateria,
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
      // TODO: Cambiar cuando la migración esté aplicada
      // const device = await this.prisma.dispositivo.findUnique({
      //   where: { device_id: deviceId },
      
      return {
        status: 'ok',
        device: {
          deviceId: deviceId,
          isOnline: false, // Temporal hasta aplicar migración
          lastSeen: null,
          battery: null,
          message: 'Migration pending - device status not available yet'
        }
      };
    } catch (error) {
      console.error(`[DEVICE] Error obteniendo estado del dispositivo ${deviceId}:`, error);
      return { status: 'error', message: 'Error fetching device status' };
    }
  }
}
