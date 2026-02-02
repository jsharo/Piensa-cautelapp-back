import { OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
export declare class FirebaseService implements OnModuleInit {
    private initialized;
    onModuleInit(): void;
    private initializeFirebase;
    sendNotification(fcmToken: string, title: string, body: string, data?: Record<string, string>): Promise<string | null>;
    sendMulticastNotification(fcmTokens: string[], title: string, body: string, data?: Record<string, string>): Promise<admin.messaging.BatchResponse | null>;
    validateToken(fcmToken: string): Promise<boolean>;
}
