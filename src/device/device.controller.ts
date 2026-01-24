import { Controller, Get, Post, Body, Patch, Param, Delete, Req, UseGuards, Sse, MessageEvent, Query } from '@nestjs/common';
import { DeviceService } from './device.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { VincularDispositivoDto } from './dto/vincular-dispositivo.dto';
import { UpdateAdultoMayorDto } from './dto/update-adulto-mayor.dto';
import { Esp32ConnectionDto } from './dto/esp32-connection.dto';
import { Esp32SensorDataDto } from './dto/esp32-sensor-data.dto';
import { Esp32MaxDataDto } from './dto/esp32-max-data.dto';
import { Esp32MpuAlertDto } from './dto/esp32-mpu-alert.dto';
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

  @Post()
  create(@Body() createDeviceDto: CreateDeviceDto) {
    return this.deviceService.create(createDeviceDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('vincular')
  vincularDispositivo(@Req() req: any, @Body() dto: VincularDispositivoDto) {
    const userId = req.user.id_usuario;
    return this.deviceService.vincularDispositivoAUsuario(userId, dto);
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
    return this.deviceService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDeviceDto: UpdateDeviceDto) {
    return this.deviceService.update(+id, updateDeviceDto);
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
   * Endpoint para recibir datos de sensores del ESP32
   * No requiere autenticación ya que es llamado por el dispositivo
   * Recibe datos de: MPU6050 (aceleración, detección de caídas) y MAX30102 (ritmo cardíaco)
   * 
   * ⚠️ DEPRECADO: Este endpoint se mantiene para compatibilidad con código antiguo
   * Usar en su lugar: /esp32/sensor-data/max o /esp32/sensor-data/mpu-alert
   */
  @Post('esp32/sensor-data')
  handleEsp32SensorData(@Body() dto: Esp32SensorDataDto) {
    return this.deviceService.handleEsp32SensorData(dto);
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
   * Obtiene el último BPM registrado de un dispositivo
   * Usado por el frontend para mostrar el pulso actual en tiempo real
   */
  @UseGuards(JwtAuthGuard)
  @Get('latest-bpm/:deviceId')
  async getLatestBpm(@Param('deviceId') deviceId: string) {
    const id = parseInt(deviceId);
    return this.deviceService.getLatestBpm(id);
  }

  /**
   * Endpoint de debug para verificar los últimos datos recibidos del ESP32
   * Muestra los últimos 10 registros de sensor data
   */
  @Get('debug/latest-sensor-data')
  async getLatestSensorData() {
    return this.deviceService.getLatestSensorDataForDebug();
  }

  /**
   * Endpoint de debug para verificar los dispositivos conectados en memoria
   */
  @Get('debug/connected-devices')
  getConnectedDevices() {
    return this.deviceService.getConnectedDevicesDebug();
  }
}
