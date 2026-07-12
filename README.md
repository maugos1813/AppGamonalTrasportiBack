# RegistrosGTBack

Backend de gestion de personal (choferes), flota y servicios para transporte. **FASE 1**: usuarios, autenticacion JWT y roles. **FASE 2**: documentos de choferes en Cloudflare R2 (bucket privado, URLs firmadas) con compresion de imagenes via Sharp. **FASE 3**: registro de vehiculos (targa, modelo, imagen, libreto, assicurazione, poliza, revision tecnica). **FASE 4**: registro de servicios de transporte (area EXTRAS_PIAZZA) con clientes, calculo automatico de totales y archivos adjuntos.

## Stack

Node.js (ES Modules) + Express + Prisma + PostgreSQL (Neon) + JWT + bcrypt + Zod + Resend + Cloudflare R2 (S3 SDK) + Sharp + Multer.

## 1. Instalar dependencias

```bash
npm install
```

## 2. Configurar variables de entorno

Copia `.env.example` a `.env` y completa los valores:

```bash
cp .env.example .env
```

| Variable | Descripcion |
|---|---|
| `PORT` | Puerto del servidor (default 4000) |
| `NODE_ENV` | `development` \| `production` \| `test` |
| `CORS_ORIGIN` | `*` o lista de origenes separados por coma |
| `DATABASE_URL` | Connection string de Neon PostgreSQL (con `?sslmode=require`) |
| `JWT_SECRET` | Cadena aleatoria larga (`openssl rand -hex 32`) |
| `JWT_EXPIRES_IN` | Ej: `7d` |
| `RESET_TOKEN_EXPIRES_MINUTES` | Minutos de validez del token de recuperacion de contrasena |
| `RESET_PASSWORD_URL` | URL del frontend donde el usuario completa el reset (recibe `?token=`) |
| `RESEND_API_KEY` | API key de Resend |
| `RESEND_FROM_EMAIL` | Remitente verificado en Resend, ej: `RegistrosGT <no-reply@tudominio.com>` |
| `R2_ACCOUNT_ID` | Account ID de Cloudflare (dashboard > R2) |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Credenciales del API Token de R2 (permiso "Object Read & Write") |
| `R2_BUCKET_NAME` | Nombre del bucket privado donde se guardan los documentos |
| `R2_SIGNED_URL_EXPIRES_SECONDS` | Minutos (en segundos) de validez de cada URL firmada, default 900 (15 min) |

### Crear el bucket de Cloudflare R2

1. En el dashboard de Cloudflare, andá a **R2 Object Storage** > **Create bucket**. Nombralo (ej. `registrosgt-documentos`) y dejalo **privado** (sin acceso publico).
2. Anda a **R2 > Manage API Tokens** > **Create API Token**. Elegi permiso **Object Read & Write**, y si podes, restringilo a ese bucket especifico.
3. Copiá el **Access Key ID** y **Secret Access Key** (el secret solo se muestra una vez).
4. El **Account ID** esta en la misma pantalla de R2 (o en la URL del dashboard).
5. Completá esos 4 valores + `R2_BUCKET_NAME` en tu `.env`.

Como el bucket es privado, la API nunca expone una URL publica fija: cada vez que pedis un documento, el backend genera una URL firmada temporal (expira segun `R2_SIGNED_URL_EXPIRES_SECONDS`).

## 3. Crear la base de datos y correr las migraciones

Con `DATABASE_URL` apuntando a tu proyecto de Neon:

```bash
npx prisma migrate dev --name init
npx prisma generate
```

Esto crea la tabla `users` (enums `Area`, `Cargo`, `Estado`), la tabla `documentos` (enum `TipoDocumento`, relacionada a `users` por `usuarioId`), la tabla `vehiculos` (enum `EstadoVehiculo`), y las tablas `clients`, `records` (enum `RecordStatus`, relacionada a `users`/`vehiculos`/`clients`) y `record_files` (enum `TipoArchivoRecord`, relacionada a `records`).

## 4. Levantar el servidor

```bash
npm run dev
```

Verifica que responde en `GET http://localhost:4000/api/health`.

## 5. Probar el flujo de autenticacion (curl)

**Registro** (siempre crea un CHOFER activo, sin importar lo que se envie en `cargo`/`estado`):

```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Juan",
    "apellido": "Perez",
    "area": "DHL",
    "fechaNacimiento": "1995-04-10",
    "numeroCelular": "+39 333 1234567",
    "correoElectronico": "juan@example.com",
    "password": "SuperSegura123"
  }'
```

**Login**:

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "correoElectronico": "juan@example.com", "password": "SuperSegura123" }'
```

Guarda el `token` de la respuesta y usalo en las siguientes llamadas:

```bash
curl http://localhost:4000/api/auth/me -H "Authorization: Bearer <TOKEN>"
```

**Recuperacion de contrasena**:

```bash
curl -X POST http://localhost:4000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{ "correoElectronico": "juan@example.com" }'
```

Revisa el email recibido (via Resend), copia el `token` del enlace y:

```bash
curl -X POST http://localhost:4000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{ "token": "<TOKEN_DEL_EMAIL>", "newPassword": "OtraSegura456" }'
```

### Convertir el primer usuario en OWNER

El registro publico siempre crea `CHOFER`. Para tener el primer `OWNER`, registra un usuario normal y luego actualiza su cargo directamente en la base de datos (unica vez, manualmente):

```bash
npx prisma studio
```

Abre la tabla `users` y cambia `cargo` a `OWNER` para tu usuario inicial. A partir de ahi, ese OWNER puede crear ADMIN/CHOFER desde `POST /api/users`.

## 6. Probar documentos (curl)

**Subir un documento** (multipart/form-data; como CHOFER, `usuarioId` se ignora y se fuerza al propio usuario; como OWNER/ADMIN es obligatorio indicarlo):

```bash
curl -X POST http://localhost:4000/api/documents \
  -H "Authorization: Bearer <TOKEN>" \
  -F "tipoDocumento=CARTA_IDENTITA" \
  -F "fechaScadenza=2030-01-01" \
  -F "archivo=@/ruta/a/tu/documento.pdf"
```

**Listar documentos** (OWNER/ADMIN pueden filtrar con `?usuarioId=`, CHOFER siempre ve solo los propios):

```bash
curl http://localhost:4000/api/documents -H "Authorization: Bearer <TOKEN>"
```

**Ver uno, actualizar metadata o reemplazar el archivo, y borrar**:

```bash
curl http://localhost:4000/api/documents/<ID> -H "Authorization: Bearer <TOKEN>"

curl -X PATCH http://localhost:4000/api/documents/<ID> \
  -H "Authorization: Bearer <TOKEN>" \
  -F "fechaScadenza=2031-06-15"

curl -X DELETE http://localhost:4000/api/documents/<ID> -H "Authorization: Bearer <TOKEN>"
```

`archivoUrl` en la respuesta es una URL firmada temporal — se recalcula en cada request, no se persiste.

## 7. Probar vehiculos (curl)

**Crear un vehiculo** (solo OWNER/ADMIN; `imagen`, `libreto` y `assicurazione` son opcionales, se pueden cargar despues con un `PATCH`):

```bash
curl -X POST http://localhost:4000/api/vehiculos \
  -H "Authorization: Bearer <TOKEN_OWNER_O_ADMIN>" \
  -F "targa=AB123CD" \
  -F "modelo=Fiat Ducato" \
  -F "area=DHL" \
  -F "poliza=2027-03-01" \
  -F "rTecnica=2026-11-15"
```

**Completar los archivos despues** (los 3 campos son independientes, podes mandar uno, dos o los tres juntos):

```bash
curl -X PATCH http://localhost:4000/api/vehiculos/<ID> \
  -H "Authorization: Bearer <TOKEN_OWNER_O_ADMIN>" \
  -F "imagen=@/ruta/a/foto.jpg" \
  -F "libreto=@/ruta/a/libreto.pdf" \
  -F "assicurazione=@/ruta/a/assicurazione.pdf"
```

**Listar y ver el detalle** (cualquier usuario autenticado, incluido CHOFER):

```bash
curl http://localhost:4000/api/vehiculos -H "Authorization: Bearer <TOKEN>"
curl http://localhost:4000/api/vehiculos/<ID> -H "Authorization: Bearer <TOKEN>"
```

**Borrar** (solo OWNER/ADMIN; borra tambien los archivos que tenga cargados en R2):

```bash
curl -X DELETE http://localhost:4000/api/vehiculos/<ID> -H "Authorization: Bearer <TOKEN_OWNER_O_ADMIN>"
```

`imagenUrl`, `libretoUrl` y `assicurazioneUrl` son URLs firmadas temporales (o `null` si ese archivo todavia no se cargo).

## 8. Probar registros de servicios / clientes (curl)

**Crear un cliente** (solo OWNER/ADMIN; `GET` esta abierto a cualquier autenticado para el selector del frontend):

```bash
curl -X POST http://localhost:4000/api/clients \
  -H "Authorization: Bearer <TOKEN_OWNER_O_ADMIN>" -H "Content-Type: application/json" \
  -d '{ "nombre": "DHL Express" }'
```

**Crear un registro de servicio** (solo OWNER/ADMIN; `driverId` puede ser cualquier usuario ACTIVO, no solo CHOFER):

```bash
curl -X POST http://localhost:4000/api/records \
  -H "Authorization: Bearer <TOKEN_OWNER_O_ADMIN>" -H "Content-Type: application/json" \
  -d '{
    "driverId": "<ID_USUARIO>",
    "vehicleId": "<ID_VEHICULO>",
    "clientId": "<ID_CLIENTE>",
    "fechaServicio": "2026-03-15T08:00:00.000Z",
    "eta": "2026-03-15T14:00:00.000Z",
    "descripcion": "Traslado urgente",
    "codigo": "EP-2026-0001",
    "destinazione": "Torino",
    "kilometros": 500,
    "precioKm": 0.46,
    "areaC": 20,
    "costoEspera": 15,
    "costoTraforoFrejusBrennero": 40,
    "peajes": 25,
    "vignetta": 10,
    "costoHotel": 0,
    "costoCombustible": 80
  }'
```

La respuesta incluye `totalKm` (`kilometros * precioKm`) y `total` (suma de todos los costos, sin incluir `costoCombustible` ni `pagoRecibido`) — ninguno de los dos se guarda en la base, se calculan en cada respuesta.

**Filtrar por fecha** (cualquier combinacion año / año+mes / año+mes+dia):

```bash
curl http://localhost:4000/api/records/2026 -H "Authorization: Bearer <TOKEN>"
curl http://localhost:4000/api/records/2026/3 -H "Authorization: Bearer <TOKEN>"
curl http://localhost:4000/api/records/2026/3/15 -H "Authorization: Bearer <TOKEN>"
```

**Vista de un CHOFER**: si el usuario autenticado es CHOFER, `GET /api/records`, `/api/records/:year...` y `/api/records/:id` solo devuelven los registros donde el es `driverId`, y la respuesta **no incluye ningun campo economico** (`kilometros`, `precioKm`, `totalKm`, costos, `pagoRecibido`, `clienteConfirmado`, `total`). Un CHOFER puede hacer `PATCH` sobre su propio registro, pero solo se aplican estos campos si vienen en el body — cualquier otro campo se ignora silenciosamente:

```bash
curl -X PATCH http://localhost:4000/api/records/<ID> \
  -H "Authorization: Bearer <TOKEN_CHOFER>" -H "Content-Type: application/json" \
  -d '{ "horasDia": 6.5, "horasNoche": 1, "tiempoEspera": 2, "estado": "IN_CONSEGNA", "comentarios": "Todo en orden" }'
```

**Archivos del registro** (multipart/form-data; un CHOFER solo puede subir `FOTO_ENTREGA` a sus propios registros, OWNER/ADMIN pueden subir cualquier tipo a cualquier registro):

```bash
curl -X POST http://localhost:4000/api/records/<ID>/files \
  -H "Authorization: Bearer <TOKEN>" \
  -F "tipoArchivo=FOTO_ENTREGA" \
  -F "archivo=@/ruta/a/foto.jpg"

curl http://localhost:4000/api/records/<ID>/files -H "Authorization: Bearer <TOKEN>"

curl -X DELETE http://localhost:4000/api/files/<FILE_ID> -H "Authorization: Bearer <TOKEN_OWNER_O_ADMIN>"
```

## Endpoints

```
POST   /api/auth/register         publico
POST   /api/auth/login            publico
GET    /api/auth/me               autenticado
POST   /api/auth/forgot-password  publico
POST   /api/auth/reset-password   publico (requiere token valido)

GET    /api/users                 OWNER, ADMIN
GET    /api/users/:id             OWNER, ADMIN, o el propio usuario
POST   /api/users                 OWNER, ADMIN
PATCH  /api/users/:id             OWNER, ADMIN, o el propio usuario (campos limitados)
DELETE /api/users/:id             OWNER, ADMIN

POST   /api/documents             CHOFER (propio), OWNER, ADMIN (multipart/form-data)
GET    /api/documents             OWNER, ADMIN (todos, filtro ?usuarioId=); CHOFER (solo propios)
GET    /api/documents/:id         dueño del documento, OWNER, ADMIN
PATCH  /api/documents/:id         dueño del documento, OWNER, ADMIN (multipart opcional)
DELETE /api/documents/:id         dueño del documento, OWNER, ADMIN

POST   /api/vehiculos             OWNER, ADMIN (multipart/form-data, archivos opcionales)
GET    /api/vehiculos             cualquier autenticado (incluido CHOFER, solo lectura)
GET    /api/vehiculos/:id         cualquier autenticado (incluido CHOFER, solo lectura)
PATCH  /api/vehiculos/:id         OWNER, ADMIN (multipart opcional)
DELETE /api/vehiculos/:id         OWNER, ADMIN

GET    /api/clients               cualquier autenticado
POST   /api/clients               OWNER, ADMIN
PATCH  /api/clients/:id           OWNER, ADMIN
DELETE /api/clients/:id           OWNER, ADMIN

POST   /api/records                    OWNER, ADMIN
GET    /api/records                    OWNER, ADMIN (todos); CHOFER (solo propios, vista redactada)
GET    /api/records/:year              idem, filtrado por año
GET    /api/records/:year/:month       idem, filtrado por año+mes
GET    /api/records/:year/:month/:day  idem, filtrado por año+mes+dia
GET    /api/records/:id                dueño del registro (CHOFER, redactado), OWNER, ADMIN
PATCH  /api/records/:id                dueño del registro (CHOFER, campos limitados), OWNER, ADMIN (todos los campos)
DELETE /api/records/:id                OWNER, ADMIN

POST   /api/records/:id/files          dueño del registro (CHOFER, solo FOTO_ENTREGA), OWNER, ADMIN (cualquier tipo)
GET    /api/records/:id/files          dueño del registro (CHOFER), OWNER, ADMIN
DELETE /api/files/:id                  OWNER, ADMIN
```

Tipos de documento validos (`tipoDocumento`): `CARTA_IDENTITA`, `PASSAPORTO`, `SOGGIORNO`, `PATENTE`, `TRADUZIONE_PATENTE`, `CODICE_FISCALE`, `CONTRATO`, `UNILAV`, `PERMESSO_TRASPORTO`, `TREDICESIMA_QUATTORDICESIMA`, `RESPONSIVAS`.

Estados validos de vehiculo (`estado`): `DISPONIBLE`, `EN_MANTENIMIENTO`, `FUERA_DE_SERVICIO`.

Estados validos de un registro (`estado` en `Record`): `CONSEGNATO`, `IN_CONSEGNA`, `IN_SOSPESO`, `RITIRATO`, `ANNULLATO`, `RISCHEDULATO`.

Tipos de archivo validos de un registro (`tipoArchivo` en `RecordFile`): `CMR`, `FOTO_ENTREGA`, `FACTURA`, `COMPROBANTE`, `OTRO`.

Los documentos no estan atados al cargo `CHOFER`: cualquier usuario (OWNER, ADMIN o CHOFER) puede tener documentos asociados a su `usuarioId`. Lo mismo aplica a `driverId` en `Record`: no se restringe por `cargo`, solo se exige que el usuario este `ACTIVO`.

## Deploy en Render

1. Crea un nuevo **Web Service** en Render apuntando a este repositorio.
2. **Build Command**: `npm install && npx prisma generate && npx prisma migrate deploy`
3. **Start Command**: `npm start`
4. Configura en el dashboard de Render todas las variables listadas arriba (usa el `DATABASE_URL` de Neon y las credenciales reales de R2).
5. Render asigna su propio `PORT`; la app ya lee `process.env.PORT` a traves de `env.js`, no hace falta tocarlo.
6. Sharp descarga el binario correcto para Linux durante `npm install` en el build de Render automaticamente, no requiere configuracion extra.

## Estructura del proyecto

```
prisma/schema.prisma       User, Documento, Vehiculo, Client, Record, RecordFile + enums
src/
  config/                  env, prisma client, resend client, cliente R2 (S3)
  models/                  unica capa que consulta la base de datos (Prisma)
  services/                logica de negocio (auth, usuarios, documentos, vehiculos, clientes, records, storage R2)
  controllers/              capa HTTP (request/response)
  routes/                   definicion de endpoints + middlewares por ruta
  middlewares/               authenticate, authorize, validate, errorHandler, upload/vehicleUpload (multer)
  validators/                 schemas Zod
  utils/                      AppError, asyncHandler, jwt, password, resetToken, imageProcessor (Sharp), dateRange
  emails/                     plantilla del email de recuperacion de contrasena
```
