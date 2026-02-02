// test-fcm.ts
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

async function testFCM() {
  console.log('🧪 Probando configuración de Firebase...\n');
  
  try {
    // Verificar que el archivo existe
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
    
    // Verificar que sea JSON válido
    const serviceAccount = require(serviceAccountPath);
    console.log('✅ Archivo JSON válido');
    console.log('📧 Service Account:', serviceAccount.client_email);
    console.log('🔑 Project ID:', serviceAccount.project_id);
    
    // Inicializar Firebase Admin SDK
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    
    console.log('\n✅ Firebase Admin SDK inicializado correctamente');
    console.log('🎉 Configuración completa!\n');
    
    // Para probar con un token real (opcional)
    const testToken = process.argv[2]; // Puedes pasar el token como argumento
    
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
          priority: 'high' as const,
          notification: {
            sound: 'default',
            channelId: 'cautelapp_notifications',
            priority: 'max' as const,
          },
        },
      };
      
      const response = await admin.messaging().send(message);
      console.log('🎉 Notificación de prueba enviada correctamente');
      console.log('📩 Response:', response);
    } else {
      console.log('💡 Para enviar una notificación de prueba, ejecuta:');
      console.log('   npx ts-node test-fcm.ts TU_TOKEN_FCM_AQUI');
    }
    
  } catch (error) {
    console.error('\n❌ Error durante la prueba:', error.message);
    console.error('\n🔍 Verifica que:');
    console.error('   1. El archivo firebase-adminsdk-key.json esté en la raíz del proyecto');
    console.error('   2. El archivo tenga formato JSON válido');
    console.error('   3. Las credenciales sean correctas');
    process.exit(1);
  }
}

testFCM();
