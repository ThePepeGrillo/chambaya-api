# Taller 3

Está hecho con **Node.js + TypeScript**, sin base de datos: los datos viven en arrays en memoria y se borran cada vez que se reinicia el servidor.

## Requisitos

- Node.js 18 o superior (probado con Node 22)
- npm

## Cómo correr el proyecto

```bash
npm install
npm run dev        # servidor con recarga automática
#o
npm start          # servidor normal
```

El servidor queda en `http://localhost:3000/api/v1`.

### Scripts de npm

Script 

`npm run dev`  Ejecuta `src/server.ts` con `tsx watch` (recarga al guardar) 
`npm start` Ejecuta `src/server.ts` con `tsx` 
 `npm run build`  Compila TypeScript a `dist/` 
 `npm run start:prod`  Ejecuta el código compilado (`node dist/server.js`) 
 `npm run typecheck`  Revisa los tipos sin generar archivos 

### Dependencias

- Producción: ninguna. Se usan solo módulos nativos de Node (`node:http` y `node:crypto`).
- Desarrollo: `typescript`, `tsx` y `@types/node`.

### Variables de entorno (opcionales)

| `PORT` | `3000` | Puerto del servidor |
| `JWT_SECRET` | clave de desarrollo | Clave para firmar los tokens |

## Estructura

```
src/
  server.ts     Arranque del servidor
  http.ts       Enrutador, autenticación por rol, lectura de JSON y manejo de errores
  handlers.ts   Lógica y validaciones de cada endpoint
  auth.ts       Hash de contraseñas (scrypt) y token firmado HS256 (estilo JWT)
  store.ts      Arrays en memoria
  types.ts      Modelos y DTOs
postman/
  ChambaYa.postman_collection.json
```

## Endpoints

Todas las rutas empiezan con `/api/v1`. Los errores tienen la forma `{ "error": "mensaje" }`. Las rutas protegidas requieren `Authorization: Bearer <token>`.

### Implementados


1  POST  `/auth/register`  público  Registra un empleador o un trabajador
2 POST `/auth/login` público  Devuelve el token 
3 POST `/ofertas` empleador  Publica una oferta 
4 GET `/ofertas` público Lista ofertas abiertas con filtros `fecha`, `ubicacion`, `tipo`, `page`, `limit` 
5 GET `/ofertas/:id` público Detalle de una oferta 
6 POST `/ofertas/:id/postulaciones` trabajador  Se postula a una oferta 
7 GET `/ofertas/:id/postulaciones` empleador dueño  Ve los postulantes 
8 PATCH `/postulaciones/:id/estado` empleador dueño  Acepta o rechaza; al llenar los cupos la oferta pasa a `cubierta` 
9 PATCH `/postulaciones/:id/cancelar`  trabajador dueño  Cancela con motivo; si faltan menos de 24 h queda como cancelación tardía y la oferta se reabre 

### Solo documentado

10  POST `/postulaciones/:id/calificaciones`

## Reglas de negocio implementadas

- Una oferta exige titulo, tipo,descripcion, fecha (futura), duracionHoras, pago, ubicacion y cupos.
- No se puede aceptar a más postulantes que los cupos. Al completarse, la oferta pasa a cubierta y deja de aparecer en GET /ofertas.
- Los postulantes sobrantes quedan pendientes; el empleador puede rechazarlos o aceptarlos si se libera un cupo.
- Si un trabajador aceptado cancela, la oferta vuelve a abierta. Si faltan menos de 24 horas se marca cancelacionTardia: true.
- Aceptar, rechazar y cancelar generan notificaciones internas que se guardan en memoria; por ahora no hay un endpoint para consultarlas.
- Un trabajador no puede postularse dos veces a la misma oferta, salvo que haya cancelado antes.
- Las contraseñas se guardan con hash (scrypt con sal) y nunca se devuelven en las respuestas.

## Ejemplos con curl

```bash
BASE=http://localhost:3000/api/v1

# 1. Registrar un empleador y un trabajador
curl -X POST $BASE/auth/register -H "Content-Type: application/json" \
  -d '{"nombre":"Restaurante El Sol","correo":"sol@mail.com","password":"123456","rol":"empleador"}'
curl -X POST $BASE/auth/register -H "Content-Type: application/json" \
  -d '{"nombre":"Ana Gómez","correo":"ana@mail.com","password":"123456","rol":"trabajador","habilidades":["mesero"]}'

# 2. Iniciar sesión (copia el token de cada respuesta)
curl -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d '{"correo":"sol@mail.com","password":"123456"}'
curl -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d '{"correo":"ana@mail.com","password":"123456"}'

# 3. Publicar una oferta (la fecha debe ser futura; ajústala si ya pasó)
curl -X POST $BASE/ofertas -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN_EMPLEADOR" \
  -d '{"titulo":"Meseros fin de semana","tipo":"mesero","descripcion":"Evento de 100 personas","fecha":"2026-12-15T20:00:00Z","duracionHoras":6,"pago":80000,"ubicacion":"Chapinero, Bogotá","cupos":1}'

# 4. Buscar ofertas
curl "$BASE/ofertas?tipo=mesero&ubicacion=chapinero"

# 5. Postularse
curl -X POST $BASE/ofertas/o-1/postulaciones -H "Authorization: Bearer TOKEN_TRABAJADOR"

# 6. Ver postulantes y aceptar
curl $BASE/ofertas/o-1/postulaciones -H "Authorization: Bearer TOKEN_EMPLEADOR"
curl -X PATCH $BASE/postulaciones/p-1/estado -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN_EMPLEADOR" \
  -d '{"estado":"aceptada"}'

# 7. Cancelar la participación
curl -X PATCH $BASE/postulaciones/p-1/cancelar -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN_TRABAJADOR" \
  -d '{"motivo":"Imprevisto familiar"}'
```

Los ids tienen el formato `u-1` (usuarios), `o-1` (ofertas), `p-1` (postulaciones) y `n-1` (notificaciones), y se numeran en orden de creación.

