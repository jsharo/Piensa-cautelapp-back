import { Controller, Post, Body, Get, Param, Req, UseGuards } from '@nestjs/common';
import { SharedGroupService } from './shared-group.service';

@Controller('shared-group')
export class SharedGroupController {
  constructor(private readonly sharedGroupService: SharedGroupService) {}

  @Post('create')
  async createGroup(@Body('userId') userId: number, @Body('name') name?: string) {
    return this.sharedGroupService.createGroup(userId, name);
  }

  @Post('join')
  async joinGroup(@Body('userId') userId: number, @Body('code') code: string) {
    return this.sharedGroupService.joinGroupByCode(userId, code);
  }

  @Get('my/:userId')
  async getMyGroups(@Param('userId') userId: number) {
    return this.sharedGroupService.getGroupByUser(userId);
  }

  @Get('code/:code')
  async getGroupByCode(@Param('code') code: string) {
    return this.sharedGroupService.getGroupByCode(code);
  }

  @Post('leave')
  async leaveGroup(@Body('userId') userId: number, @Body('groupId') groupId: number) {
    return this.sharedGroupService.leaveGroup(userId, groupId);
  }

  // ========== ENDPOINTS PARA DISPOSITIVOS COMPARTIDOS ==========

  @Post('share-device')
  async shareDevice(
    @Body('groupId') groupId: number,
    @Body('adultoId') adultoId: number,
    @Body('userId') userId: number
  ) {
    return this.sharedGroupService.shareDeviceWithGroup(groupId, adultoId, userId);
  }

  @Post('unshare-device')
  async unshareDevice(
    @Body('groupId') groupId: number,
    @Body('adultoId') adultoId: number,
    @Body('userId') userId: number
  ) {
    return this.sharedGroupService.unshareDeviceFromGroup(groupId, adultoId, userId);
  }

  @Get('devices/:groupId')
  async getGroupDevices(@Param('groupId') groupId: number) {
    return this.sharedGroupService.getSharedDevicesInGroup(groupId);
  }

  @Get('my-shared-devices/:userId')
  async getMySharedDevices(@Param('userId') userId: number) {
    return this.sharedGroupService.getMySharedDevices(userId);
  }

  // ========== GESTIÓN DE MIEMBROS ==========

  @Post('remove-member')
  async removeMember(
    @Body('requesterId') requesterId: number,
    @Body('groupId') groupId: number,
    @Body('memberIdToRemove') memberIdToRemove: number
  ) {
    return this.sharedGroupService.removeMember(requesterId, groupId, memberIdToRemove);
  }

  @Get('members/:groupId')
  async getGroupMembers(@Param('groupId') groupId: number) {
    return this.sharedGroupService.getGroupMembers(groupId);
  }
}
