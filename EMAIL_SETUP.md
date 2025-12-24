# 📧 Configuración de Envío de Emails

## ✅ Estado Actual

El sistema de recuperación de contraseña **ya funciona completamente**, pero hay dos modos de operación:

### Modo de Desarrollo (Sin configuración)
- ✅ Los emails se muestran en la **consola del servidor**
- ✅ El código de recuperación aparece en los logs
- ✅ Perfecto para desarrollo y testing

### Modo de Producción (Con configuración SMTP)
- ✅ Los emails se envían **realmente** al correo del usuario
- ✅ Plantilla HTML profesional con diseño CautelApp
- ✅ Código de 6 dígitos con expiración de 15 minutos

---

## 🚀 Cómo Configurar el Envío Real de Emails

### Opción 1: Gmail (Recomendado para empezar)

#### Paso 1: Preparar tu cuenta de Gmail
1. Ve a https://myaccount.google.com/security
2. Activa la **"Verificación en 2 pasos"**
3. Una vez activada, busca **"Contraseñas de aplicaciones"** (App Passwords)
4. Genera una nueva contraseña de aplicación
   - Selecciona "Correo" como app
   - Selecciona "Otro" como dispositivo
   - Nómbralo "CautelApp"
5. Copia el **código de 16 caracteres** que aparece

#### Paso 2: Configurar el archivo `.env`
Abre el archivo `.env` en la raíz del backend y agrega:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-password-de-app-de-16-caracteres
```

#### Paso 3: Reiniciar el servidor
El servidor NestJS detectará automáticamente la configuración y comenzará a enviar emails reales.

---

### Opción 2: SendGrid (Para producción)

SendGrid ofrece 100 emails gratuitos por día.

1. Crea una cuenta en https://sendgrid.com/
2. Verifica tu dominio o email
3. Genera una API Key
4. Configura en `.env`:

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=tu-api-key-de-sendgrid
```

---

### Opción 3: Outlook/Hotmail

```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=tu-email@outlook.com
SMTP_PASS=tu-contraseña
```

**Nota**: Outlook puede requerir configuración adicional de seguridad.

---

## 🔍 Verificar que Funciona

### Ver en la Consola
Cuando el servidor inicia, verás uno de estos mensajes:

**Con configuración SMTP:**
```
✅ Servidor de email conectado correctamente
```

**Sin configuración SMTP:**
```
⚠️  No se pudo conectar al servidor de email. Los emails se mostrarán en consola.
Configura SMTP_HOST, SMTP_PORT, SMTP_USER y SMTP_PASS en el archivo .env
```

### Probar el Flujo
1. En la app, ve a **"Configuración"** → **"Email de Recuperación"**
2. Configura un email de recuperación
3. Cierra sesión
4. En login, haz clic en **"¿Olvidaste tu contraseña?"**
5. Ingresa el email de recuperación
6. **Si SMTP está configurado**: Recibirás un email con el código
7. **Si SMTP NO está configurado**: El código aparecerá en los logs del servidor

---

## 📋 Solución de Problemas

### Error: "Authentication failed"
- Verifica que el email y password sean correctos
- Si usas Gmail, asegúrate de usar una **App Password**, no tu contraseña normal
- Verifica que la verificación en 2 pasos esté activada

### Error: "Connection timeout"
- Verifica que el puerto sea 587 (no 465)
- Verifica que `secure: false` en el código (ya está configurado)
- Algunos firewalls corporativos bloquean SMTP

### Los emails no llegan
- Revisa la **carpeta de spam**
- Verifica que el email de recuperación esté bien escrito
- Revisa los logs del servidor para ver si hay errores

### En desarrollo, prefiero ver en consola
Simplemente **no configures** las variables SMTP en `.env`. El sistema automáticamente mostrará los códigos en la consola.

---

## 🎨 Plantilla de Email

El email que reciben los usuarios incluye:

- ✅ Diseño profesional con colores de CautelApp (#159A9C, #002333)
- ✅ Código de 6 dígitos grande y legible
- ✅ Advertencia de expiración (15 minutos)
- ✅ Información de seguridad
- ✅ Diseño responsive para móviles
- ✅ Degradados y estilos profesionales

---

## 🔒 Seguridad

- Los códigos expiran en **15 minutos**
- Un código solo puede usarse **una vez**
- Los emails se envían solo al **email de recuperación** configurado
- Las contraseñas de SMTP **nunca** se muestran en logs
- En desarrollo, el código se muestra en consola para facilitar testing

---

## 📝 Variables de Entorno Completas

Copia este bloque en tu archivo `.env`:

```env
# Configuración de Email (Opcional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-app-password

# Entorno
NODE_ENV=development
```

Para producción, cambia `NODE_ENV=production` para que el código NO se muestre en la respuesta de la API.

---

## ✨ Próximos Pasos

Una vez configurado el email:

1. ✅ Los usuarios podrán recuperar sus contraseñas de forma autónoma
2. ✅ Recibirán códigos seguros con tiempo de expiración
3. ✅ Experiencia profesional y confiable

¿Necesitas más ayuda? Revisa la [documentación de Nodemailer](https://nodemailer.com/) o pregunta en el equipo.
