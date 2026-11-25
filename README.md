
# Recuperación del correo corporativo

En `/es/webmail/recuperacion` se puede verificar una dirección alternativa y restablecer la contraseña del buzón. Cada usuario registra su dirección alternativa desde la bandeja de correo de la web. Los códigos son de un solo uso y vencen a los 10 minutos.

Para habilitar el flujo en el despliegue, configure estas variables privadas del servidor.

| Variable | Valor |
| --- | --- |
| `WEBMAIL_CPANEL_USERNAME` | Usuario de la cuenta de hosting que administra `faynshteynjuridico.com`. |
| `WEBMAIL_CPANEL_API_TOKEN` | Token de API de esa cuenta de cPanel. |
| `WEBMAIL_CPANEL_ORIGIN` | Opcional. Origen HTTPS del proveedor. El valor predeterminado es `https://cpanel.faynshteynjuridico.com:2083`. |
| `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` | URL HTTPS y token de escritura de la base persistente de Upstash Redis. |
| `RESEND_API_KEY` y `WEBMAIL_RECOVERY_FROM` | Clave de envío de Resend y dirección remitente de un dominio verificado en Resend. |
| `WEBMAIL_RECOVERY_SECRET` | Secreto aleatorio y estable de al menos 32 bytes. Se utiliza para identificar los registros y proteger los códigos en Redis. |

La verificación y el cambio de contraseña se ejecutan en el servidor mediante la API de cPanel. [Documentación de cPanel](https://api.docs.cpanel.net/cpanel/tokens)



Para activarlo, agrega las variables privadas en Vercel y publica la versión que incluye la recuperación. Esta configuración se hace una vez. Los usuarios seguirán haciendo todo desde el correo de tu web.
1. cPanel. En Seguridad → Administrar tokens de API, crea un token. Guarda el usuario de la cuenta de hosting en WEBMAIL_CPANEL_USERNAME y el token en WEBMAIL_CPANEL_API_TOKEN. WEBMAIL_CPANEL_ORIGIN ya tiene un valor predeterminado. Guía de cPanel
2. Upstash. Crea una base Redis. En REST API, copia la URL HTTPS en UPSTASH_REDIS_REST_URL y el token con permiso de escritura en UPSTASH_REDIS_REST_TOKEN. Guía de Upstash
3. Resend. Verifica un dominio de envío, por ejemplo avisos.faynshteynjuridico.com, agregando los registros DNS que indique Resend. Crea una clave de envío para RESEND_API_KEY y usa recuperacion@avisos.faynshteynjuridico.com como WEBMAIL_RECOVERY_FROM una vez verificado el subdominio. Dominios en Resend · Claves de Resend
4. Secreto de recuperación. Ejecuta esto en tu terminal y guarda el resultado en WEBMAIL_RECOVERY_SECRET. Conserva el mismo valor entre despliegues para mantener accesibles los correos alternativos registrados.
   node -p "require('node:crypto').randomBytes(32).toString('hex')"
5. Vercel. Abre tu proyecto, entra en Settings → Environment Variables, agrega cada variable para Production y despliega la versión que contiene estos cambios. Si esa versión ya está publicada, pulsa Redeploy para que tome las variables nuevas. Guía de Vercel
Para probarlo en tu PC, guarda las mismas variables en un archivo .env junto a package.json y reinicia npm run dev. El proyecto ya excluye ese archivo de Git. Variables de entorno en Next.js

Prueba con un buzón de prueba. Entra a la bandeja, registra y verifica el correo alternativo, cierra sesión y usa ¿Olvidó su contraseña?.
