# Correo de recuperación de contraseña

El backend envía el código por la API HTTPS de Brevo (`POST https://api.brevo.com/v3/smtp/email`). No usa SMTP ni SendGrid.

En Render, define estas variables:

```env
BREVO_API_KEY=la-clave-api-de-brevo
BREVO_SENDER_EMAIL=remitente-verificado@tu-dominio.com
BREVO_SENDER_NAME=Tatara
```

`BREVO_SENDER_EMAIL` tiene que ser un remitente verificado en la cuenta de Brevo. `BREVO_SENDER_NAME` es opcional y, si falta, el nombre mostrado es `Tatara`.

Si falta la clave o el remitente, `POST /api/auth/forgot-password` responde 503 y no revela si el correo existe. El código de verificación no se escribe en los logs.
