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
exports.DeviceService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const device_events_service_1 = require("./device-events.service");
const firebase_service_1 = require("../firebase/firebase.service");
let DeviceService = class DeviceService {
    prisma;
    deviceEventsService;
    firebaseService;
    connectedDevices = new Map();
    deviceHeartbeats = new Map();
    DISCONNECT_TIMEOUT_MS = 10000;
    constructor(prisma, deviceEventsService, firebaseService) {
        this.prisma = prisma;
        this.deviceEventsService = deviceEventsService;
        this.firebaseService = firebaseService;
        console.log('[DeviceService] 🔍 Sistema de monitoreo de heartbeat iniciado');
    }
    async sendNotificationToUser(userId, notificationData) {
        this.deviceEventsService.emitNotification({
            ...notificationData,
            userId: userId,
        });
        try {
            const user = await this.prisma.usuario.findUnique({
                where: { id_usuario: userId },
                select: { fcm_token: true, nombre: true }
            });
            if (user && user.fcm_token) {
                let title = '📢 Notificación';
                if (notificationData.tipo === 'PANICO') {
                    title = '⚠️ BOTÓN DE PÁNICO';
                }
                else if (notificationData.tipo === 'EMERGENCIA') {
                    title = '🚨 EMERGENCIA';
                }
                else if (notificationData.tipo === 'AYUDA') {
                    title = '⚠️ SOLICITUD DE AYUDA';
                }
                await this.firebaseService.sendNotification(user.fcm_token, title, notificationData.mensaje, {
                    tipo: notificationData.tipo.toLowerCase(),
                    notificationId: notificationData.id_notificacion.toString(),
                    usuario: notificationData.usuario,
                    timestamp: notificationData.fecha_hora,
                    pulso: notificationData.pulso?.toString() || '',
                });
                console.log(`[FCM] ✅ Notificación enviada a ${user.nombre} (User ID: ${userId})`);
            }
        }
        catch (error) {
            console.error(`[FCM] ❌ Error enviando notificación FCM al usuario ${userId}:`, error.message);
        }
    }
    updateDeviceHeartbeat(deviceId) {
        const existing = this.deviceHeartbeats.get(deviceId);
        if (existing?.timeoutId) {
            clearTimeout(existing.timeoutId);
        }
        const timeoutId = setTimeout(async () => {
            console.log(`[HEARTBEAT] ⏰ Timeout: ${deviceId} sin datos por ${this.DISCONNECT_TIMEOUT_MS}ms`);
            await this.handleDeviceTimeout(deviceId);
        }, this.DISCONNECT_TIMEOUT_MS);
        this.deviceHeartbeats.set(deviceId, {
            lastSeen: new Date(),
            deviceId,
            timeoutId
        });
    }
    async handleDeviceTimeout(deviceId) {
        console.log(`[HEARTBEAT] 🔴 Dispositivo ${deviceId} considerado DESCONECTADO`);
        try {
            const dispositivo = await this.prisma.dispositivo.findUnique({
                where: { id_dispositivo: deviceId },
                include: {
                    adultos: {
                        include: {
                            usuariosAdultoMayor: {
                                select: { id_usuario: true }
                            },
                            sharedInGroups: {
                                include: {
                                    group: {
                                        include: {
                                            members: {
                                                select: { user_id: true }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });
            if (!dispositivo) {
                console.log(`[HEARTBEAT] ⚠️ Dispositivo ${deviceId} no encontrado en BD`);
                this.deviceHeartbeats.delete(deviceId);
                return;
            }
            await this.prisma.dispositivo.update({
                where: { id_dispositivo: dispositivo.id_dispositivo },
                data: {
                    online_status: false,
                    last_seen: new Date()
                }
            });
            const userIds = new Set();
            dispositivo.adultos.forEach(adulto => {
                adulto.usuariosAdultoMayor.forEach(rel => {
                    userIds.add(rel.id_usuario);
                });
                adulto.sharedInGroups?.forEach(shared => {
                    shared.group.members.forEach(member => {
                        userIds.add(member.user_id);
                    });
                });
            });
            if (userIds.size > 0) {
                this.deviceEventsService.emitDeviceDisconnection(deviceId, Array.from(userIds));
                console.log(`[HEARTBEAT] 📤 Notificación de desconexión enviada a ${userIds.size} usuario(s)`);
            }
            this.deviceHeartbeats.delete(deviceId);
        }
        catch (error) {
            console.error(`[HEARTBEAT] ✗ Error manejando timeout de ${deviceId}:`, error);
        }
    }
    async create(dto) {
        const exists = await this.prisma.dispositivo.findUnique({ where: { id_dispositivo: dto.id_dispositivo } });
        if (exists)
            throw new common_1.ConflictException('Dispositivo con ese ID ya está registrado');
        const device = await this.prisma.dispositivo.create({
            data: {
                id_dispositivo: dto.id_dispositivo,
            },
        });
        return device;
    }
    async findAll() {
        return this.prisma.dispositivo.findMany();
    }
    async findOne(id) {
        const device = await this.prisma.dispositivo.findUnique({ where: { id_dispositivo: id } });
        if (!device)
            throw new common_1.NotFoundException('Dispositivo no encontrado');
        return device;
    }
    async update(id, dto) {
        const device = await this.prisma.dispositivo.update({
            where: { id_dispositivo: id },
            data: dto,
        });
        return device;
    }
    async remove(id) {
        try {
            const adultosMayores = await this.prisma.adultoMayor.findMany({
                where: { id_dispositivo: id },
                select: { id_adulto: true }
            });
            if (adultosMayores.length > 0) {
                const adultoIds = adultosMayores.map(a => a.id_adulto);
                await this.prisma.usuarioAdultoMayor.deleteMany({
                    where: { id_adulto: { in: adultoIds } }
                });
            }
            await this.prisma.adultoMayor.deleteMany({
                where: { id_dispositivo: id }
            });
            await this.prisma.dispositivo.delete({ where: { id_dispositivo: id } });
            return { success: true };
        }
        catch (error) {
            if (error.code === 'P2025') {
                throw new common_1.NotFoundException('Dispositivo no encontrado');
            }
            if (error.code === 'P2003') {
                throw new common_1.ConflictException('No se puede eliminar el dispositivo porque está vinculado a otros registros.');
            }
            throw error;
        }
    }
    async stopMonitoringDevice(userId, deviceId) {
        try {
            console.log(`[STOP_MONITORING] Iniciando eliminación para usuario ${userId}, adulto ${deviceId}`);
            const adultoMayor = await this.prisma.adultoMayor.findUnique({
                where: { id_adulto: deviceId },
                include: { dispositivo: true }
            });
            if (!adultoMayor) {
                console.error(`[STOP_MONITORING] AdultoMayor ${deviceId} no encontrado`);
                throw new common_1.NotFoundException('Dispositivo no encontrado');
            }
            console.log(`[STOP_MONITORING] AdultoMayor encontrado:`, {
                id_adulto: adultoMayor.id_adulto,
                nombre: adultoMayor.nombre,
                id_dispositivo: adultoMayor.id_dispositivo
            });
            const relacion = await this.prisma.usuarioAdultoMayor.findUnique({
                where: {
                    id_usuario_id_adulto: {
                        id_usuario: userId,
                        id_adulto: deviceId,
                    },
                },
            });
            if (!relacion) {
                console.error(`[STOP_MONITORING] Usuario ${userId} no tiene relación con adulto ${deviceId}`);
                throw new common_1.ForbiddenException('No tienes permiso para dejar de monitorear este dispositivo');
            }
            console.log(`[STOP_MONITORING] Relación usuario-adulto verificada. Eliminando...`);
            await this.prisma.usuarioAdultoMayor.delete({
                where: {
                    id_usuario_id_adulto: {
                        id_usuario: userId,
                        id_adulto: deviceId,
                    },
                },
            });
            console.log(`[STOP_MONITORING] ✓ Relación UsuarioAdultoMayor eliminada`);
            const otrasRelaciones = await this.prisma.usuarioAdultoMayor.findMany({
                where: { id_adulto: deviceId },
            });
            console.log(`[STOP_MONITORING] Otras relaciones del adulto: ${otrasRelaciones.length}`);
            if (otrasRelaciones.length === 0) {
                const dispositivo = adultoMayor.id_dispositivo;
                console.log(`[STOP_MONITORING] Sin otras relaciones, eliminando AdultoMayor...`);
                await this.prisma.adultoMayor.delete({
                    where: { id_adulto: deviceId },
                });
                console.log(`[STOP_MONITORING] ✓ AdultoMayor ${deviceId} eliminado`);
                if (dispositivo) {
                    console.log(`[STOP_MONITORING] Verificando si dispositivo ${dispositivo} tiene otros adultos...`);
                    const otrosAdultos = await this.prisma.adultoMayor.findMany({
                        where: { id_dispositivo: dispositivo },
                    });
                    console.log(`[STOP_MONITORING] Otros adultos en dispositivo: ${otrosAdultos.length}`);
                    if (otrosAdultos.length === 0) {
                        console.log(`[STOP_MONITORING] Eliminando Dispositivo ${dispositivo}...`);
                        await this.prisma.dispositivo.delete({
                            where: { id_dispositivo: dispositivo },
                        });
                        console.log(`[STOP_MONITORING] ✓ Dispositivo ${dispositivo} eliminado`);
                    }
                    else {
                        console.log(`[STOP_MONITORING] Dispositivo ${dispositivo} no eliminado (aún tiene adultos)`);
                    }
                }
            }
            else {
                console.log(`[STOP_MONITORING] Adulto ${deviceId} NO eliminado (otras relaciones existen)`);
            }
            console.log(`[STOP_MONITORING] ✓ Proceso completado exitosamente`);
            return { success: true, message: 'Dispositivo eliminado completamente' };
        }
        catch (error) {
            console.error(`[STOP_MONITORING] ✗ Error en eliminación:`, error);
            if (error.code === 'P2025') {
                throw new common_1.NotFoundException('Dispositivo o relación no encontrada');
            }
            if (error instanceof common_1.ForbiddenException || error instanceof common_1.NotFoundException) {
                throw error;
            }
            throw error;
        }
    }
    async vincularDispositivoAUsuario(userId, dto) {
        console.log('[vincularDispositivoAUsuario] Iniciando con userId:', userId, 'y dto:', JSON.stringify(dto, null, 2));
        console.log('[vincularDispositivoAUsuario] 🔍 VERIFICANDO DATOS RECIBIDOS:');
        console.log('[vincularDispositivoAUsuario]   - nombre_adulto:', dto.nombre_adulto, '(tipo:', typeof dto.nombre_adulto, ')');
        console.log('[vincularDispositivoAUsuario]   - fecha_nacimiento:', dto.fecha_nacimiento);
        console.log('[vincularDispositivoAUsuario]   - direccion:', dto.direccion);
        console.log('[vincularDispositivoAUsuario]   - id_dispositivo:', dto.id_dispositivo);
        const usuario = await this.prisma.usuario.findUnique({
            where: { id_usuario: userId },
        });
        if (!usuario) {
            console.error(`[vincularDispositivoAUsuario] ERROR: Usuario con ID ${userId} no existe`);
            throw new Error(`Usuario con ID ${userId} no existe en la base de datos. Verifica que el usuario esté correctamente autenticado.`);
        }
        console.log('[vincularDispositivoAUsuario] Usuario encontrado:', usuario.email);
        let dispositivo = await this.prisma.dispositivo.findUnique({
            where: { id_dispositivo: dto.id_dispositivo }
        });
        if (dispositivo) {
            console.log('[vincularDispositivoAUsuario] ✓ Dispositivo ya existe en BD:', {
                id_dispositivo: dispositivo.id_dispositivo,
            });
            console.log('[vincularDispositivoAUsuario] Actualizando dispositivo existente...');
            dispositivo = await this.prisma.dispositivo.update({
                where: { id_dispositivo: dispositivo.id_dispositivo },
                data: {
                    online_status: true,
                    last_seen: new Date(),
                },
            });
            console.log('[vincularDispositivoAUsuario] ✓ Dispositivo actualizado');
        }
        else {
            console.log('[vincularDispositivoAUsuario] ⭐ Dispositivo NO existe en BD. Creándolo ahora con datos del adulto mayor...');
            dispositivo = await this.prisma.dispositivo.create({
                data: {
                    id_dispositivo: dto.id_dispositivo,
                    online_status: true,
                    last_seen: new Date(),
                },
            });
            console.log('[vincularDispositivoAUsuario] ✅ Dispositivo creado en BD (ID:', dispositivo.id_dispositivo, ')');
        }
        const adultoExistente = await this.prisma.adultoMayor.findFirst({
            where: { id_dispositivo: dispositivo.id_dispositivo },
        });
        console.log('[vincularDispositivoAUsuario] Adulto existente para dispositivo:', adultoExistente ? `ID ${adultoExistente.id_adulto} - ${adultoExistente.nombre}` : 'No encontrado');
        let adultoMayor;
        if (adultoExistente) {
            console.log('[vincularDispositivoAUsuario] Actualizando adulto mayor existente con datos del modal...');
            adultoMayor = await this.prisma.adultoMayor.update({
                where: { id_adulto: adultoExistente.id_adulto },
                data: {
                    nombre: dto.nombre_adulto || adultoExistente.nombre,
                    fecha_nacimiento: dto.fecha_nacimiento
                        ? new Date(dto.fecha_nacimiento)
                        : adultoExistente.fecha_nacimiento,
                    direccion: dto.direccion || adultoExistente.direccion,
                },
            });
            console.log('[vincularDispositivoAUsuario] ✓ Adulto mayor actualizado:', adultoMayor.nombre);
        }
        else {
            console.log('[vincularDispositivoAUsuario] Creando nuevo adulto mayor...');
            console.log('[vincularDispositivoAUsuario] 📋 Datos del adulto a crear:', {
                nombre: dto.nombre_adulto || `Dispositivo ${dto.id_dispositivo}`,
                fecha_nacimiento: dto.fecha_nacimiento,
                direccion: dto.direccion || 'Ubicación no especificada',
                id_dispositivo: dispositivo.id_dispositivo
            });
            adultoMayor = await this.prisma.adultoMayor.create({
                data: {
                    nombre: dto.nombre_adulto || `Dispositivo ${dto.id_dispositivo}`,
                    fecha_nacimiento: dto.fecha_nacimiento
                        ? new Date(dto.fecha_nacimiento)
                        : new Date('1950-01-01'),
                    direccion: dto.direccion || 'Ubicación no especificada',
                    id_dispositivo: dispositivo.id_dispositivo,
                },
            });
            console.log('[vincularDispositivoAUsuario] ✅ Adulto mayor creado:', {
                id_adulto: adultoMayor.id_adulto,
                nombre: adultoMayor.nombre,
                id_dispositivo: adultoMayor.id_dispositivo
            });
        }
        console.log('[vincularDispositivoAUsuario] Verificando relación existente entre userId:', userId, 'y adultoId:', adultoMayor.id_adulto);
        const relacionExistente = await this.prisma.usuarioAdultoMayor.findUnique({
            where: {
                id_usuario_id_adulto: {
                    id_usuario: userId,
                    id_adulto: adultoMayor.id_adulto,
                },
            },
        });
        console.log('[vincularDispositivoAUsuario] ✅ VINCULACIÓN EXITOSA:', {
            dispositivo_id: dispositivo.id_dispositivo,
            adulto_id: adultoMayor.id_adulto,
            adulto_nombre: adultoMayor.nombre,
            adulto_id_dispositivo: adultoMayor.id_dispositivo,
            usuario_id: userId,
            relacion_creada: !relacionExistente
        });
        if (adultoMayor.id_dispositivo !== dispositivo.id_dispositivo) {
            console.error('[vincularDispositivoAUsuario] ⚠️ ERROR DE VINCULACIÓN: AdultoMayor NO está vinculado al dispositivo correcto!');
            console.error('[vincularDispositivoAUsuario] Esperado:', dispositivo.id_dispositivo, 'Actual:', adultoMayor.id_dispositivo);
        }
        else {
            console.log('[vincularDispositivoAUsuario] ✅ VERIFICACIÓN: AdultoMayor correctamente vinculado al Dispositivo', dispositivo.id_dispositivo);
        }
        if (!relacionExistente) {
            console.log('[vincularDispositivoAUsuario] Creando relación Usuario-AdultoMayor');
            try {
                await this.prisma.usuarioAdultoMayor.create({
                    data: {
                        id_usuario: userId,
                        id_adulto: adultoMayor.id_adulto,
                    },
                });
                console.log('[vincularDispositivoAUsuario] Relación creada exitosamente');
            }
            catch (error) {
                console.error('[vincularDispositivoAUsuario] Error al crear relación:', error);
                throw error;
            }
        }
        else {
            console.log('[vincularDispositivoAUsuario] Relación ya existe, no se crea nuevamente');
        }
        return {
            dispositivo,
            adultoMayor,
            mensaje: relacionExistente
                ? 'Dispositivo ya vinculado a tu cuenta'
                : 'Dispositivo vinculado exitosamente',
        };
    }
    async obtenerDispositivosDeUsuario(userId) {
        const relaciones = await this.prisma.usuarioAdultoMayor.findMany({
            where: { id_usuario: userId },
            include: {
                adulto: {
                    include: {
                        dispositivo: true,
                    },
                },
            },
        });
        return relaciones
            .filter(rel => rel.adulto.id_dispositivo !== null)
            .map(rel => ({
            id_adulto: rel.adulto.id_adulto,
            nombre: rel.adulto.nombre,
            fecha_nacimiento: rel.adulto.fecha_nacimiento,
            direccion: rel.adulto.direccion,
            dispositivo: rel.adulto.dispositivo,
        }));
    }
    async updateAdultoMayor(userId, adultoId, dto) {
        const relacion = await this.prisma.usuarioAdultoMayor.findUnique({
            where: {
                id_usuario_id_adulto: {
                    id_usuario: userId,
                    id_adulto: adultoId,
                },
            },
        });
        if (!relacion) {
            throw new common_1.ForbiddenException('No tienes permiso para editar este adulto mayor');
        }
        const adultoMayorActualizado = await this.prisma.adultoMayor.update({
            where: { id_adulto: adultoId },
            data: {
                ...(dto.nombre && { nombre: dto.nombre }),
                ...(dto.fecha_nacimiento && { fecha_nacimiento: new Date(dto.fecha_nacimiento) }),
                ...(dto.direccion && { direccion: dto.direccion }),
            },
            include: {
                dispositivo: true,
            },
        });
        return {
            id_adulto: adultoMayorActualizado.id_adulto,
            nombre: adultoMayorActualizado.nombre,
            fecha_nacimiento: adultoMayorActualizado.fecha_nacimiento,
            direccion: adultoMayorActualizado.direccion,
            dispositivo: adultoMayorActualizado.dispositivo,
        };
    }
    async handleEsp32Connection(dto) {
        console.log('[ESP32-CONN] Notificación de conexión recibida:', dto);
        try {
            this.updateDeviceHeartbeat(dto.deviceId);
            let dispositivoDbId;
            const dispositivoExistente = await this.prisma.dispositivo.findUnique({
                where: { id_dispositivo: dto.deviceId }
            });
            if (dispositivoExistente) {
                console.log(`[ESP32-CONN] Dispositivo ${dto.deviceId} ya existe en BD, actualizando estado WiFi...`);
                await this.prisma.dispositivo.update({
                    where: { id_dispositivo: dispositivoExistente.id_dispositivo },
                    data: {
                        online_status: true,
                        last_seen: new Date(),
                    },
                });
                console.log(`[ESP32-CONN] ✓ Dispositivo existente actualizado en BD`);
                dispositivoDbId = dispositivoExistente.id_dispositivo;
            }
            else {
                console.log(`[ESP32-CONN] Dispositivo ${dto.deviceId} NO existe en BD. Se creará al vincular con adulto mayor.`);
            }
            this.connectedDevices.set(dto.deviceId, {
                deviceId: dto.deviceId,
                ssid: dto.ssid,
                ip: dto.ip,
                rssi: dto.rssi,
                userId: dto.userId,
            });
            console.log(`[ESP32-CONN] ✓ Dispositivo ${dto.deviceId} registrado en memoria`);
            if (dto.userId) {
                console.log(`[ESP32-CONN] User ID asociado: ${dto.userId}`);
                this.deviceEventsService.emitDeviceConnection({
                    deviceId: dto.deviceId,
                    userId: parseInt(dto.userId),
                    ssid: dto.ssid,
                    ip: dto.ip,
                    rssi: dto.rssi || 0,
                    status: 'connected',
                });
                console.log(`[ESP32-CONN] ✓ Evento SSE emitido al usuario ${dto.userId}`);
            }
            console.log(`[ESP32-CONN] Total dispositivos en memoria: ${this.connectedDevices.size}`);
            return {
                success: true,
                message: dispositivoExistente
                    ? 'Conexión WiFi actualizada en BD y registrada en memoria'
                    : 'Conexión WiFi registrada en memoria (dispositivo se creará al vincular)',
                deviceId: dto.deviceId,
                dispositivoDbId: dispositivoDbId,
                inDatabase: !!dispositivoExistente,
                userId: dto.userId,
            };
        }
        catch (error) {
            console.error('[ESP32-CONN] ✗ Error al registrar conexión:', error);
            throw error;
        }
    }
    async checkDeviceExistsForUser(userId, deviceId) {
        console.log(`[checkDeviceExists] Usuario ${userId} verificando dispositivo ${deviceId}`);
        try {
            const dispositivo = await this.prisma.dispositivo.findUnique({
                where: { id_dispositivo: deviceId },
                include: {
                    adultos: {
                        include: {
                            usuariosAdultoMayor: {
                                where: {
                                    id_usuario: userId
                                }
                            }
                        }
                    }
                }
            });
            if (!dispositivo) {
                console.log(`[checkDeviceExists] Dispositivo ${deviceId} NO existe en BD`);
                return {
                    exists: false,
                    inDatabase: false,
                    vinculado: false,
                    message: 'Dispositivo no encontrado'
                };
            }
            const tieneAdultoMayorVinculado = dispositivo.adultos.some(adulto => adulto.usuariosAdultoMayor.length > 0);
            console.log(`[checkDeviceExists] Dispositivo ${deviceId}:`, {
                existe: true,
                id: dispositivo.id_dispositivo,
                tieneAdultoMayor: dispositivo.adultos.length > 0,
                vinculadoAlUsuario: tieneAdultoMayorVinculado
            });
            return {
                exists: true,
                inDatabase: true,
                vinculado: tieneAdultoMayorVinculado,
                dispositivoId: dispositivo.id_dispositivo,
                adultosMayores: dispositivo.adultos.map(a => ({
                    id_adulto: a.id_adulto,
                    nombre: a.nombre
                })),
                message: tieneAdultoMayorVinculado
                    ? 'Dispositivo ya vinculado'
                    : 'Dispositivo existe pero no está vinculado'
            };
        }
        catch (error) {
            console.error('[checkDeviceExists] Error:', error);
            return {
                exists: false,
                inDatabase: false,
                vinculado: false,
                error: 'Error al verificar dispositivo'
            };
        }
    }
    async checkDeviceConnectionStatus(deviceName) {
        const deviceInfo = this.connectedDevices.get(deviceName);
        if (deviceInfo) {
            console.log(`[ESP32] Dispositivo ${deviceName} encontrado en memoria: conectado`);
            return {
                connected: true,
                deviceId: deviceInfo.deviceId,
                ssid: deviceInfo.ssid,
                ip: deviceInfo.ip,
                rssi: deviceInfo.rssi,
                userId: deviceInfo.userId,
                source: 'memory'
            };
        }
        console.log(`[ESP32] Dispositivo ${deviceName} no encontrado en memoria, consultando BD...`);
        try {
            const dispositivo = await this.prisma.dispositivo.findUnique({
                where: { id_dispositivo: deviceName }
            });
            if (dispositivo) {
                console.log(`[ESP32] Dispositivo ${deviceName} encontrado en BD`);
                return {
                    connected: true,
                    deviceId: dispositivo.id_dispositivo,
                    dbId: dispositivo.id_dispositivo,
                    online_status: dispositivo.online_status,
                    last_seen: dispositivo.last_seen,
                    source: 'database'
                };
            }
        }
        catch (error) {
            console.error(`[ESP32] Error consultando BD para ${deviceName}:`, error);
        }
        console.log(`[ESP32] Dispositivo ${deviceName} no encontrado en memoria ni BD`);
        return {
            connected: false,
            message: 'Dispositivo no conectado aún',
        };
    }
    clearDeviceConnectionStatus(deviceName) {
        const removed = this.connectedDevices.delete(deviceName);
        console.log(`[ESP32] Estado de ${deviceName} eliminado de memoria: ${removed}`);
        return { success: removed };
    }
    getConnectedDevicesDebug() {
        const devices = Array.from(this.connectedDevices.entries()).map(([key, value]) => ({
            key,
            ...value,
        }));
        return {
            success: true,
            count: devices.length,
            devices,
            message: `${devices.length} dispositivo(s) conectado(s) en memoria`,
        };
    }
    async handleEsp32MaxData(dto) {
        console.log('[ESP32-MAX] Datos MAX30102 recibidos (tiempo real - sin guardar en DB):', {
            deviceId: dto.deviceId,
            bpm: dto.max_bpm,
            avgBpm: dto.max_avg_bpm,
            irValue: dto.max_ir_value,
        });
        try {
            this.updateDeviceHeartbeat(dto.deviceId);
            const dispositivo = await this.prisma.dispositivo.findUnique({
                where: { id_dispositivo: dto.deviceId },
            });
            if (!dispositivo) {
                console.log(`[ESP32-MAX] ⚠️ Dispositivo ${dto.deviceId} no existe en BD. Ignorando datos MAX30102.`);
                console.log(`[ESP32-MAX] El dispositivo debe ser vinculado primero con datos del adulto mayor.`);
                return {
                    success: false,
                    message: 'Dispositivo no vinculado. Los datos del sensor se ignorarán hasta que se vincule.',
                    deviceId: dto.deviceId,
                };
            }
            await this.prisma.dispositivo.update({
                where: { id_dispositivo: dispositivo.id_dispositivo },
                data: {
                    online_status: true,
                    last_seen: new Date(),
                },
            });
            console.log(`[ESP32-MAX] 📡 Transmitiendo en tiempo real (sin DB). BPM: ${dto.max_bpm}, Avg: ${dto.max_avg_bpm}`);
            const adultoMayor = await this.prisma.adultoMayor.findFirst({
                where: { id_dispositivo: dispositivo.id_dispositivo },
                include: {
                    usuariosAdultoMayor: {
                        select: { id_usuario: true }
                    },
                    sharedInGroups: {
                        include: {
                            group: {
                                include: {
                                    members: {
                                        select: { user_id: true }
                                    }
                                }
                            }
                        }
                    }
                },
            });
            let totalUsers = 0;
            if (adultoMayor) {
                const ownerIds = new Set();
                const groupMemberIds = new Set();
                adultoMayor.usuariosAdultoMayor.forEach(relacion => {
                    ownerIds.add(relacion.id_usuario);
                });
                adultoMayor.sharedInGroups?.forEach(sharedDevice => {
                    sharedDevice.group.members.forEach(member => {
                        if (!ownerIds.has(member.user_id)) {
                            groupMemberIds.add(member.user_id);
                        }
                    });
                });
                totalUsers = ownerIds.size + groupMemberIds.size;
                console.log(`[ESP32-MAX] 📊 Enviando BPM ${dto.max_avg_bpm} a ${totalUsers} usuario(s) (${ownerIds.size} owners, ${groupMemberIds.size} miembros)`);
                for (const userId of ownerIds) {
                    this.deviceEventsService.emitNotification({
                        id_notificacion: 0,
                        userId: userId,
                        tipo: 'BPM_UPDATE',
                        usuario: adultoMayor.nombre,
                        mensaje: undefined,
                        fecha_hora: new Date().toISOString(),
                        pulso: dto.max_avg_bpm,
                    });
                    console.log(`[ESP32-MAX] 📊 [OWNER] BPM ${dto.max_avg_bpm} enviado al usuario ${userId}`);
                }
                for (const userId of groupMemberIds) {
                    this.deviceEventsService.emitNotification({
                        id_notificacion: 0,
                        userId: userId,
                        tipo: 'BPM_UPDATE',
                        usuario: adultoMayor.nombre,
                        mensaje: undefined,
                        fecha_hora: new Date().toISOString(),
                        pulso: dto.max_avg_bpm,
                    });
                    console.log(`[ESP32-MAX] 📊 [GROUP] BPM ${dto.max_avg_bpm} enviado al usuario ${userId}`);
                }
            }
            return {
                success: true,
                message: 'Datos MAX30102 transmitidos en tiempo real (sin almacenamiento)',
                deviceId: dto.deviceId,
                bpm: dto.max_bpm,
                avgBpm: dto.max_avg_bpm,
                streamedToUsers: totalUsers,
            };
        }
        catch (error) {
            console.error('[ESP32-MAX] ✗ Error al procesar datos MAX30102:', error);
            throw error;
        }
    }
    async handleEsp32MpuAlert(dto) {
        console.log('[ESP32-MPU] ⚠️⚠️⚠️ ALERTA DE DESMAYO RECIBIDA ⚠️⚠️⚠️');
        console.log('[ESP32-MPU] Datos:', {
            deviceId: dto.deviceId,
            alertType: dto.alert_type,
            bpm: dto.bpm,
            timestamp: dto.timestamp,
        });
        try {
            this.updateDeviceHeartbeat(dto.deviceId);
            let dispositivo = await this.prisma.dispositivo.findUnique({
                where: { id_dispositivo: dto.deviceId },
            });
            if (!dispositivo) {
                console.log(`[ESP32-MPU] ⚠️⚠️ ALERTA IGNORADA: Dispositivo ${dto.deviceId} no existe en BD.`);
                console.log(`[ESP32-MPU] El dispositivo debe ser vinculado primero antes de enviar alertas.`);
                return {
                    success: false,
                    message: 'Dispositivo no vinculado. Las alertas se ignorarán hasta que se vincule.',
                    deviceId: dto.deviceId,
                    alert: 'ignored',
                };
            }
            dispositivo = await this.prisma.dispositivo.update({
                where: { id_dispositivo: dispositivo.id_dispositivo },
                data: {
                    online_status: true,
                    last_seen: new Date(),
                },
            });
            console.log(`[ESP32-MPU] ✓ Dispositivo actualizado`);
            await this.handleMpuFallAlert(dispositivo.id_dispositivo, dto);
            return {
                success: true,
                message: '⚠️ Alerta de desmayo procesada',
                deviceId: dto.deviceId,
                alertType: dto.alert_type,
                bpm: dto.bpm,
            };
        }
        catch (error) {
            console.error('[ESP32-MPU] ✗ Error al procesar alerta MPU:', error);
            throw error;
        }
    }
    async handleMpuFallAlert(dispositivoId, alertData) {
        console.log(`[MPU-ALERT] Procesando alerta de desmayo para dispositivo ID ${dispositivoId}`);
        try {
            const dispositivo = await this.prisma.dispositivo.findUnique({
                where: { id_dispositivo: dispositivoId },
            });
            if (!dispositivo) {
                console.error(`[MPU-ALERT] ✗ Dispositivo ${dispositivoId} no encontrado`);
                return;
            }
            console.log(`[MPU-ALERT] Dispositivo encontrado: ${dispositivo.id_dispositivo}`);
            console.log(`[MPU-ALERT] Buscando adulto mayor con id_dispositivo = ${dispositivoId}...`);
            const adultoMayor = await this.prisma.adultoMayor.findFirst({
                where: { id_dispositivo: dispositivoId },
                include: {
                    usuariosAdultoMayor: {
                        include: {
                            usuario: {
                                select: { id_usuario: true, nombre: true, email: true }
                            }
                        }
                    }
                },
            });
            if (!adultoMayor) {
                console.warn(`[MPU-ALERT] ⚠️ NO SE ENCONTRÓ ADULTO MAYOR para dispositivo ${dispositivo.id_dispositivo}`);
                console.warn(`[MPU-ALERT] ⚠️ Debes vincular el dispositivo desde la app con el botón "Guardar" del modal`);
                console.warn(`[MPU-ALERT] ⚠️ Esto creará la relación: Dispositivo → AdultoMayor → Usuario`);
                if (alertData.userId) {
                    const userId = parseInt(alertData.userId);
                    console.log(`[MPU-ALERT] Enviando alerta directa al usuario ${userId}`);
                    await this.sendNotificationToUser(userId, {
                        id_notificacion: 0,
                        tipo: 'DESMAYO',
                        usuario: `Dispositivo ${dispositivo.id_dispositivo}`,
                        mensaje: `⚠️ ${alertData.alert_type} - Dispositivo sin vincular - BPM: ${alertData.bpm}`,
                        fecha_hora: new Date().toISOString(),
                        pulso: alertData.bpm,
                    });
                    console.log(`[MPU-ALERT] 🔔 Alerta directa enviada al usuario ${userId} (dispositivo sin vincular)`);
                }
                return;
            }
            console.log(`[MPU-ALERT] ✅ Adulto mayor encontrado:`, {
                id_adulto: adultoMayor.id_adulto,
                nombre: adultoMayor.nombre,
                id_dispositivo: adultoMayor.id_dispositivo,
                usuarios_monitoreando: adultoMayor.usuariosAdultoMayor.length
            });
            const notificacion = await this.prisma.notificaciones.create({
                data: {
                    id_adulto: adultoMayor.id_adulto,
                    tipo: 'EMERGENCIA',
                    fecha_hora: new Date(),
                    mensaje: `${adultoMayor.nombre} necesita tu ayuda rápido`,
                    pulso: alertData.bpm,
                },
            });
            console.log(`[MPU-ALERT] ✓ Notificación de desmayo creada (ID: ${notificacion.id_notificacion}) para ${adultoMayor.nombre} con BPM: ${alertData.bpm}`);
            const sharedGroups = await this.prisma.sharedGroupDevice.findMany({
                where: { adulto_id: adultoMayor.id_adulto },
                include: {
                    group: {
                        include: {
                            members: {
                                select: { user_id: true }
                            }
                        }
                    }
                }
            });
            const ownerIds = new Set();
            const groupMemberIds = new Set();
            adultoMayor.usuariosAdultoMayor.forEach(relacion => {
                ownerIds.add(relacion.usuario.id_usuario);
            });
            sharedGroups.forEach(sharedDevice => {
                sharedDevice.group.members.forEach(member => {
                    if (!ownerIds.has(member.user_id)) {
                        groupMemberIds.add(member.user_id);
                    }
                });
            });
            const totalUsers = ownerIds.size + groupMemberIds.size;
            console.log(`[MPU-ALERT] 🚨 Enviando notificación EMERGENCIA a ${totalUsers} usuario(s) (${ownerIds.size} owners, ${groupMemberIds.size} miembros)`);
            if (totalUsers === 0) {
                console.warn(`[MPU-ALERT] ⚠ No hay usuarios monitoreando a ${adultoMayor.nombre}`);
            }
            for (const userId of ownerIds) {
                await this.sendNotificationToUser(userId, {
                    id_notificacion: notificacion.id_notificacion,
                    tipo: 'EMERGENCIA',
                    usuario: adultoMayor.nombre,
                    mensaje: notificacion.mensaje || `${adultoMayor.nombre} necesita tu ayuda rápido`,
                    fecha_hora: notificacion.fecha_hora.toISOString(),
                    pulso: alertData.bpm,
                });
                console.log(`[MPU-ALERT] 🔔 [OWNER] EMERGENCIA enviada al usuario ${userId}`);
            }
            for (const userId of groupMemberIds) {
                await this.sendNotificationToUser(userId, {
                    id_notificacion: notificacion.id_notificacion,
                    tipo: 'EMERGENCIA',
                    usuario: adultoMayor.nombre,
                    mensaje: notificacion.mensaje || `${adultoMayor.nombre} necesita tu ayuda rápido`,
                    fecha_hora: notificacion.fecha_hora.toISOString(),
                    pulso: alertData.bpm,
                });
                console.log(`[MPU-ALERT] 🔔 [GROUP] EMERGENCIA enviada al usuario ${userId}`);
            }
        }
        catch (error) {
            console.error('[MPU-ALERT] ✗ Error al crear notificación de desmayo:', error);
            console.error('[MPU-ALERT] Stack:', error.stack);
        }
    }
    async handleEsp32ButtonAlert(dto) {
        console.log('[ESP32-BUTTON] ⚠️⚠️⚠️ ALERTA DE BOTÓN DE PÁNICO RECIBIDA ⚠️⚠️⚠️');
        console.log('[ESP32-BUTTON] Datos:', {
            deviceId: dto.deviceId,
            alertType: dto.alert_type,
            bpm: dto.bpm,
            message: dto.message,
        });
        try {
            this.updateDeviceHeartbeat(dto.deviceId);
            let dispositivo = await this.prisma.dispositivo.findUnique({
                where: { id_dispositivo: dto.deviceId },
            });
            if (!dispositivo) {
                console.log(`[ESP32-BUTTON] ⚠️⚠️ ALERTA DE PÁNICO IGNORADA: Dispositivo ${dto.deviceId} no existe en BD.`);
                console.log(`[ESP32-BUTTON] El dispositivo debe ser vinculado primero antes de enviar alertas.`);
                return {
                    success: false,
                    message: 'Dispositivo no vinculado. Las alertas de pánico se ignorarán hasta que se vincule.',
                    deviceId: dto.deviceId,
                    alert: 'ignored',
                };
            }
            dispositivo = await this.prisma.dispositivo.update({
                where: { id_dispositivo: dispositivo.id_dispositivo },
                data: {
                    online_status: true,
                    last_seen: new Date(),
                },
            });
            console.log(`[ESP32-BUTTON] ✓ Dispositivo actualizado`);
            await this.handleButtonPanicAlert(dispositivo.id_dispositivo, dto);
            return {
                success: true,
                message: '⚠️ Alerta de botón de pánico procesada',
                deviceId: dto.deviceId,
                alertType: dto.alert_type,
                bpm: dto.bpm,
            };
        }
        catch (error) {
            console.error('[ESP32-BUTTON] ✗ Error al procesar alerta de botón:', error);
            throw error;
        }
    }
    async handleButtonPanicAlert(dispositivoId, alertData) {
        console.log(`[BUTTON-ALERT] Procesando alerta de botón para dispositivo ID ${dispositivoId}`);
        try {
            const dispositivo = await this.prisma.dispositivo.findUnique({
                where: { id_dispositivo: dispositivoId },
            });
            if (!dispositivo) {
                console.error(`[BUTTON-ALERT] ✗ Dispositivo ${dispositivoId} no encontrado`);
                return;
            }
            console.log(`[BUTTON-ALERT] Dispositivo encontrado: ${dispositivo.id_dispositivo}`);
            const adultoMayor = await this.prisma.adultoMayor.findFirst({
                where: { id_dispositivo: dispositivoId },
                include: {
                    usuariosAdultoMayor: {
                        include: {
                            usuario: {
                                select: { id_usuario: true, nombre: true, email: true }
                            }
                        }
                    }
                },
            });
            if (!adultoMayor) {
                console.warn(`[BUTTON-ALERT] ⚠️ NO SE ENCONTRÓ ADULTO MAYOR para dispositivo ${dispositivo.id_dispositivo}`);
                if (alertData.userId) {
                    const userId = parseInt(alertData.userId);
                    console.log(`[BUTTON-ALERT] Enviando alerta directa al usuario ${userId}`);
                    await this.sendNotificationToUser(userId, {
                        id_notificacion: 0,
                        tipo: 'PANICO',
                        usuario: `Dispositivo ${dispositivo.id_dispositivo}`,
                        mensaje: `⚠️ Botón de pánico presionado - Dispositivo sin vincular`,
                        fecha_hora: new Date().toISOString(),
                    });
                    console.log(`[BUTTON-ALERT] 🔔 Alerta directa enviada al usuario ${userId}`);
                }
                return;
            }
            console.log(`[BUTTON-ALERT] ✅ Adulto mayor encontrado:`, {
                id_adulto: adultoMayor.id_adulto,
                nombre: adultoMayor.nombre,
                usuarios_monitoreando: adultoMayor.usuariosAdultoMayor.length
            });
            const notificacion = await this.prisma.notificaciones.create({
                data: {
                    id_adulto: adultoMayor.id_adulto,
                    tipo: 'PANICO',
                    fecha_hora: new Date(),
                    mensaje: `${adultoMayor.nombre} presionó el botón de emergencia`,
                    pulso: alertData.bpm,
                },
            });
            console.log(`[BUTTON-ALERT] ✓ Notificación creada (ID: ${notificacion.id_notificacion}) para ${adultoMayor.nombre} con BPM: ${alertData.bpm}`);
            const sharedGroups = await this.prisma.sharedGroupDevice.findMany({
                where: { adulto_id: adultoMayor.id_adulto },
                include: {
                    group: {
                        include: {
                            members: {
                                select: { user_id: true }
                            }
                        }
                    }
                }
            });
            const ownerIds = new Set();
            const groupMemberIds = new Set();
            adultoMayor.usuariosAdultoMayor.forEach(relacion => {
                ownerIds.add(relacion.usuario.id_usuario);
            });
            sharedGroups.forEach(sharedDevice => {
                sharedDevice.group.members.forEach(member => {
                    if (!ownerIds.has(member.user_id)) {
                        groupMemberIds.add(member.user_id);
                    }
                });
            });
            const totalUsers = ownerIds.size + groupMemberIds.size;
            console.log(`[BUTTON-ALERT] 🚨 Enviando notificación PÁNICO a ${totalUsers} usuario(s) (${ownerIds.size} owners, ${groupMemberIds.size} miembros)`);
            if (totalUsers === 0) {
                console.warn(`[BUTTON-ALERT] ⚠ No hay usuarios monitoreando a ${adultoMayor.nombre}`);
            }
            for (const userId of ownerIds) {
                await this.sendNotificationToUser(userId, {
                    id_notificacion: notificacion.id_notificacion,
                    tipo: 'PANICO',
                    usuario: adultoMayor.nombre,
                    mensaje: notificacion.mensaje || `${adultoMayor.nombre} presionó el botón de emergencia`,
                    fecha_hora: notificacion.fecha_hora.toISOString(),
                });
                console.log(`[BUTTON-ALERT] 🔔 [OWNER] PÁNICO enviada al usuario ${userId}`);
            }
            for (const userId of groupMemberIds) {
                await this.sendNotificationToUser(userId, {
                    id_notificacion: notificacion.id_notificacion,
                    tipo: 'PANICO',
                    usuario: adultoMayor.nombre,
                    mensaje: notificacion.mensaje || `${adultoMayor.nombre} presionó el botón de emergencia`,
                    fecha_hora: notificacion.fecha_hora.toISOString(),
                });
                console.log(`[BUTTON-ALERT] 🔔 [GROUP] PÁNICO enviada al usuario ${userId}`);
            }
        }
        catch (error) {
            console.error('[BUTTON-ALERT] ✗ Error al crear notificación de botón:', error);
            console.error('[BUTTON-ALERT] Stack:', error.stack);
        }
    }
};
exports.DeviceService = DeviceService;
exports.DeviceService = DeviceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        device_events_service_1.DeviceEventsService,
        firebase_service_1.FirebaseService])
], DeviceService);
//# sourceMappingURL=device.service.js.map