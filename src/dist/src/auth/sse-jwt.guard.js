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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SseJwtAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const jwt_1 = require("@nestjs/jwt");
let SseJwtAuthGuard = class SseJwtAuthGuard extends (0, passport_1.AuthGuard)('jwt') {
    jwtService;
    constructor(jwtService) {
        super();
        this.jwtService = jwtService;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const tokenFromQuery = request.query?.token;
        if (tokenFromQuery) {
            try {
                const payload = this.jwtService.verify(tokenFromQuery, {
                    secret: process.env.JWT_SECRET || 'change-me',
                });
                request.user = {
                    id_usuario: payload.id_usuario || payload.sub,
                    email: payload.email,
                    role: payload.role,
                };
                return true;
            }
            catch (error) {
                console.error('[SseJwtAuthGuard] Error verificando token:', error.message);
                return false;
            }
        }
        return super.canActivate(context);
    }
};
exports.SseJwtAuthGuard = SseJwtAuthGuard;
exports.SseJwtAuthGuard = SseJwtAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService])
], SseJwtAuthGuard);
//# sourceMappingURL=sse-jwt.guard.js.map