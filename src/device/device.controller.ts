import { Controller, Get, Post, Body, Patch, Param, Delete, Req, UseGuards } from '@nestjs/common';
import { DeviceService } from './device.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { VincularDispositivoDto } from './dto/vincular-dispositivo.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('device')
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

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

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.deviceService.remove(+id);
  }
}
