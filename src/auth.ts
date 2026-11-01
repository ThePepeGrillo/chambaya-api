import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { Rol } from "./types";

const SECRET = process.env.JWT_SECRET ?? "chambaya-dev-secret-cambiar-en-produccion";
const DURACION_TOKEN_SEG = 60 * 60 * 2; // 2 horas

export interface TokenPayload {
  sub: string; // id del usuario
  rol: Rol;
  exp: number; // segundos desde epoch
}

// ---------- Contraseñas (hash con scrypt + sal aleatoria) ----------
export function hashPassword(password: string): string {
  const sal = randomBytes(16).toString("hex");
  const hash = scryptSync(password, sal, 64).toString("hex");
  return `${sal}:${hash}`;
}

export function verifyPassword(password: string, guardado: string): boolean {
  const [sal, hash] = guardado.split(":");
  if (!sal || !hash) return false;
  const calculado = scryptSync(password, sal, 64);
  const esperado = Buffer.from(hash, "hex");
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}

// ---------- Token tipo JWT (HS256) ----------
const b64 = (data: string | Buffer) => Buffer.from(data).toString("base64url");

function firmar(contenido: string): string {
  return createHmac("sha256", SECRET).update(contenido).digest("base64url");
}

export function signToken(sub: string, rol: Rol): string {
  const header = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload: TokenPayload = {
    sub,
    rol,
    exp: Math.floor(Date.now() / 1000) + DURACION_TOKEN_SEG,
  };
  const cuerpo = `${header}.${b64(JSON.stringify(payload))}`;
  return `${cuerpo}.${firmar(cuerpo)}`;
}

export function verifyToken(token: string): TokenPayload | null {
  const partes = token.split(".");
  if (partes.length !== 3) return null;
  const [header, payload, firma] = partes;
  const esperada = firmar(`${header}.${payload}`);
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const datos = JSON.parse(Buffer.from(payload, "base64url").toString()) as TokenPayload;
    if (typeof datos.exp !== "number" || datos.exp < Math.floor(Date.now() / 1000)) return null;
    return datos;
  } catch {
    return null;
  }
}
