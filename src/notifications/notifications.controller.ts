import { Controller, Get, Post, Body, Patch, Param, Delete, Logger, HttpCode, HttpStatus } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { ESP32WebhookDto } from './dto/esp32-webhook.dto';

@Controller('notifications')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  create(@Body() createNotificationDto: CreateNotificationDto) {
    return this.notificationsService.create(createNotificationDto);
  }

  // Webhook para ESP32 (caída confirmada)
  @Post('webhook/esp32')
  @HttpCode(HttpStatus.OK)
  receiveESP32(@Body() dto: ESP32WebhookDto) {
    // Logs visibles en la terminal para confirmar recepción
    console.log('\n' + '='.repeat(60));
    console.log('📥 Webhook ESP32 recibido');
    console.log('⏰', new Date().toLocaleString());
    console.log('� Device ID:', dto.deviceId);
    console.log('🔔 Tipo:', dto.tipo ?? dto.tipo_alerta);
    if (dto.ubicacion) console.log('📍 Ubicación:', dto.ubicacion);
    if (dto.mensaje || dto.mensaje_adicional) console.log('💬 Mensaje:', dto.mensaje ?? dto.mensaje_adicional);
    console.log('='.repeat(60));

    return this.notificationsService.processESP32Webhook(dto);
  }

  @Get()
  findAll() {
    return this.notificationsService.findAll();
  }

  @Get('user/:userId')
  findByUser(@Param('userId') userId: string) {
    return this.notificationsService.findByUser(+userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.notificationsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateNotificationDto: UpdateNotificationDto) {
    return this.notificationsService.update(+id, updateNotificationDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.notificationsService.remove(+id);
  }
}
