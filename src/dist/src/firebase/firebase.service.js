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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirebaseService = void 0;
const common_1 = require("@nestjs/common");
const admin = __importStar(require("firebase-admin"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
let FirebaseService = class FirebaseService {
    initialized = false;
    onModuleInit() {
        this.initializeFirebase();
    }
    initializeFirebase() {
        if (this.initialized) {
            return;
        }
        try {
            const serviceAccountPath = path.join(process.cwd(), 'firebase-adminsdk-key.json');
            if (!fs.existsSync(serviceAccountPath)) {
                console.warn('⚠️ Archivo firebase-adminsdk-key.json no encontrado. FCM no funcionará.');
                console.warn('   Descarga la clave desde Firebase Console → Configuración → Cuentas de servicio');
                return;
            }
            const serviceAccount = require(serviceAccountPath);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
            this.initialized = true;
            console.log('✅ Firebase Admin SDK inicializado correctamente');
        }
        catch (error) {
            console.error('❌ Error inicializando Firebase Admin SDK:', error);
            console.warn('   FCM no estará disponible');
        }
    }
    async sendNotification(fcmToken, title, body, data) {
        if (!this.initialized) {
            console.warn('Firebase no está inicializado. No se puede enviar notificación.');
            return null;
        }
        try {
            const message = {
                notification: {
                    title: title,
                    body: body,
                },
                data: data || {},
                token: fcmToken,
                android: {
                    priority: 'high',
                    notification: {
                        sound: 'notification_sound',
                        channelId: 'cautelapp_notifications',
                        priority: 'max',
                        defaultSound: true,
                        defaultVibrateTimings: true,
                    },
                },
            };
            const response = await admin.messaging().send(message);
            console.log('✅ Notificación FCM enviada:', response);
            return response;
        }
        catch (error) {
            console.error('❌ Error enviando notificación FCM:', error);
            if (error.code === 'messaging/invalid-registration-token' ||
                error.code === 'messaging/registration-token-not-registered') {
                console.warn('Token FCM inválido o no registrado:', fcmToken);
                return null;
            }
            throw error;
        }
    }
    async sendMulticastNotification(fcmTokens, title, body, data) {
        if (!this.initialized) {
            console.warn('Firebase no está inicializado. No se puede enviar notificación.');
            return null;
        }
        if (!fcmTokens || fcmTokens.length === 0) {
            console.warn('No hay tokens FCM para enviar notificaciones');
            return null;
        }
        try {
            const message = {
                notification: {
                    title: title,
                    body: body,
                },
                data: data || {},
                tokens: fcmTokens,
                android: {
                    priority: 'high',
                    notification: {
                        sound: 'notification_sound',
                        channelId: 'cautelapp_notifications',
                        priority: 'max',
                        defaultSound: true,
                        defaultVibrateTimings: true,
                    },
                },
            };
            const response = await admin.messaging().sendEachForMulticast(message);
            console.log(`✅ Notificaciones FCM enviadas: ${response.successCount}/${fcmTokens.length}`);
            if (response.failureCount > 0) {
                console.warn(`⚠️ ${response.failureCount} notificaciones fallaron`);
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        console.warn(`  Token ${idx}: ${resp.error?.message}`);
                    }
                });
            }
            return response;
        }
        catch (error) {
            console.error('❌ Error enviando notificaciones FCM multicast:', error);
            throw error;
        }
    }
    async validateToken(fcmToken) {
        if (!this.initialized) {
            return false;
        }
        try {
            await admin.messaging().send({
                token: fcmToken,
                data: { test: 'true' },
            });
            return true;
        }
        catch (error) {
            console.warn('Token FCM inválido:', fcmToken);
            return false;
        }
    }
};
exports.FirebaseService = FirebaseService;
exports.FirebaseService = FirebaseService = __decorate([
    (0, common_1.Injectable)()
], FirebaseService);
//# sourceMappingURL=firebase.service.js.map