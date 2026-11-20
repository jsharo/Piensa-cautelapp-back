import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Request() req: { user?: { id_usuario?: number } }) {
    const callerId = req.user?.id_usuario;
    if (!Number.isInteger(callerId)) {
      throw new ForbiddenException('No tienes permiso para ver estos perfiles');
    }
    return this.userService.findAll(callerId as number);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Request() req: { user?: { id_usuario?: number } }, @Param('id') id: string) {
    const paramId = Number(id);
    if (!Number.isInteger(paramId) || paramId <= 0) {
      throw new BadRequestException('Identificador de usuario inválido');
    }
    if (req.user?.id_usuario !== paramId) {
      throw new ForbiddenException('No tienes permiso para ver este perfil');
    }
    return this.userService.findOne(paramId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const userId = req.user?.id_usuario;
    const paramId = Number(id);
    if (!Number.isInteger(paramId) || paramId <= 0) {
      throw new BadRequestException('Identificador de usuario inválido');
    }
    if (userId !== paramId) {
      throw new ForbiddenException(
        'No tienes permiso para actualizar este perfil',
      );
    }

    return this.userService.update(paramId, updateUserDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Request() req: { user?: { id_usuario?: number } }, @Param('id') id: string) {
    const userId = req.user?.id_usuario;
    const paramId = Number(id);
    if (!Number.isInteger(paramId) || paramId <= 0) {
      throw new BadRequestException('Identificador de usuario inválido');
    }
    if (userId !== paramId) {
      throw new ForbiddenException('No tienes permiso para eliminar este perfil');
    }
    return this.userService.remove(paramId);
  }

  // Endpoints para manejar tokens FCM
  @Post('fcm-token')
  @UseGuards(JwtAuthGuard)
  async saveFcmToken(
    @Request() req: { user?: { id_usuario?: number } },
    @Body() data: { userId: number; fcmToken: string; platform?: string },
  ) {
    const ownerId = Number(data.userId);
    if (!Number.isInteger(ownerId) || req.user?.id_usuario !== ownerId) {
      throw new ForbiddenException('No tienes permiso para guardar este token');
    }
    if (typeof data.fcmToken !== 'string') {
      throw new BadRequestException('Token de notificaciones inválido');
    }
    await this.userService.saveFcmToken(ownerId, data.fcmToken);
    return { message: 'Token FCM guardado exitosamente' };
  }

  @Delete('fcm-token/:userId')
  @UseGuards(JwtAuthGuard)
  async deleteFcmToken(
    @Request() req: { user?: { id_usuario?: number } },
    @Param('userId') userId: string,
  ) {
    const ownerId = Number(userId);
    if (!Number.isInteger(ownerId) || req.user?.id_usuario !== ownerId) {
      throw new ForbiddenException('No tienes permiso para eliminar este token');
    }
    await this.userService.deleteFcmToken(ownerId);
    return { message: 'Token FCM eliminado exitosamente' };
  }
}

