import { IncomingMessage, ServerResponse } from "node:http";
import { TokenPayload, verifyToken } from "./auth";
import { Rol } from "./types";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface Context {
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
  user?: TokenPayload;
}

export interface Result {
  status: number;
  body?: unknown;
}

type Handler = (ctx: Context) => Result;

interface RouteOptions {
  auth?: boolean; // requiere token
  roles?: Rol[]; // si se indica, además restringe por rol
}

interface Route {
  method: string;
  regex: RegExp;
  keys: string[];
  auth: boolean;
  roles?: Rol[];
  handler: Handler;
}

const routes: Route[] = [];

export function route(method: string, path: string, opts: RouteOptions, handler: Handler): void {
  const keys: string[] = [];
  const patron = path.replace(/:([a-zA-Z]+)/g, (_, k: string) => {
    keys.push(k);
    return "([^/]+)";
  });
  routes.push({
    method,
    regex: new RegExp(`^${patron}$`),
    keys,
    auth: Boolean(opts.auth || opts.roles),
    roles: opts.roles,
    handler,
  });
}

function autenticar(req: IncomingMessage): TokenPayload {
  const cabecera = req.headers.authorization ?? "";
  if (!cabecera.startsWith("Bearer ")) {
    throw new HttpError(401, "Falta el token. Usa la cabecera Authorization: Bearer <token>");
  }
  const payload = verifyToken(cabecera.slice(7).trim());
  if (!payload) throw new HttpError(401, "Token inválido o expirado");
  return payload;
}

async function leerJson(req: IncomingMessage): Promise<unknown> {
  const partes: Buffer[] = [];
  let tamano = 0;
  for await (const parte of req) {
    const buf = parte as Buffer;
    tamano += buf.length;
    if (tamano > 1_000_000) throw new HttpError(413, "El cuerpo de la petición es demasiado grande");
    partes.push(buf);
  }
  const texto = Buffer.concat(partes).toString().trim();
  if (texto === "") return {};
  try {
    return JSON.parse(texto);
  } catch {
    throw new HttpError(400, "El cuerpo no es un JSON válido");
  }
}

function enviar(res: ServerResponse, status: number, body?: unknown): void {
  if (body === undefined) {
    res.writeHead(status).end();
    return;
  }
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

export async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    const ruta = url.pathname.replace(/\/+$/, "") || "/";
    const metodo = req.method ?? "GET";
    let rutaExiste = false;

    for (const r of routes) {
      const m = r.regex.exec(ruta);
      if (!m) continue;
      rutaExiste = true;
      if (r.method !== metodo) continue;

      const params: Record<string, string> = {};
      r.keys.forEach((k, i) => {
        params[k] = decodeURIComponent(m[i + 1]);
      });

      let user: TokenPayload | undefined;
      if (r.auth) {
        user = autenticar(req);
        if (r.roles && !r.roles.includes(user.rol)) {
          throw new HttpError(403, `Esta acción es solo para: ${r.roles.join(", ")}`);
        }
      }

      const body = ["POST", "PUT", "PATCH"].includes(metodo) ? await leerJson(req) : undefined;
      const resultado = r.handler({ params, query: url.searchParams, body, user });
      enviar(res, resultado.status, resultado.body);
      return;
    }

    if (rutaExiste) throw new HttpError(405, "Método no permitido para esta ruta");
    throw new HttpError(404, "Ruta no encontrada");
  } catch (err) {
    if (err instanceof HttpError) {
      enviar(res, err.status, { error: err.message });
    } else {
      console.error(err);
      enviar(res, 500, { error: "Error interno del servidor" });
    }
  }
}
