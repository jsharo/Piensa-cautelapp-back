# Estado de Conexión de Dispositivos ESP32

## Cambios implementados

### 1. Endpoint POST / (Raíz)
- **Función**: Recibe confirmaciones de conexión desde ESP32
- **Body esperado**: `{"deviceId": "CautelApp-D1"}`
- **Respuesta**: `{"status": "ok", "deviceId": "CautelApp-D1", "online": true, "message": "Connection received"}`

### 2. Endpoints de consulta de estado

#### GET /devices/status
- **Función**: Obtiene el estado de todos los dispositivos
- **Respuesta**: Lista de dispositivos con su estado de conexión

#### GET /devices/:deviceId/status  
- **Función**: Obtiene el estado específico de un dispositivo
- **Parámetros**: `deviceId` en la URL
- **Respuesta**: Estado del dispositivo específico

### 3. Esquema de base de datos actualizado

Se agregaron los siguientes campos al modelo `Dispositivo`:
- `device_id`: String único (ej: "CautelApp-D1")
- `online_status`: Boolean para estado online/offline
- `last_seen`: DateTime de última conexión
- `created_at`: DateTime de creación
- `updated_at`: DateTime de actualización

## Próximos pasos para activar completamente

### 1. Configurar base de datos
Edita el archivo `.env` con tu configuración de PostgreSQL:
```bash
DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/cautelapp?schema=public"
```

### 2. Aplicar migración
```bash
npx prisma migrate dev --name add_device_connection_status
```

### 3. Regenerar cliente Prisma
```bash
npx prisma generate
```

### 4. Descomentar código en app.controller.ts
Una vez aplicada la migración, descomenta las secciones marcadas con `TODO` en:
- `receiveDeviceOnline()` - Para actualizar estado en BD
- `getDevicesStatus()` - Para consultar estados reales  
- `getDeviceStatus()` - Para consultar dispositivo específico

## Flujo de funcionamiento

1. **ESP32 se conecta a WiFi** → Ejecuta `notifyBackend()`
2. **Backend recibe POST /** → Logs + actualiza BD (cuando se descomente)
3. **Frontend consulta GET /devices/status** → Obtiene estados actuales
4. **Frontend muestra estados** → Solo dispositivos realmente conectados aparecen como "online"

## Nota importante
El estado `online_status` solo se marca como `true` cuando el ESP32 confirma exitosamente su conexión enviando el POST. No es automático, requiere la confirmación activa del dispositivo.