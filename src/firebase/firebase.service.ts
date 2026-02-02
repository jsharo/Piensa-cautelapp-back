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
      let serviceAccount: any;

      // Opción 1: Usar variable de entorno FIREBASE_SERVICE_ACCOUNT (para producción)
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
          serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
          console.log('✅ Credenciales de Firebase cargadas desde variable de entorno');
        } catch (parseError) {
          console.error('❌ Error parseando FIREBASE_SERVICE_ACCOUNT:', parseError);
          return;
        }
      } 
      // Opción 2: Usar archivo local firebase-adminsdk-key.json (para desarrollo)
      else {
        const serviceAccountPath = path.join(process.cwd(), 'firebase-adminsdk-key.json');
        
        if (!fs.existsSync(serviceAccountPath)) {
          console.warn('⚠️ Firebase no configurado: No se encontró FIREBASE_SERVICE_ACCOUNT ni firebase-adminsdk-key.json');
          console.warn('   Para desarrollo: Descarga firebase-adminsdk-key.json desde Firebase Console');
          console.warn('   Para producción: Configura la variable de entorno FIREBASE_SERVICE_ACCOUNT en Render');
          return;
        }

        serviceAccount = require(serviceAccountPath);
        console.log('✅ Credenciales de Firebase cargadas desde archivo local');
      }

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
