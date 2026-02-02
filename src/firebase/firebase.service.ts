import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private initialized = false;

  onModuleInit() {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    if (this.initialized) {
      return;
    }

    try {
      // Buscar el archivo de credenciales
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
    } catch (error) {
      console.error('❌ Error inicializando Firebase Admin SDK:', error);
      console.warn('   FCM no estará disponible');
    }
  }

  /**
   * Envía una notificación push a un dispositivo específico
   */
  async sendNotification(
    fcmToken: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<string | null> {
    if (!this.initialized) {
      console.warn('Firebase no está inicializado. No se puede enviar notificación.');
      return null;
    }

    try {
      const message: admin.messaging.Message = {
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
    } catch (error) {
      console.error('❌ Error enviando notificación FCM:', error);
      
      // Si el token es inválido, devolver null para que se pueda eliminar
      if (error.code === 'messaging/invalid-registration-token' || 
          error.code === 'messaging/registration-token-not-registered') {
        console.warn('Token FCM inválido o no registrado:', fcmToken);
        return null;
      }
      
      throw error;
    }
  }

  /**
   * Envía notificaciones a múltiples dispositivos
   */
  async sendMulticastNotification(
    fcmTokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<admin.messaging.BatchResponse | null> {
    if (!this.initialized) {
      console.warn('Firebase no está inicializado. No se puede enviar notificación.');
      return null;
    }

    if (!fcmTokens || fcmTokens.length === 0) {
      console.warn('No hay tokens FCM para enviar notificaciones');
      return null;
    }

    try {
      const message: admin.messaging.MulticastMessage = {
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
    } catch (error) {
      console.error('❌ Error enviando notificaciones FCM multicast:', error);
      throw error;
    }
  }

  /**
   * Verifica si un token FCM es válido
   */
  async validateToken(fcmToken: string): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }

    try {
      // Intentar enviar una notificación de prueba sin título ni cuerpo
      await admin.messaging().send({
        token: fcmToken,
        data: { test: 'true' },
      });
      return true;
    } catch (error) {
      console.warn('Token FCM inválido:', fcmToken);
      return false;
    }
  }
}
