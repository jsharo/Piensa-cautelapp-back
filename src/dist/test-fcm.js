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
const admin = __importStar(require("firebase-admin"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
async function testFCM() {
    console.log('🧪 Probando configuración de Firebase...\n');
    try {
        const serviceAccountPath = path.join(process.cwd(), 'firebase-adminsdk-key.json');
        if (!fs.existsSync(serviceAccountPath)) {
            console.log('❌ firebase-adminsdk-key.json NO encontrado en la raíz del proyecto');
            console.log('📁 Ruta esperada:', serviceAccountPath);
            console.log('\n⚠️ Descarga el archivo desde:');
            console.log('   Firebase Console → Configuración → Cuentas de servicio → Generar nueva clave privada');
            return;
        }
        console.log('✅ Archivo firebase-adminsdk-key.json encontrado');
        console.log('📁 Ubicación:', serviceAccountPath);
        const serviceAccount = require(serviceAccountPath);
        console.log('✅ Archivo JSON válido');
        console.log('📧 Service Account:', serviceAccount.client_email);
        console.log('🔑 Project ID:', serviceAccount.project_id);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        console.log('\n✅ Firebase Admin SDK inicializado correctamente');
        console.log('🎉 Configuración completa!\n');
        const testToken = process.argv[2];
        if (testToken && testToken.length > 10) {
            console.log('📤 Enviando notificación de prueba...');
            const message = {
                notification: {
                    title: '✅ Prueba FCM',
                    body: 'Esta es una notificación de prueba desde el backend',
                },
                data: {
                    test: 'true',
                    timestamp: new Date().toISOString(),
                },
                token: testToken,
                android: {
                    priority: 'high',
                    notification: {
                        sound: 'default',
                        channelId: 'cautelapp_notifications',
                        priority: 'max',
                    },
                },
            };
            const response = await admin.messaging().send(message);
            console.log('🎉 Notificación de prueba enviada correctamente');
            console.log('📩 Response:', response);
        }
        else {
            console.log('💡 Para enviar una notificación de prueba, ejecuta:');
            console.log('   npx ts-node test-fcm.ts TU_TOKEN_FCM_AQUI');
        }
    }
    catch (error) {
        console.error('\n❌ Error durante la prueba:', error.message);
        console.error('\n🔍 Verifica que:');
        console.error('   1. El archivo firebase-adminsdk-key.json esté en la raíz del proyecto');
        console.error('   2. El archivo tenga formato JSON válido');
        console.error('   3. Las credenciales sean correctas');
        process.exit(1);
    }
}
testFCM();
//# sourceMappingURL=test-fcm.js.map