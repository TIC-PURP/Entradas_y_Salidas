// Comentario para personas no técnicas: Define los nombres y estructuras de datos que usa la app para viajes, accesos, notificaciones y vehículos.

// Estados posibles de un viaje, desde que se planea hasta que termina.
export type TripStatus =
  | "planeado"
  | "en_camino"
  | "en_revision"
  | "en_espera"
  | "en_proceso"
  | "finalizado";

// Información mínima que la caseta necesita ver de cada viaje.
export interface Trip {
  id?: number;
  folio: string;
  orden: string;
  movimiento_origen?: string;
  chofer: string;
  placas: string;
  linea_fletera: string;
  estado: TripStatus;
  fecha_entrada?: string;
  fecha_salida?: string;
}

// Estados de un acceso manual: entró, sigue dentro o ya salió.
export type AccessStatus = "entrada" | "en_planta" | "salida";
export type VehicleType = "Vehículo PURP" | "Otro vehículo";

// Registro de una persona o vehículo que entra sin pasar por el flujo de viaje.
export interface AccessRecord {
  id: string;
  nombre: string;
  vehiculo: VehicleType;
  vehiculo_purp?: string;
  descripcion_vehiculo?: string;
  estado: AccessStatus;
  fecha_entrada?: string;
  fecha_salida?: string;
}

// Textos amigables que se muestran al usuario en lugar de claves técnicas.
export const STATUS_LABELS: Record<TripStatus, string> = {
  planeado: "Planeado",
  en_camino: "En Camino",
  en_revision: "En Revisión",
  en_espera: "En Espera",
  en_proceso: "En Proceso",
  finalizado: "Finalizado",
};

// Colores visuales para distinguir rápidamente el estado de cada viaje.
export const STATUS_COLORS: Record<TripStatus, string> = {
  planeado: "bg-slate-200 text-slate-800",
  en_camino: "bg-info text-info-foreground",
  en_revision: "bg-warning text-warning-foreground",
  en_espera: "bg-accent text-accent-foreground",
  en_proceso: "bg-primary text-primary-foreground",
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
}
