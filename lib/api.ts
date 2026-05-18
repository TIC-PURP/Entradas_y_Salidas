// Comentario para personas no técnicas: Centraliza las acciones de la app; decide si usar datos de prueba o pedir información real al servidor.

import type { AccessRecord, FleetVehicle, GuardNotification, Trip, TripStatus, VehicleType } from "./types"

// Datos de ejemplo para que la aplicación pueda probarse sin conectarse a Odoo.
const mockTrips: Trip[] = [
  { id: 1, folio: "VJ-2024-001", orden: "OV-15234", movimiento_origen: "PICK-00091", chofer: "Juan Pérez García", placas: "ABC-123-XY", linea_fletera: "Transportes del Norte", estado: "en_camino" },
  { id: 2, folio: "VJ-2024-002", orden: "OV-15235", movimiento_origen: "PICK-00092", chofer: "María López Hernández", placas: "DEF-456-ZW", linea_fletera: "Fletes Rápidos SA", estado: "en_revision", fecha_entrada: "2026-04-29T08:10:00" },
  { id: 3, folio: "VJ-2024-003", orden: "OV-15236", movimiento_origen: "PICK-00093", chofer: "Carlos Rodríguez Martínez", placas: "GHI-789-UV", linea_fletera: "Logística Express", estado: "en_espera", fecha_entrada: "2026-04-29T08:30:00" },
  { id: 4, folio: "VJ-2024-004", orden: "OV-15237", movimiento_origen: "PICK-00094", chofer: "Ana Torres Sánchez", placas: "JKL-012-ST", linea_fletera: "Transportes del Norte", estado: "en_proceso", fecha_entrada: "2026-04-29T07:00:00" },
]

const mockAccessRecords: AccessRecord[] = [
  { id: "A-001", nombre: "Mario Pérez", vehiculo: "Vehículo PURP", vehiculo_purp: "PICKUP 04", estado: "en_planta", fecha_entrada: "2026-04-29T09:00:00" },
]

// Copias modificables: simulan cambios reales mientras se usa el modo de prueba.
let trips = [...mockTrips]
let accessRecords = [...mockAccessRecords]
let fleetVehicles: FleetVehicle[] = [
  { id: 1, name: "PICKUP 01" },
  { id: 2, name: "PICKUP 02" },
  { id: 3, name: "PICKUP 03" },
  { id: 4, name: "PICKUP 04" },
  { id: 5, name: "CAMIONETA SERVICIO" },
]
let notifications: GuardNotification[] = [
  { id: "N-001", folio: "VJ-2024-002", message: "Logística corrigió datos del camión. Revalidar en caseta." },
]

// Si esta variable está activa, se usan datos de prueba; si no, se consulta Odoo.
const useMock = () => process.env.NEXT_PUBLIC_USE_MOCK === "true"
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const nowIso = () => new Date().toISOString()

// Envía una acción al endpoint interno; así el navegador no conoce las claves de Odoo.
async function odoo<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch("/api/odoo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  })
  if (!res.ok) throw new Error(await res.text())
  const json = await res.json()
  if (!json.ok) throw new Error(json.error || "Error Odoo")
  return json.data as T
}

// Busca un viaje por folio, orden o placas, que son los datos que puede traer un código escaneado.
export async function getTripByCode(code: string): Promise<Trip | null> {
  if (!useMock()) return odoo<Trip | null>("getTripByCode", { code })
  await delay(200)
  const clean = code.trim().toLowerCase().replace(/-/g, "")
  const found = trips.find((t) =>
    t.folio.toLowerCase() === code.trim().toLowerCase() ||
    t.orden.toLowerCase() === code.trim().toLowerCase() ||
    t.placas.toLowerCase().replace(/-/g, "") === clean
  )
  if (found?.estado === "planeado") return null
  return found ?? null
}

// Devuelve los viajes visibles para caseta; los planeados aún no deben aparecer como operables.
export async function getAllTrips(): Promise<Trip[]> {
  if (!useMock()) return odoo<Trip[]>("getAllTrips")
  await delay(200)
  return trips.filter((trip) => trip.estado !== "planeado")
}

// Cambia el estado de un viaje y agrega fechas cuando se registra entrada, revisión o salida.
export async function updateTripStatus(folio: string, newStatus: TripStatus, additionalData?: Partial<Trip>): Promise<Trip | null> {
  if (!useMock()) return odoo<Trip | null>("updateTripStatus", { folio, newStatus, additionalData })
  await delay(200)
  const index = trips.findIndex((t) => t.folio === folio)
  if (index === -1) return null
  trips[index] = { ...trips[index], estado: newStatus, ...additionalData }
  return trips[index]
}

// Marca que el camión entró correctamente y queda esperando siguiente paso operativo.
export async function validateEntry(folio: string): Promise<Trip | null> {
  return updateTripStatus(folio, "en_espera", { fecha_entrada: nowIso() })
}

// Marca un viaje para revisión cuando la caseta detecta datos incorrectos o incompletos.
export async function markInvalid(folio: string): Promise<Trip | null> {
  return updateTripStatus(folio, "en_revision", { fecha_entrada: nowIso() })
}

// Regresa el viaje a espera cuando logística corrigió la información pendiente.
export async function validateCorrection(folio: string): Promise<Trip | null> {
  return updateTripStatus(folio, "en_espera")
}

// Registra la salida del camión y cierra el viaje en la vista de caseta.
export async function registerExit(folio: string): Promise<Trip | null> {
  return updateTripStatus(folio, "finalizado", { fecha_salida: nowIso() })
}

// Obtiene las unidades internas disponibles para registrar accesos de vehículos PURP.
export async function getFleetVehicles(): Promise<FleetVehicle[]> {
  if (!useMock()) return odoo<FleetVehicle[]>("getFleetVehicles")
  await delay(100)
  return [...fleetVehicles]
}

// Lista las entradas y salidas manuales de visitantes o unidades no asociadas a viajes.
export async function getAccessRecords(): Promise<AccessRecord[]> {
  if (!useMock()) return odoo<AccessRecord[]>("getAccessRecords")
  await delay(200)
  return [...accessRecords]
}

// Crea una entrada manual para una persona o vehículo que ingresa a planta.
export async function createAccessRecord(data: {
  nombre: string
  vehiculo: VehicleType
  vehiculo_purp?: string
  descripcion_vehiculo?: string
}): Promise<AccessRecord> {
  if (!useMock()) return odoo<AccessRecord>("createAccessRecord", { data })
  await delay(200)
  const record: AccessRecord = {
    id: `A-${String(accessRecords.length + 1).padStart(3, "0")}`,
    nombre: data.nombre,
    vehiculo: data.vehiculo,
    vehiculo_purp: data.vehiculo === "Vehículo PURP" ? data.vehiculo_purp : undefined,
    descripcion_vehiculo: data.vehiculo === "Otro vehículo" ? data.descripcion_vehiculo : undefined,
    estado: "en_planta",
    fecha_entrada: nowIso(),
  }
  accessRecords = [record, ...accessRecords]
  return record
}

// Coloca la hora de salida a un acceso manual para saber que ya abandonó la planta.
export async function registerAccessExit(id: string): Promise<AccessRecord | null> {
  if (!useMock()) return odoo<AccessRecord | null>("registerAccessExit", { id })
  await delay(200)
  const index = accessRecords.findIndex((r) => r.id === id)
  if (index === -1) return null
  accessRecords[index] = { ...accessRecords[index], estado: "salida", fecha_salida: nowIso() }
  return accessRecords[index]
}

// Trae avisos pendientes que logística quiere que el guardia revise.
export async function getGuardNotifications(): Promise<GuardNotification[]> {
  if (!useMock()) return odoo<GuardNotification[]>("getGuardNotifications")
  await delay(100)
  return notifications.filter((n) => !n.done)
}

// Marca un aviso como atendido para que deje de mostrarse como pendiente.
export async function acknowledgeGuardNotification(id: string): Promise<void> {
  if (!useMock()) return odoo<void>("acknowledgeGuardNotification", { id })
  notifications = notifications.map((n) => n.id === id ? { ...n, done: true } : n)
}
