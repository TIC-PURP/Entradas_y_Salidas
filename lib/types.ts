// Define los nombres y estructuras de datos que usa la app para viajes, accesos, notificaciones y vehículos.

// Estados posibles de un viaje, desde que se planea hasta que termina.
export type TripStatus =
  | "pendiente"
  | "confirmado"
  | "en_revision"
  | "en_espera"
  | "p_tara"
  | "embarque"
  | "p_bruto"
  | "finalizado";

// Información mínima que la caseta necesita ver de cada viaje.
export interface EmployeeSession {
  id: number;
  name: string;
  barcode?: string;
  pin?: string;
  job_title?: string;
  department?: string;
  work_location?: string;
  work_location_id?: number;
}

export interface OdooUserSession {
  uid: number;
  name: string;
  login: string;
}

export type PwaRole = "guardia" | "usuario" | "supervisor" | "admin" | string;

export interface PwaPermissions {
  id: number;
  name: string;
  role: PwaRole;
  requiere_gafete: boolean;
  puede_abrir_odoo: boolean;
  puede_entrada_salida: boolean;
  puede_logistica: boolean;
  ve_todos_los_almacenes: boolean;
  planta_predeterminada?: string;
  empleado?: EmployeeSession | null;
}

export interface AppSession {
  odooUser: OdooUserSession;
  permissions: PwaPermissions;
  employee?: EmployeeSession | null;
  activePlant?: string;
  theme?: "dark" | "light";
  sessionVersion?: string;
}

export interface OdooLoginResult {
  user: OdooUserSession;
  permissions: PwaPermissions;
}

export interface Trip {
  id?: number;
  folio: string;
  orden: string;
  movimiento_origen?: string;
  almacen?: string;
  chofer: string;
  placas: string;
  linea_fletera: string;
  estado: TripStatus;
  fecha_entrada?: string;
  fecha_salida?: string;
  operador_entrada?: string;
  operador_salida?: string;
  planta?: string;
  odoo_url?: string;
}

// Estados de un acceso manual: entró, sigue dentro o ya salió.
export type AccessStatus = "entrada" | "en_planta" | "salida";
export type VehicleType = "Vehículo PURP" | "Otro vehículo";

// Registro de una persona o vehículo que entra sin pasar por el flujo de viaje.
export interface AccessRecord {
  id: string;
  folio?: string;
  nombre: string;
  vehiculo: VehicleType;
  vehiculo_purp?: string;
  descripcion_vehiculo?: string;
  estado: AccessStatus;
  fecha_entrada?: string;
  fecha_salida?: string;
  operador_entrada?: string;
  operador_salida?: string;
  planta?: string;
  odoo_url?: string;
}

// Textos amigables que se muestran al usuario en lugar de claves técnicas.
export const STATUS_LABELS: Record<TripStatus, string> = {
  pendiente: "Pendientes",
  confirmado: "Confirmados",
  en_revision: "En Revisión",
  en_espera: "En Espera",
  p_tara: "P. tara",
  embarque: "Embarque",
  p_bruto: "P. bruto",
  finalizado: "Finalizado",
};

// Colores visuales para distinguir rápidamente el estado de cada viaje.
export const STATUS_COLORS: Record<TripStatus, string> = {
  pendiente: "bg-slate-200 text-slate-800",
  confirmado: "bg-info text-info-foreground",
  en_revision: "bg-warning text-warning-foreground",
  en_espera: "bg-accent text-accent-foreground",
  p_tara: "bg-primary text-primary-foreground",
  embarque: "bg-blue-600 text-white",
  p_bruto: "bg-purple-600 text-white",
  finalizado: "bg-muted text-muted-foreground",
};

export const ACCESS_STATUS_LABELS: Record<AccessStatus, string> = {
  entrada: "Entrada",
  en_planta: "En Planta",
  salida: "Salida",
};

export const ACCESS_STATUS_COLORS: Record<AccessStatus, string> = {
  entrada: "bg-info text-info-foreground",
  en_planta: "bg-primary text-primary-foreground",
  salida: "bg-muted text-muted-foreground",
};

// Aviso enviado a caseta para que el guardia revise un viaje o una corrección.
export interface GuardNotification {
  id: string;
  folio: string;
  message: string;
  title?: string;
  almacen?: string;
  tripId?: number;
  messageId?: number;
  date?: string;
  done?: boolean;
}

// Vehículo interno disponible para seleccionar en registros de acceso.
export interface FleetVehicle {
  id: number;
  name: string;
  license_plate?: string;
  driver?: string;
  state?: string;
}


// Resultado usado cuando se escanea el gafete de un empleado para acceso manual.
export interface EmployeeAccessLookup {
  employee: EmployeeSession;
  openAccess: AccessRecord | null;
}

// Mensaje del chatter de Odoo asociado a un viaje o entrada/salida.
export interface ChatterMessage {
  id: number;
  recordId: number;
  author: string;
  body: string;
  date?: string;
  subject?: string;
}
