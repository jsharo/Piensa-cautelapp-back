"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharedGroupController = void 0;
const common_1 = require("@nestjs/common");
const shared_group_service_1 = require("./shared-group.service");
let SharedGroupController = class SharedGroupController {
    sharedGroupService;
    constructor(sharedGroupService) {
        this.sharedGroupService = sharedGroupService;
    }
    async createGroup(userId, name) {
        return this.sharedGroupService.createGroup(userId, name);
    }
    async joinGroup(userId, code) {
        try {
            const userIdNum = parseInt(userId, 10);
            if (isNaN(userIdNum)) {
                throw new Error('ID de usuario inválido');
            }
            console.log(`[SharedGroupController] Usuario ${userIdNum} intentando unirse con código: ${code}`);
            return await this.sharedGroupService.joinGroupByCode(userIdNum, code);
        }
        catch (error) {
            console.error('[SharedGroupController] Error al unirse al grupo:', error.message);
            throw error;
        }
    }
    async getMyGroups(userId) {
        return this.sharedGroupService.getGroupByUser(userId);
    }
    async getGroupByCode(code) {
        return this.sharedGroupService.getGroupByCode(code);
    }
    async leaveGroup(userId, groupId) {
        return this.sharedGroupService.leaveGroup(userId, groupId);
    }
    async shareDevice(groupId, adultoId, userId) {
        return this.sharedGroupService.shareDeviceWithGroup(groupId, adultoId, userId);
    }
    async unshareDevice(groupId, adultoId, userId) {
        return this.sharedGroupService.unshareDeviceFromGroup(groupId, adultoId, userId);
    }
    async getGroupDevices(groupId) {
        return this.sharedGroupService.getSharedDevicesInGroup(groupId);
    }
    async getMySharedDevices(userId) {
        return this.sharedGroupService.getMySharedDevices(userId);
    }
    async removeMember(requesterId, groupId, memberIdToRemove) {
        return this.sharedGroupService.removeMember(requesterId, groupId, memberIdToRemove);
    }
    async getGroupMembers(groupId) {
        return this.sharedGroupService.getGroupMembers(groupId);
    }
};
exports.SharedGroupController = SharedGroupController;
__decorate([
    (0, common_1.Post)('create'),
    __param(0, (0, common_1.Body)('userId')),
    __param(1, (0, common_1.Body)('name')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], SharedGroupController.prototype, "createGroup", null);
__decorate([
    (0, common_1.Post)('join'),
    __param(0, (0, common_1.Body)('userId')),
    __param(1, (0, common_1.Body)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], SharedGroupController.prototype, "joinGroup", null);
__decorate([
    (0, common_1.Get)('my/:userId'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], SharedGroupController.prototype, "getMyGroups", null);
__decorate([
    (0, common_1.Get)('code/:code'),
    __param(0, (0, common_1.Param)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SharedGroupController.prototype, "getGroupByCode", null);
__decorate([
    (0, common_1.Post)('leave'),
    __param(0, (0, common_1.Body)('userId')),
    __param(1, (0, common_1.Body)('groupId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", Promise)
], SharedGroupController.prototype, "leaveGroup", null);
__decorate([
    (0, common_1.Post)('share-device'),
    __param(0, (0, common_1.Body)('groupId')),
    __param(1, (0, common_1.Body)('adultoId')),
    __param(2, (0, common_1.Body)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, Number]),
    __metadata("design:returntype", Promise)
], SharedGroupController.prototype, "shareDevice", null);
__decorate([
    (0, common_1.Post)('unshare-device'),
    __param(0, (0, common_1.Body)('groupId')),
    __param(1, (0, common_1.Body)('adultoId')),
    __param(2, (0, common_1.Body)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, Number]),
    __metadata("design:returntype", Promise)
], SharedGroupController.prototype, "unshareDevice", null);
__decorate([
    (0, common_1.Get)('devices/:groupId'),
    __param(0, (0, common_1.Param)('groupId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], SharedGroupController.prototype, "getGroupDevices", null);
__decorate([
    (0, common_1.Get)('my-shared-devices/:userId'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], SharedGroupController.prototype, "getMySharedDevices", null);
__decorate([
    (0, common_1.Post)('remove-member'),
    __param(0, (0, common_1.Body)('requesterId')),
    __param(1, (0, common_1.Body)('groupId')),
    __param(2, (0, common_1.Body)('memberIdToRemove')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, Number]),
    __metadata("design:returntype", Promise)
], SharedGroupController.prototype, "removeMember", null);
__decorate([
    (0, common_1.Get)('members/:groupId'),
    __param(0, (0, common_1.Param)('groupId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], SharedGroupController.prototype, "getGroupMembers", null);
exports.SharedGroupController = SharedGroupController = __decorate([
    (0, common_1.Controller)('shared-group'),
    __metadata("design:paramtypes", [shared_group_service_1.SharedGroupService])
], SharedGroupController);
//# sourceMappingURL=shared-group.controller.js.map