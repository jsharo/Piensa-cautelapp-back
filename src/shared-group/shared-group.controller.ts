import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { SharedGroupService } from './shared-group.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

type AuthRequest = { user?: { id_usuario?: number } };

function requireSelf(req: AuthRequest, rawId: unknown): number {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0 || req.user?.id_usuario !== id) {
    throw new ForbiddenException('No tienes permiso para realizar esta acción');
  }
  return id;
}

function requireUser(req: AuthRequest): number {
  const id = req.user?.id_usuario;
  if (!Number.isInteger(id) || !id || id <= 0) {
    throw new ForbiddenException('No tienes permiso para realizar esta acción');
  }
  return id;
}

@Controller('shared-group')
@UseGuards(JwtAuthGuard)
export class SharedGroupController {
  constructor(private readonly sharedGroupService: SharedGroupService) {}

  @Post('create')
  async createGroup(
    @Req() req: AuthRequest,
    @Body('userId') userId: number,
    @Body('name') name?: string,
  ) {
    return this.sharedGroupService.createGroup(requireSelf(req, userId), name);
  }

  @Post('join')
  async joinGroup(
    @Req() req: AuthRequest,
    @Body('userId') userId: string,
    @Body('code') code: string,
  ) {
    const userIdNum = requireSelf(req, userId);
    if (typeof code !== 'string' || code.trim().length === 0) {
      throw new BadRequestException('Código de grupo inválido');
    }
    return this.sharedGroupService.joinGroupByCode(userIdNum, code);
  }

  @Get('my/:userId')
  async getMyGroups(@Req() req: AuthRequest, @Param('userId') userId: string) {
    return this.sharedGroupService.getGroupByUser(requireSelf(req, userId));
  }

  @Get('code/:code')
  async getGroupByCode(@Param('code') code: string) {
    return this.sharedGroupService.getGroupByCode(code);
  }

  @Post('leave')
  async leaveGroup(
    @Req() req: AuthRequest,
    @Body('userId') userId: number,
    @Body('groupId') groupId: number,
  ) {
    return this.sharedGroupService.leaveGroup(requireSelf(req, userId), groupId);
  }

  @Post('share-device')
  async shareDevice(
    @Req() req: AuthRequest,
    @Body('groupId') groupId: number,
    @Body('adultoId') adultoId: number,
    @Body('userId') userId: number,
  ) {
    return this.sharedGroupService.shareDeviceWithGroup(groupId, adultoId, requireSelf(req, userId));
  }

  @Post('unshare-device')
  async unshareDevice(
    @Req() req: AuthRequest,
    @Body('groupId') groupId: number,
    @Body('adultoId') adultoId: number,
    @Body('userId') userId: number,
  ) {
    return this.sharedGroupService.unshareDeviceFromGroup(groupId, adultoId, requireSelf(req, userId));
  }

  @Get('devices/:groupId')
  async getGroupDevices(@Req() req: AuthRequest, @Param('groupId') groupId: string) {
    return this.sharedGroupService.getSharedDevicesInGroup(this.parseGroupId(groupId), requireUser(req));
  }

  @Get('my-shared-devices/:userId')
  async getMySharedDevices(@Req() req: AuthRequest, @Param('userId') userId: string) {
    return this.sharedGroupService.getMySharedDevices(requireSelf(req, userId));
  }

  @Post('remove-member')
  async removeMember(
    @Req() req: AuthRequest,
    @Body('requesterId') requesterId: number,
    @Body('groupId') groupId: number,
    @Body('memberIdToRemove') memberIdToRemove: number,
  ) {
    return this.sharedGroupService.removeMember(requireSelf(req, requesterId), groupId, memberIdToRemove);
  }

  @Get('members/:groupId')
  async getGroupMembers(@Req() req: AuthRequest, @Param('groupId') groupId: string) {
    return this.sharedGroupService.getGroupMembers(this.parseGroupId(groupId), requireUser(req));
  }

  private parseGroupId(groupId: string): number {
    const id = Number(groupId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('Identificador de grupo inválido');
    }
    return id;
  }
}
