"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharedGroupModule = void 0;
const common_1 = require("@nestjs/common");
const shared_group_service_1 = require("./shared-group.service");
const shared_group_controller_1 = require("./shared-group.controller");
const prisma_service_1 = require("../prisma/prisma.service");
let SharedGroupModule = class SharedGroupModule {
};
exports.SharedGroupModule = SharedGroupModule;
exports.SharedGroupModule = SharedGroupModule = __decorate([
    (0, common_1.Module)({
        controllers: [shared_group_controller_1.SharedGroupController],
        providers: [shared_group_service_1.SharedGroupService, prisma_service_1.PrismaService],
        exports: [shared_group_service_1.SharedGroupService],
    })
], SharedGroupModule);
//# sourceMappingURL=shared-group.module.js.map