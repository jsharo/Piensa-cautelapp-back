import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DeviceService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateDeviceDto) {
    if (dto.mac_address) {
      const exists = await this.prisma.dispositivo.findUnique({ where: { mac_address: dto.mac_address } });
      if (exists) throw new ConflictException('mac_address ya registrado');
    }
    const device = await this.prisma.dispositivo.create({
      data: {
        bateria: dto.bateria ?? 100,
        mac_address: dto.mac_address,
      },
    });
    return device;
  }

  async findAll() {
    return this.prisma.dispositivo.findMany();
  }

  async findOne(id: number) {
    const device = await this.prisma.dispositivo.findUnique({ where: { id_dispositivo: id } });
    if (!device) throw new NotFoundException('Dispositivo no encontrado');
    return device;
  }

  async update(id: number, dto: UpdateDeviceDto) {
    if (dto.mac_address) {
      const exists = await this.prisma.dispositivo.findUnique({ where: { mac_address: dto.mac_address } });
      if (exists && exists.id_dispositivo !== id) throw new ConflictException('mac_address ya registrado en otro dispositivo');
    }
    const device = await this.prisma.dispositivo.update({
      where: { id_dispositivo: id },
      data: dto,
    });
    return device;
  }

  async remove(id: number) {
    await this.prisma.dispositivo.delete({ where: { id_dispositivo: id } });
    return { success: true };
  }
}
