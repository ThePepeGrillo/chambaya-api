// ---------- Modelos ----------
export type Rol = "empleador" | "trabajador";

export interface Usuario {
  id: string;
  nombre: string;
  correo: string;
  passwordHash: string;
  rol: Rol;
  verificado: boolean;
  // Empleador
  nit?: string;
  direccion?: string;
  // Trabajador
  habilidades?: string[];
  disponibilidad?: string;
}

export type EstadoOferta = "abierta" | "cubierta";

export interface Oferta {
  id: string;
  empleadorId: string;
  titulo: string;
  tipo: string;
  descripcion: string;
  fecha: string; // ISO 8601
  duracionHoras: number;
  pago: number;
  ubicacion: string;
  cupos: number;
  estado: EstadoOferta;
}

export type EstadoPostulacion = "pendiente" | "aceptada" | "rechazada" | "cancelada";

export interface Postulacion {
  id: string;
  ofertaId: string;
  trabajadorId: string;
  estado: EstadoPostulacion;
  fechaPostulacion: string;
  cancelacionTardia: boolean;
  motivoCancelacion?: string;
}

export type TipoNotificacion = "aceptacion" | "rechazo" | "cancelacion";

export interface Notificacion {
  id: string;
  usuarioId: string;
  tipo: TipoNotificacion;
  mensaje: string;
  leida: boolean;
  fecha: string;
}

// ---------- DTOs (cuerpos de las peticiones) ----------
export interface RegisterDto {
  nombre: string;
  correo: string;
  password: string;
  rol: Rol;
  nit?: string;
  direccion?: string;
  habilidades?: string[];
  disponibilidad?: string;
}

export interface LoginDto {
  correo: string;
  password: string;
}

export interface CrearOfertaDto {
  titulo: string;
  tipo: string;
  descripcion: string;
  fecha: string;
  duracionHoras: number;
  pago: number;
  ubicacion: string;
  cupos: number;
}

export interface CambiarEstadoDto {
  estado: "aceptada" | "rechazada";
}

export interface CancelarDto {
  motivo: string;
}
