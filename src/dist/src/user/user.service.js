"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const bcrypt = __importStar(require("bcrypt"));
let UserService = class UserService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(dto) {
        const exists = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
        if (exists)
            throw new common_1.ConflictException('Email ya registrado');
        const hash = await bcrypt.hash(dto.contrasena, 10);
        const defaultRole = await this.ensureDefaultRole();
        const user = await this.prisma.usuario.create({
            data: {
                nombre: dto.nombre,
                email: dto.email,
                contrasena: hash,
                id_rol: defaultRole.id_rol,
            },
            include: { rol: true },
        });
        const { contrasena, ...rest } = user;
        return rest;
    }
    async findAll() {
        const users = await this.prisma.usuario.findMany({ include: { rol: true } });
        return users.map(({ contrasena, ...rest }) => rest);
    }
    async findOne(id) {
        const user = await this.prisma.usuario.findUnique({ where: { id_usuario: id }, include: { rol: true } });
        if (!user)
            throw new common_1.NotFoundException('Usuario no encontrado');
        const { contrasena, ...rest } = user;
        return rest;
    }
    async update(id, dto) {
        const data = {};
        if (dto.nombre !== undefined) {
            data.nombre = dto.nombre;
        }
        if (dto.imagen !== undefined) {
            data.imagen = dto.imagen;
        }
        if (dto.contrasena !== undefined) {
            data.contrasena = await bcrypt.hash(dto.contrasena, 10);
        }
        if (dto.email !== undefined) {
            const emailExists = await this.prisma.usuario.findUnique({
                where: { email: dto.email }
            });
            if (emailExists && emailExists.id_usuario !== id) {
                throw new common_1.ConflictException('Este correo electrónico ya está en uso');
            }
            data.email = dto.email;
        }
        if (dto.email_recuperacion !== undefined) {
            if (dto.email_recuperacion) {
                const emailRecExists = await this.prisma.usuario.findUnique({
                    where: { email_recuperacion: dto.email_recuperacion }
                });
                if (emailRecExists && emailRecExists.id_usuario !== id) {
                    throw new common_1.ConflictException('Este correo de recuperación ya está en uso');
                }
            }
            data.email_recuperacion = dto.email_recuperacion;
        }
        const user = await this.prisma.usuario.update({ where: { id_usuario: id }, data, include: { rol: true } });
        const { contrasena, ...rest } = user;
        return rest;
    }
    async remove(id) {
        await this.prisma.usuario.delete({ where: { id_usuario: id } });
        return { success: true };
    }
    async saveFcmToken(userId, fcmToken) {
        await this.prisma.usuario.update({
            where: { id_usuario: userId },
            data: { fcm_token: fcmToken },
        });
    }
    async deleteFcmToken(userId) {
        await this.prisma.usuario.update({
            where: { id_usuario: userId },
            data: { fcm_token: null },
        });
    }
    async getUsersByFcmToken() {
        return this.prisma.usuario.findMany({
            where: {
                fcm_token: {
                    not: null,
                },
            },
            select: {
                id_usuario: true,
                nombre: true,
                email: true,
                fcm_token: true,
            },
        });
    }
    async ensureDefaultRole() {
        return this.prisma.roles.upsert({ where: { id_rol: 1 }, update: {}, create: { nombre_rol: 'cuidador' } });
    }
};
exports.UserService = UserService;
exports.UserService = UserService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UserService);
//# sourceMappingURL=user.service.js.map