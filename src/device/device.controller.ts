import { Controller, Get, Post, Body, Patch, Param, Delete, Req, UseGuards, Sse, MessageEvent, Query } from '@nestjs/common';
import { DeviceService } from './device.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { VincularDispositivoDto } from './dto/vincular-dispositivo.dto';
import { UpdateAdultoMayorDto } from './dto/update-adulto-mayor.dto';
import { Esp32ConnectionDto } from './dto/esp32-connection.dto';
import { Esp32MaxDataDto } from './dto/esp32-max-data.dto';
import { Esp32MpuAlertDto } from './dto/esp32-mpu-alert.dto';
import { Esp32ButtonAlertDto } from './dto/esp32-button-alert.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { SseJwtAuthGuard } from '../auth/sse-jwt.guard';
import { DeviceEventsService } from './device-events.service';
import { Observable, map, filter } from 'rxjs';

@Controller('device')
export class DeviceController {
  constructor(
    private readonly deviceService: DeviceService,
    private readonly deviceEventsService: DeviceEventsService,
  ) {}

  // ⚠️ ENDPOINT DESHABILITADO: Los dispositivos solo deben crearse al vincular con adulto mayor
  // @Post()
  // create(@Body() createDeviceDto: CreateDeviceDto) {
  //   return this.deviceService.create(createDeviceDto);
  // }

  @UseGuards(JwtAuthGuard)
  @Post('vincular')
  async vincularDispositivo(@Req() req: any, @Body() dto: VincularDispositivoDto) {
    const userId = req.user.id_usuario;
    console.log('[vincularDispositivo] Usuario:', userId, 'intentando vincular:', dto.id_dispositivo);
    
    try {
      return await this.deviceService.vincularDispositivoAUsuario(userId, dto);
    } catch (error) {
      console.error('[vincularDispositivo] Error:', error.message);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('mis-dispositivos')
  obtenerMisDispositivos(@Req() req: any) {
    const userId = req.user.id_usuario;
    return this.deviceService.obtenerDispositivosDeUsuario(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('adulto-mayor/:id')
  actualizarAdultoMayor(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateAdultoMayorDto
  ) {
    const userId = req.user.id_usuario;
    return this.deviceService.updateAdultoMayor(userId, +id, dto);
  }

  @Get()
  findAll() {
    return this.deviceService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.deviceService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDeviceDto: UpdateDeviceDto) {
    return this.deviceService.update(id, updateDeviceDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.id_usuario;
    console.log(`[CONTROLLER] DELETE /device/${id} - Usuario ${userId}`);
    return this.deviceService.stopMonitoringDevice(userId, +id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('stop-monitoring/:adultoId')
  stopMonitoring(@Req() req: any, @Param('adultoId') adultoId: string) {
    const userId = req.user.id_usuario;
    console.log(`[CONTROLLER] POST /device/stop-monitoring/${adultoId} - Usuario ${userId}`);
    return this.deviceService.stopMonitoringDevice(userId, +adultoId);
  }

  // ============ ESP32 ENDPOINTS ============
  
  /**
   * Endpoint para recibir notificaciones de conexión WiFi del ESP32
   * No requiere autenticación ya que es llamado por el dispositivo
   */
  @Post('esp32/connection')
  handleEsp32Connection(@Body() dto: Esp32ConnectionDto) {
    return this.deviceService.handleEsp32Connection(dto);
  }

  /**
   * Endpoint para consultar el estado de conexión de un dispositivo ESP32
   * El frontend lo usa para hacer polling y verificar si el dispositivo ya se conectó
   */
  @Get('esp32/status')
  checkDeviceStatus(@Query('device') deviceName: string) {
    if (!deviceName) {
      return { error: 'Parámetro "device" requerido' };
    }
    return this.deviceService.checkDeviceConnectionStatus(deviceName);
  }

  /**
   * Endpoint para verificar si un dispositivo existe en la BD
   * Retorna si el dispositivo está vinculado y tiene adulto mayor asociado
   */
  @UseGuards(JwtAuthGuard)
  @Get('check-exists/:macAddress')
  async checkDeviceExists(@Req() req: any, @Param('macAddress') macAddress: string) {
    const userId = req.user.id_usuario;
    return this.deviceService.checkDeviceExistsForUser(userId, macAddress);
  }



  /**
   * ⭐ NUEVO: Endpoint para recibir datos del sensor MAX30102 (cada 5 segundos)
   * El ESP32 envía datos periódicos de ritmo cardíaco
   * No requiere autenticación ya que es llamado por el dispositivo
   */
  @Post('esp32/sensor-data/max')
  handleEsp32MaxData(@Body() dto: Esp32MaxDataDto) {
    console.log('[CONTROLLER] Datos MAX30102 recibidos');
    return this.deviceService.handleEsp32MaxData(dto);
  }

  /**
   * ⭐ NUEVO: Endpoint para recibir alertas del sensor MPU6050 (solo cuando detecta desmayo)
   * El ESP32 envía esta alerta solo cuando confirma un desmayo
   * No requiere autenticación ya que es llamado por el dispositivo
   */
  @Post('esp32/sensor-data/mpu-alert')
  handleEsp32MpuAlert(@Body() dto: Esp32MpuAlertDto) {
    console.log('[CONTROLLER] ⚠️ Alerta MPU6050 recibida');
    return this.deviceService.handleEsp32MpuAlert(dto);
  }

  /**
   * Endpoint para recibir alertas de botón de pánico del ESP32
   * El ESP32 envía esta alerta cuando el usuario presiona el botón de emergencia
   * No requiere autenticación ya que es llamado por el dispositivo
   */
  @Post('esp32/sensor-data/button-alert')
  handleEsp32ButtonAlert(@Body() dto: Esp32ButtonAlertDto) {
    console.log('[CONTROLLER] ⚠️ Alerta de botón de pánico recibida');
    return this.deviceService.handleEsp32ButtonAlert(dto);
  }

  /**
   * SSE endpoint para que el frontend escuche eventos de conexión de dispositivos
   * Requiere autenticación y solo envía eventos del usuario autenticado
   * El token JWT se pasa como query parameter: ?token=xxx
   */
  @UseGuards(SseJwtAuthGuard)
  @Sse('events/connection')
  deviceConnectionEvents(@Req() req: any): Observable<MessageEvent> {
    const userId = req.user.id_usuario;
    console.log(`[SSE] Usuario ${userId} conectado a eventos de dispositivo`);

    return this.deviceEventsService.deviceConnection$.pipe(
      filter(event => event.userId === userId),
      map(event => ({
        data: event,
      } as MessageEvent))
    );
  }

  /**
   * SSE endpoint para que el frontend escuche eventos de notificaciones
   * Requiere autenticación y solo envía eventos del usuario autenticado
   */
  @UseGuards(SseJwtAuthGuard)
  @Sse('events/notifications')
  notificationEvents(@Req() req: any): Observable<MessageEvent> {
    const userId = req.user.id_usuario;
    console.log(`[SSE] Usuario ${userId} conectado a eventos de notificaciones`);

    return this.deviceEventsService.notification$.pipe(
      filter(event => event.userId === userId),
      map(event => ({
        data: event,
      } as MessageEvent))
    );
  }

  /**
   * Endpoint de debug para verificar los dispositivos conectados en memoria
   */
  @Get('debug/connected-devices')
  getConnectedDevices() {
    return this.deviceService.getConnectedDevicesDebug();
  }
}
