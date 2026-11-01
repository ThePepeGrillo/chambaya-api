# ChambaYa API

Backend de ChambaYa, una plataforma para conseguir trabajos temporales: los empleadores publican ofertas y los trabajadores se postulan a ellas.

Está hecha en Node.js con TypeScript y sin base de datos. Todo se guarda en arrays en memoria, los datos se borran cada vez que se reinicia el servidor.

## Cómo correrla

Hace falta Node.js 18 o superior.

```
npm install
npm start
```

El servidor queda en `http://localhost:3000/api/v1`.

Scripts disponibles:

- `npm start`: arranca el servidor
- `npm run dev`: arranca el servidor y lo reinicia al guardar cambios
- `npm run build`: compila a la carpeta `dist`
- `npm run start:prod`: corre el código compilado
- `npm run typecheck`: revisa los tipos

Dependencias: ninguna para correr el proyecto (solo se usan módulos de Node). Para desarrollo se usan `typescript`, `tsx` y `@types/node`.

## Endpoints

Implementados:

```
POST   /api/v1/auth/register                  registrar empleador o trabajador
POST   /api/v1/auth/login                     iniciar sesión (devuelve el token)
POST   /api/v1/ofertas                        publicar oferta (empleador)
GET    /api/v1/ofertas                        listar ofertas abiertas, con filtros
GET    /api/v1/ofertas/:id                    detalle de una oferta
POST   /api/v1/ofertas/:id/postulaciones      postularse (trabajador)
GET    /api/v1/ofertas/:id/postulaciones      ver postulantes (empleador dueño)
PATCH  /api/v1/postulaciones/:id/estado       aceptar o rechazar (empleador dueño)
PATCH  /api/v1/postulaciones/:id/cancelar     cancelar participación (trabajador)
```

Solo documentado, sin implementar:

```
POST   /api/v1/postulaciones/:id/calificaciones   calificar al terminar el trabajo
```
## Reglas

- Una oferta necesita título, tipo, descripción, fecha futura, duración, pago, ubicación y cupos.
- No se pueden aceptar más postulantes que cupos. Cuando se llenan, la oferta pasa a "cubierta" y deja de salir en la lista.
- Si alguien aceptado cancela, la oferta se vuelve a abrir. Si faltaban menos de 24 horas, queda como cancelación tardía.
- Las contraseñas se guardan con hash.

## Pruebas

Las pruebas están en una colección de Postman: postman/ChambaYa.postman_collection.json.

Encender el servidor con npm start.
En Postman, importar el archivo con "Import".
Clic derecho sobre la colección, "Run collection", y correr las carpetas 1, 2 y 3.

La carpeta 4 es el endpoint que solo está documentado,el servidor responde 404.
