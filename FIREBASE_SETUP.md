# Configuración de Firebase Cloud Messaging - Backend

## ⚠️ ARCHIVO REQUERIDO: firebase-adminsdk-key.json

Para que las notificaciones push funcionen, necesitas descargar la clave privada de Firebase Admin SDK.

### Pasos para obtener la clave:

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto CautelApp
3. Haz clic en el ícono de engranaje (⚙️) → **Configuración del proyecto**
4. Ve a la pestaña **Cuentas de servicio**
5. Haz clic en **Generar nueva clave privada**
6. Se descargará un archivo JSON
7. **Renómbralo a:** `firebase-adminsdk-key.json`
8. **Colócalo en la raíz del proyecto backend** (mismo nivel que package.json)

```
Piensa-cautelapp-back/
├── firebase-adminsdk-key.json  ← AQUÍ
├── package.json
├── src/
└── prisma/
```

### 🔒 Seguridad

- ✅ Este archivo ya está en `.gitignore`
- ❌ **NUNCA** subas este archivo a Git o repositorios públicos
- ✅ Contiene credenciales sensibles de tu proyecto Firebase

### ✅ Verificación

Si el archivo está correctamente configurado, al iniciar el backend verás:
```
✅ Firebase Admin SDK inicializado correctamente
```

Si el archivo NO está, verás:
```
⚠️ Archivo firebase-adminsdk-key.json no encontrado. FCM no funcionará.
```

### 📝 Nota

El backend funcionará sin este archivo, pero las notificaciones push NO llegarán cuando la app esté cerrada.
Solo funcionará SSE (app abierta).
