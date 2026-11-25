# Sky Dragons

Sistema web para organizar un equipo de bote dragón. Reúne en un solo lugar a los integrantes, entrenamientos, resultados, datos de Concept2, evaluaciones físicas, finanzas y equipo.

## Contenido

- [Funciones](#qué-incluye)
- [Roles](#roles)
- [Inicio local](#inicio-rápido-en-windows)
- [Acceso desde teléfonos](#acceso-desde-teléfonos-fuera-de-casa)
- [Despliegue en un VPS](#publicar-en-un-vps)
- [Concept2 y cuentas](#configurar-concept2-logbook)
- [Datos y migraciones](#datos-y-migraciones)
- [Aplicación móvil](#app-web-android-y-ios)
- [API](#api)

## Qué incluye

- **Integrantes:** ficha técnica con foto, fecha de nacimiento, edad, lado de remo, equipos anteriores, palmarés y biografía.
- **Entrenamientos:** calendario, sesiones, asistencia y notas de preparación.
- **Concept2 Logbook / ErgData:** conexión autorizada por el atleta, importación de marcas y consulta de resultados por integrante.
- **Métricas físicas:** mediciones fechadas como peso, porcentaje de grasa, pulso en reposo, flexibilidad, salto, plancha y pruebas personalizadas; incluye historial y gráfico.
- **Competencias y alineaciones:** resultados, medallero, tripulaciones DB12/DB22 y balance de peso por lado.
- **Finanzas:** cuotas, pagos, gastos, patrocinadores y reportes financieros.
- **Inventario y flota:** asignación de equipo, reservas y mantenimiento.
- **Accesos:** registro de usuarios, aprobación de cuentas y permisos por rol.
- **Instalación:** aplicación web instalable (PWA) y proyectos móviles con Capacitor para Android y iOS.

## Roles

| Rol | Acceso |
| --- | --- |
| Administrador | Administración completa de la aplicación y sus usuarios. |
| Capitán | Gestión deportiva: integrantes, entrenamientos, asistencia, Concept2, métricas físicas, competencias, alineaciones, inventario y flota. |
| Tesorero | Gestión de finanzas y acceso a reportes financieros. Puede consultar la información deportiva. |
| Lector | Consulta la información general y deportiva. No puede modificarla ni acceder a Finanzas. |

La interfaz muestra candados en los módulos restringidos. La API también valida los permisos antes de aceptar cambios.

## Tecnologías

- Interfaz: React, Vite y Lucide.
- API: Node.js, Express y JWT.
- Base de datos: MySQL 8 con Sequelize.
- Ejecución local y producción: Docker Compose.
- HTTPS en producción: Caddy.
- Aplicación móvil: Capacitor para Android y iOS.

## Inicio rápido en Windows

La forma recomendada para usar el sistema en tu computadora es Docker Desktop con Docker Compose.

1. Instala e inicia Docker Desktop.
2. Desde la carpeta del proyecto, copia el archivo de ejemplo:

    Copy-Item .env.home.example .env.home

3. Abre .env.home y reemplaza los valores REPLACE_WITH por valores propios. Conserva este archivo privado.
4. Si es una base de datos nueva, crea las tablas una sola vez:

    docker compose --env-file .env.home -f compose.home.yaml run --rm api npm run db:init-schema

5. Levanta el sistema:

    docker compose --env-file .env.home -f compose.home.yaml up -d --build

6. Abre http://localhost:8080. Comprueba la API en http://localhost:8080/api/health.

El primer administrador se crea con ADMIN_EMAIL y ADMIN_PASSWORD si la tabla de usuarios está vacía.

### Comandos útiles

Ver servicios activos:

    docker compose --env-file .env.home -f compose.home.yaml ps

Ver registros de la API:

    docker compose --env-file .env.home -f compose.home.yaml logs -f api

Actualizar la app tras cambiar el código:

    docker compose --env-file .env.home -f compose.home.yaml up -d --build

Detener los servicios conservando los datos:

    docker compose --env-file .env.home -f compose.home.yaml down

La base de datos persiste en el volumen Docker mysql_home_data. No uses down -v si quieres conservar la información.

## Acceso desde teléfonos fuera de casa

La configuración local publica la web solo en 127.0.0.1:8080 y no abre puertos del router. Para compartirla fuera de casa, puedes usar Tailscale Funnel:

1. Instala Tailscale en la computadora y activa Funnel para el puerto 8080:

    tailscale funnel --bg 8080

2. Tailscale te mostrará una dirección HTTPS para compartir.
3. Mantén la computadora, Docker Desktop y Tailscale encendidos, y evita que la computadora entre en suspensión.

La computadora y la conexión de casa quedan como puntos necesarios para que la app esté disponible. La dirección Funnel permite llegar al inicio de sesión; cada persona necesita su propia cuenta de Sky Dragons.

## Publicar en un VPS

La configuración compose.production.yaml usa Caddy para servir la web y la API por HTTPS. MySQL queda dentro de la red privada de Docker y no publica el puerto 3306.

Requisitos: un servidor Linux con Docker Engine y Docker Compose, un dominio apuntado al servidor y los puertos 80 y 443 habilitados.

1. Copia .env.production.example como .env.production.
2. Configura DOMAIN, DB_NAME, DB_USER, DB_PASS, MYSQL_ROOT_PASSWORD, JWT_SECRET, ADMIN_EMAIL y ADMIN_PASSWORD. Usa contraseñas y claves únicas; no publiques el archivo.
3. Para una base nueva y vacía, inicializa el esquema y levanta los servicios:

    docker compose --env-file .env.production -f compose.production.yaml run --rm api npm run db:init-schema
    docker compose --env-file .env.production -f compose.production.yaml up -d --build

4. Cuando DNS esté listo, Caddy solicitará y renovará el certificado HTTPS. Abre https://TU_DOMINIO.

Para una base existente, no ejecutes db:init-schema. Haz un respaldo y aplica solo las migraciones que todavía falten.

## Configurar Concept2 Logbook

La integración usa la autorización de Concept2 Logbook y solicita acceso de lectura al perfil y a los resultados; no conecta directamente por Bluetooth al monitor.

1. Registra una aplicación OAuth en Concept2.
2. Usa como callback la dirección exacta de la API más /api/ergdata/callback. Por ejemplo: https://TU_DOMINIO/api/ergdata/callback.
3. Configura CONCEPT2_CLIENT_ID, CONCEPT2_CLIENT_SECRET, CONCEPT2_REDIRECT_URI, FRONTEND_URL y CONCEPT2_TOKEN_KEY en el entorno privado de la API.
4. Genera CONCEPT2_TOKEN_KEY con una clave aleatoria de 32 bytes codificada en Base64:

    node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

5. En Concept2, selecciona al integrante, inicia la vinculación y completa la autorización en Logbook. Después, el capitán o administrador puede importar sesiones.

En la instalación local con Tailscale, FRONTEND_URL debe ser la URL HTTPS de Funnel y CONCEPT2_REDIRECT_URI debe apuntar a esa URL más /api/ergdata/callback. El callback configurado en Concept2 debe coincidir exactamente.

## Recuperar contraseña y crear cuentas

- En el inicio de sesión están los formularios para crear cuenta y recuperar contraseña.
- Los registros públicos quedan pendientes hasta que un administrador los aprueba.
- Para enviar enlaces de recuperación, configura RESEND_API_KEY y RESEND_FROM_EMAIL. El remitente debe estar verificado en Resend; FRONTEND_URL debe ser la URL pública de la app.
- Los enlaces de restablecimiento son de un solo uso y vencen a los 30 minutos.

## Datos y migraciones

En desarrollo, la API ajusta el esquema al iniciar cuando NODE_ENV no es production. En producción, el esquema se administra con archivos SQL versionados en src/migrations.

db:init-schema solo funciona con una base vacía: se detiene si ya encuentra tablas. Para una base existente:

1. Haz un respaldo de MySQL.
2. Comprueba qué tablas y columnas ya están presentes.
3. Aplica una sola vez las migraciones correspondientes a las funciones que aún no tenga esa base.
4. Despliega la nueva versión.

El proyecto no tiene un ejecutor automático ni una tabla de control de migraciones; no vuelvas a ejecutar una migración sin verificar primero su contenido y el estado de la base.

Migraciones incluidas:

- 20261122_sports_features.sql
- 20261122_lineup_reserves.sql
- 20261123_fleet_logbook.sql
- 20261123_member_availability.sql
- 20261123_race_medal_photos.sql
- 20261124_concept2_oauth.sql
- 20261124_concept2_workout_details.sql
- 20261124_erg_scores.sql
- 20261124_member_health.sql
- 20261124_member_profile_photos.sql
- 20261124_member_rowing_teams.sql
- 20261124_member_technical_profile.sql
- 20261124_password_reset_tokens.sql
- 20261124_payment_receipts.sql
- 20261124_physical_metrics.sql
- 20261124_training_category.sql
- 20261124_user_signup_approval.sql

Ejemplo en PowerShell para aplicar la migración de métricas físicas a la base local, una vez y después de confirmar que aún falta:

    Get-Content -Raw -Encoding utf8 src/migrations/20261124_physical_metrics.sql | docker compose --env-file .env.home -f compose.home.yaml exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'

## Copias de seguridad

El volumen de Docker conserva la base aunque detengas los contenedores, pero no sustituye una copia de seguridad. Guarda respaldos fuera de la computadora o del servidor y prueba que puedas restaurarlos.

Ejemplo para crear un volcado SQL local en PowerShell:

    docker compose --env-file .env.home -f compose.home.yaml exec -T db sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' > sky-dragons-backup.sql

No subas respaldos, archivos .env ni credenciales a GitHub.

## App web, Android y iOS

La web se puede instalar como PWA desde el navegador cuando se sirve por HTTPS. En Android, usa el botón Instalar app o el menú del navegador. En iPhone, abre la web en Safari y usa Compartir → Agregar a pantalla de inicio.

Para preparar los proyectos nativos, desde la carpeta frontend:

    Copy-Item .env.mobile.example .env.mobile
    npm install
    npm run mobile:sync

Configura VITE_API_URL con la URL HTTPS pública del servidor, sin usar localhost. Para abrir Android Studio:

    npm run mobile:android

Para abrir Xcode:

    npm run mobile:ios

Android requiere Android Studio y Android SDK. Compilar y firmar iOS requiere macOS con Xcode. La app instalada necesita internet para consultar y guardar datos.

## Desarrollo y comprobaciones

Para trabajar en la API fuera de Docker, se necesita Node.js 20 o superior y una base MySQL. Configura .env con las variables de .env.example y crea una base vacía con el nombre definido en DB_NAME. Por ejemplo:

    CREATE DATABASE sky_dragons CHARACTER SET utf8mb4;

Desde la raíz del proyecto, instala dependencias, prepara el esquema y arranca la API:

    npm install
    npm run db:init-schema
    npm run dev

La API queda en http://localhost:3000. Durante desarrollo, NODE_ENV distinto de production activa la sincronización de Sequelize. Para la interfaz, en otra terminal:

    cd frontend
    npm install
    npm run dev

Vite abre http://localhost:5173 y reenvía las solicitudes /api a http://127.0.0.1:3000.

Comandos disponibles:

- API: npm test
- Frontend: npm run build
- Frontend: npm run lint

La comprobación de salud de la API está en /api/health.

## API

Las rutas de datos requieren iniciar sesión y enviar el token como Authorization: Bearer TOKEN.

Autenticación:

- POST /api/auth/login
- POST /api/auth/signup
- POST /api/auth/forgot-password
- POST /api/auth/reset-password
- POST /api/auth/register (administrador)
- GET /api/auth/me

Recursos principales:

- /api/members
- /api/trainings
- /api/attendances
- /api/erg-scores
- /api/physical-metrics
- /api/competitions y /api/races
- /api/lineups y /api/lineup-seats
- /api/fee-plans, /api/payments, /api/expenses
- /api/sponsors y /api/sponsor-contributions
- /api/inventory-items y /api/inventory-assignments
- /api/fleet-assets, /api/fleet-maintenance y /api/fleet-bookings

Rutas especiales:

- POST /api/trainings/:id/attendance registra asistencia en bloque.
- GET /api/reports/dashboard devuelve un resumen deportivo.
- GET /api/reports/attendance devuelve porcentajes de asistencia.
- GET /api/reports/member-sport/:memberId devuelve el historial deportivo de un integrante.
- GET /api/reports/finance y /api/reports/member-account/:memberId muestran información financiera.
- POST /api/ergdata/connect/:memberId y POST /api/ergdata/sync/:memberId gestionan Concept2.
- GET /api/health comprueba que la API está activa.

## Estructura principal

- src/app.js: API, autenticación y permisos.
- src/models/index.js: modelos Sequelize y relaciones.
- src/routes/: rutas de autenticación, informes y Concept2.
- src/migrations/: cambios SQL para bases existentes.
- frontend/src/: interfaz React.
- frontend/android/ y frontend/ios/: proyectos Capacitor.
- compose.home.yaml: uso local de la web, API y MySQL.
- compose.production.yaml y Caddyfile: despliegue en servidor con HTTPS.

