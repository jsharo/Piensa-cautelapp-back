import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const userId = req.user?.id_usuario;
    const paramId = +id;

    // Validar que el usuario autenticado sea el propietario del perfil
    if (userId !== paramId) {
      throw new ForbiddenException(
        'No tienes permiso para actualizar este perfil',
      );
    }

    return this.userService.update(paramId, updateUserDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.userService.remove(+id);
  }

  // Endpoints para manejar tokens FCM
  @Post('fcm-token')
  @UseGuards(JwtAuthGuard)
  async saveFcmToken(
    @Body() data: { userId: number; fcmToken: string; platform?: string },
  ) {
    await this.userService.saveFcmToken(data.userId, data.fcmToken);
    return { message: 'Token FCM guardado exitosamente' };
  }

  @Delete('fcm-token/:userId')
  @UseGuards(JwtAuthGuard)
  async deleteFcmToken(@Param('userId') userId: string) {
    await this.userService.deleteFcmToken(+userId);
    return { message: 'Token FCM eliminado exitosamente' };
  }
}

