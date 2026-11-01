import { Notificacion, Oferta, Postulacion, Usuario } from "./types";

// Almacenamiento en memoria: se reinicia cada vez que se reinicia el servidor.
export const usuarios: Usuario[] = [];
export const ofertas: Oferta[] = [];
export const postulaciones: Postulacion[] = [];
export const notificaciones: Notificacion[] = [];

const contadores = { u: 0, o: 0, p: 0, n: 0 };

export function nextId(prefijo: keyof typeof contadores): string {
  contadores[prefijo] += 1;
  return `${prefijo}-${contadores[prefijo]}`;
}
