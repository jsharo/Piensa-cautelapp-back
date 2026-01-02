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
}
