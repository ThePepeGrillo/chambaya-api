import { hashPassword, signToken, verifyPassword } from "./auth";
import { Context, HttpError, Result, route } from "./http";
import { nextId, notificaciones, ofertas, postulaciones, usuarios } from "./store";
import {
  CambiarEstadoDto,
  CancelarDto,
  CrearOfertaDto,
  LoginDto,
  Oferta,
  Postulacion,
  RegisterDto,
  Usuario,
} from "./types";

// ---------- Validaciones ----------
function objeto(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new HttpError(400, "El cuerpo debe ser un objeto JSON");
  }
  return body as Record<string, unknown>;
}

function texto(b: Record<string, unknown>, campo: string): string {
  const v = b[campo];
  if (typeof v !== "string" || v.trim() === "") {
    throw new HttpError(400, `El campo '${campo}' es obligatorio y debe ser texto`);
  }
  return v.trim();
}

function textoOpcional(b: Record<string, unknown>, campo: string): string | undefined {
  const v = b[campo];
  if (v === undefined) return undefined;
  if (typeof v !== "string") throw new HttpError(400, `El campo '${campo}' debe ser texto`);
  return v.trim();
}

function numeroPositivo(b: Record<string, unknown>, campo: string): number {
  const v = b[campo];
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
    throw new HttpError(400, `El campo '${campo}' es obligatorio y debe ser un número mayor que 0`);
  }
  return v;
}

function enteroPositivoQuery(raw: string | null, defecto: number, nombre: string, max?: number): number {
  if (raw === null) return defecto;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || (max !== undefined && n > max)) {
    throw new HttpError(400, `El parámetro '${nombre}' debe ser un entero entre 1 y ${max ?? "∞"}`);
  }
  return n;
}

// ---------- Vistas y utilidades ----------
const contarAceptados = (ofertaId: string): number =>
  postulaciones.filter((p) => p.ofertaId === ofertaId && p.estado === "aceptada").length;

const ofertaView = (o: Oferta) => ({ ...o, aceptados: contarAceptados(o.id) });

const usuarioPublico = (u: Usuario) => {
  const { passwordHash: _omitido, ...resto } = u;
  return resto;
};

function buscarOferta(id: string): Oferta {
  const o = ofertas.find((x) => x.id === id);
  if (!o) throw new HttpError(404, "Oferta no encontrada");
  return o;
}

function buscarPostulacion(id: string): Postulacion {
  const p = postulaciones.find((x) => x.id === id);
  if (!p) throw new HttpError(404, "Postulación no encontrada");
  return p;
}

function notificar(usuarioId: string, tipo: "aceptacion" | "rechazo" | "cancelacion", mensaje: string): void {
  notificaciones.push({
    id: nextId("n"),
    usuarioId,
    tipo,
    mensaje,
    leida: false,
    fecha: new Date().toISOString(),
  });
}

const usuarioActual = (ctx: Context): string => (ctx.user as NonNullable<Context["user"]>).sub;

// ---------- 1. POST /auth/register ----------
function register({ body }: Context): Result {
  const b = objeto(body);
  const nombre = texto(b, "nombre");
  const correo = texto(b, "correo").toLowerCase();
  const password = texto(b, "password");
  const rol = b.rol;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw new HttpError(400, "El correo no tiene un formato válido");
  if (password.length < 6) throw new HttpError(400, "La contraseña debe tener mínimo 6 caracteres");
  if (rol !== "empleador" && rol !== "trabajador") {
    throw new HttpError(400, "El campo 'rol' debe ser 'empleador' o 'trabajador'");
  }
  if (b.habilidades !== undefined && !(Array.isArray(b.habilidades) && b.habilidades.every((h) => typeof h === "string"))) {
    throw new HttpError(400, "El campo 'habilidades' debe ser una lista de textos");
  }
  if (usuarios.some((u) => u.correo === correo)) throw new HttpError(409, "Ya existe un usuario con ese correo");

  const dto: RegisterDto = {
    nombre,
    correo,
    password,
    rol,
    nit: textoOpcional(b, "nit"),
    direccion: textoOpcional(b, "direccion"),
    habilidades: b.habilidades as string[] | undefined,
    disponibilidad: textoOpcional(b, "disponibilidad"),
  };

  const usuario: Usuario = {
    id: nextId("u"),
    nombre: dto.nombre,
    correo: dto.correo,
    passwordHash: hashPassword(dto.password),
    rol: dto.rol,
    verificado: false,
    ...(dto.rol === "empleador"
      ? { nit: dto.nit, direccion: dto.direccion }
      : { habilidades: dto.habilidades ?? [], disponibilidad: dto.disponibilidad }),
  };
  usuarios.push(usuario);
  return { status: 201, body: usuarioPublico(usuario) };
}

// ---------- 2. POST /auth/login ----------
function login({ body }: Context): Result {
  const b = objeto(body);
  const dto: LoginDto = { correo: texto(b, "correo").toLowerCase(), password: texto(b, "password") };
  const usuario = usuarios.find((u) => u.correo === dto.correo);
  if (!usuario || !verifyPassword(dto.password, usuario.passwordHash)) {
    throw new HttpError(401, "Correo o contraseña incorrectos");
  }
  return {
    status: 200,
    body: {
      token: signToken(usuario.id, usuario.rol),
      usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
    },
  };
}

// ---------- 3. POST /ofertas ----------
function crearOferta(ctx: Context): Result {
  const b = objeto(ctx.body);
  const fecha = texto(b, "fecha");
  const ms = Date.parse(fecha);
  if (Number.isNaN(ms)) throw new HttpError(400, "El campo 'fecha' debe ser una fecha ISO 8601 válida");
  if (ms <= Date.now()) throw new HttpError(400, "La fecha de la oferta debe ser futura");

  const cupos = b.cupos;
  if (typeof cupos !== "number" || !Number.isInteger(cupos) || cupos < 1) {
    throw new HttpError(400, "El campo 'cupos' es obligatorio y debe ser un entero mayor o igual a 1");
  }

  const dto: CrearOfertaDto = {
    titulo: texto(b, "titulo"),
    tipo: texto(b, "tipo"),
    descripcion: texto(b, "descripcion"),
    fecha: new Date(ms).toISOString(),
    duracionHoras: numeroPositivo(b, "duracionHoras"),
    pago: numeroPositivo(b, "pago"),
    ubicacion: texto(b, "ubicacion"),
    cupos,
  };

  const oferta: Oferta = { id: nextId("o"), empleadorId: usuarioActual(ctx), ...dto, estado: "abierta" };
  ofertas.push(oferta);
  return { status: 201, body: ofertaView(oferta) };
}

// ---------- 4. GET /ofertas ----------
function listarOfertas({ query }: Context): Result {
  const page = enteroPositivoQuery(query.get("page"), 1, "page");
  const limit = enteroPositivoQuery(query.get("limit"), 10, "limit", 50);

  const fecha = query.get("fecha");
  if (fecha !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(fecha)))) {
    throw new HttpError(400, "El parámetro 'fecha' debe tener formato YYYY-MM-DD");
  }
  const ubicacion = query.get("ubicacion")?.toLowerCase();
  const tipo = query.get("tipo")?.toLowerCase();

  const filtradas = ofertas
    .filter((o) => o.estado === "abierta")
    .filter((o) => (fecha ? o.fecha.slice(0, 10) === fecha : true))
    .filter((o) => (ubicacion ? o.ubicacion.toLowerCase().includes(ubicacion) : true))
    .filter((o) => (tipo ? o.tipo.toLowerCase().includes(tipo) : true))
    .sort((a, b) => Date.parse(a.fecha) - Date.parse(b.fecha));

  const data = filtradas.slice((page - 1) * limit, page * limit).map(ofertaView);
  const body: Record<string, unknown> = { data, page, limit, total: filtradas.length };
  if (filtradas.length === 0) body.sugerencia = "No hay resultados. Amplía el rango de búsqueda (fecha, ubicación o tipo).";
  return { status: 200, body };
}

// ---------- 5. GET /ofertas/:id ----------
function detalleOferta({ params }: Context): Result {
  return { status: 200, body: ofertaView(buscarOferta(params.id)) };
}

// ---------- 6. POST /ofertas/:id/postulaciones ----------
function postularse(ctx: Context): Result {
  const oferta = buscarOferta(ctx.params.id);
  const trabajadorId = usuarioActual(ctx);
  if (oferta.estado === "cubierta") throw new HttpError(409, "La oferta ya está cubierta");
  const yaPostulado = postulaciones.some(
    (p) => p.ofertaId === oferta.id && p.trabajadorId === trabajadorId && p.estado !== "cancelada",
  );
  if (yaPostulado) throw new HttpError(409, "Ya te postulaste a esta oferta");

  const postulacion: Postulacion = {
    id: nextId("p"),
    ofertaId: oferta.id,
    trabajadorId,
    estado: "pendiente",
    fechaPostulacion: new Date().toISOString(),
    cancelacionTardia: false,
  };
  postulaciones.push(postulacion);
  return { status: 201, body: postulacion };
}

// ---------- 7. GET /ofertas/:id/postulaciones ----------
function listarPostulantes(ctx: Context): Result {
  const oferta = buscarOferta(ctx.params.id);
  if (oferta.empleadorId !== usuarioActual(ctx)) throw new HttpError(403, "Esta oferta no te pertenece");

  const estado = ctx.query.get("estado");
  if (estado !== null && !["pendiente", "aceptada", "rechazada", "cancelada"].includes(estado)) {
    throw new HttpError(400, "El parámetro 'estado' no es válido");
  }

  const data = postulaciones
    .filter((p) => p.ofertaId === oferta.id && (estado ? p.estado === estado : true))
    .map((p) => {
      const t = usuarios.find((u) => u.id === p.trabajadorId);
      return {
        id: p.id,
        estado: p.estado,
        fechaPostulacion: p.fechaPostulacion,
        trabajador: {
          id: p.trabajadorId,
          nombre: t?.nombre ?? "Desconocido",
          habilidades: t?.habilidades ?? [],
          disponibilidad: t?.disponibilidad,
          calificacionPromedio: null, // las calificaciones están solo documentadas (endpoint 10)
        },
      };
    });
  return { status: 200, body: { data } };
}

// ---------- 8. PATCH /postulaciones/:id/estado ----------
function cambiarEstado(ctx: Context): Result {
  const postulacion = buscarPostulacion(ctx.params.id);
  const oferta = buscarOferta(postulacion.ofertaId);
  if (oferta.empleadorId !== usuarioActual(ctx)) throw new HttpError(403, "Esta oferta no te pertenece");

  const b = objeto(ctx.body);
  if (b.estado !== "aceptada" && b.estado !== "rechazada") {
    throw new HttpError(400, "El campo 'estado' debe ser 'aceptada' o 'rechazada'");
  }
  const dto: CambiarEstadoDto = { estado: b.estado };

  if (postulacion.estado !== "pendiente") {
    throw new HttpError(409, `La postulación ya está '${postulacion.estado}' y no se puede cambiar`);
  }

  const empleador = usuarios.find((u) => u.id === oferta.empleadorId);
  if (dto.estado === "aceptada") {
    if (contarAceptados(oferta.id) >= oferta.cupos) {
      throw new HttpError(409, "Los cupos de la oferta ya están completos; el postulante queda en espera");
    }
    postulacion.estado = "aceptada";
    if (contarAceptados(oferta.id) >= oferta.cupos) oferta.estado = "cubierta";
    notificar(
      postulacion.trabajadorId,
      "aceptacion",
      `Fuiste aceptado en "${oferta.titulo}" de ${empleador?.nombre ?? "el empleador"}. Fecha: ${oferta.fecha}. Lugar: ${oferta.ubicacion}.`,
    );
  } else {
    postulacion.estado = "rechazada";
    notificar(
      postulacion.trabajadorId,
      "rechazo",
      `Tu postulación a "${oferta.titulo}" de ${empleador?.nombre ?? "el empleador"} fue rechazada.`,
    );
  }
  return { status: 200, body: { postulacion, oferta: ofertaView(oferta) } };
}

// ---------- 9. PATCH /postulaciones/:id/cancelar ----------
function cancelar(ctx: Context): Result {
  const postulacion = buscarPostulacion(ctx.params.id);
  if (postulacion.trabajadorId !== usuarioActual(ctx)) throw new HttpError(403, "Esta postulación no es tuya");

  const b = objeto(ctx.body);
  const dto: CancelarDto = { motivo: texto(b, "motivo") };
  if (dto.motivo.length > 200) throw new HttpError(400, "El motivo no puede superar los 200 caracteres");

  if (postulacion.estado !== "pendiente" && postulacion.estado !== "aceptada") {
    throw new HttpError(409, `No se puede cancelar una postulación '${postulacion.estado}'`);
  }

  const oferta = buscarOferta(postulacion.ofertaId);
  const estabaAceptada = postulacion.estado === "aceptada";
  postulacion.estado = "cancelada";
  postulacion.motivoCancelacion = dto.motivo;

  if (estabaAceptada) {
    const horasRestantes = (Date.parse(oferta.fecha) - Date.now()) / 3_600_000;
    postulacion.cancelacionTardia = horasRestantes < 24;
    if (oferta.estado === "cubierta") oferta.estado = "abierta"; // el cupo liberado reabre la oferta
    const trabajador = usuarios.find((u) => u.id === postulacion.trabajadorId);
    notificar(
      oferta.empleadorId,
      "cancelacion",
      `${trabajador?.nombre ?? "Un trabajador"} canceló su participación en "${oferta.titulo}". Motivo: ${dto.motivo}`,
    );
  }

  return {
    status: 200,
    body: { id: postulacion.id, estado: postulacion.estado, cancelacionTardia: postulacion.cancelacionTardia },
  };
}

// ---------- Registro de rutas ----------
const BASE = "/api/v1";

export function registerRoutes(): void {
  route("POST", `${BASE}/auth/register`, {}, register);
  route("POST", `${BASE}/auth/login`, {}, login);
  route("POST", `${BASE}/ofertas`, { roles: ["empleador"] }, crearOferta);
  route("GET", `${BASE}/ofertas`, {}, listarOfertas);
  route("GET", `${BASE}/ofertas/:id`, {}, detalleOferta);
  route("POST", `${BASE}/ofertas/:id/postulaciones`, { roles: ["trabajador"] }, postularse);
  route("GET", `${BASE}/ofertas/:id/postulaciones`, { roles: ["empleador"] }, listarPostulantes);
  route("PATCH", `${BASE}/postulaciones/:id/estado`, { roles: ["empleador"] }, cambiarEstado);
  route("PATCH", `${BASE}/postulaciones/:id/cancelar`, { roles: ["trabajador"] }, cancelar);
}
