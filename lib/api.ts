// Centraliza las acciones de la app; decide si usar datos de prueba o pedir información real al servidor.

import type { AccessRecord, AppSession, EmployeeAccessLookup, EmployeeSession, FleetVehicle, GuardNotification, OdooLoginResult, Trip, TripStatus, VehicleType } from "./types"

// Datos de ejemplo para que la aplicación pueda probarse sin conectarse a Odoo.
const mockTrips: Trip[] = [
  { id: 1, folio: "VJ-2024-001", orden: "OV-15234", movimiento_origen: "PICK-00091", almacen: "Burrion", chofer: "Juan Pérez García", placas: "ABC-123-XY", linea_fletera: "Transportes del Norte", estado: "en_camino" },
  { id: 2, folio: "VJ-2024-002", orden: "OV-15235", movimiento_origen: "PICK-00092", almacen: "Pinitos", chofer: "María López Hernández", placas: "DEF-456-ZW", linea_fletera: "Fletes Rápidos SA", estado: "en_revision", fecha_entrada: "2026-04-29T08:10:00" },
  { id: 3, folio: "VJ-2024-003", orden: "OV-15236", movimiento_origen: "PICK-00093", almacen: "Pinitos", chofer: "Carlos Rodríguez Martínez", placas: "GHI-789-UV", linea_fletera: "Logística Express", estado: "en_espera", fecha_entrada: "2026-04-29T08:30:00" },
  { id: 4, folio: "VJ-2024-004", orden: "OV-15237", movimiento_origen: "PICK-00094", almacen: "Burrion", chofer: "Ana Torres Sánchez", placas: "JKL-012-ST", linea_fletera: "Transportes del Norte", estado: "bascula", fecha_entrada: "2026-04-29T07:00:00" },
]

const mockAccessRecords: AccessRecord[] = [
  { id: "A-001", nombre: "Mario Acosta", vehiculo: "Vehículo PURP", vehiculo_purp: "PICKUP 04", estado: "en_planta", fecha_entrada: "2026-04-29T09:00:00" },
]

// Copias modificables: simulan cambios reales mientras se usa el modo de prueba.
const trips = [...mockTrips]
let accessRecords = [...mockAccessRecords]
const fleetVehicles: FleetVehicle[] = [
  { id: 1, name: "PICKUP 01" },
  { id: 2, name: "PICKUP 02" },
  { id: 3, name: "PICKUP 03" },
  { id: 4, name: "PICKUP 04" },
  { id: 5, name: "CAMIONETA SERVICIO" },
]
let notifications: GuardNotification[] = [
  { id: "N-001", folio: "VJ-2024-002", almacen: "Pinitos", message: "Logística corrigió datos del camión. Revalidar en caseta." },
]

const mockEmployee: EmployeeSession = {
  id: 1,
  name: "Luis Gilberto Sandoval Valdez",
  barcode: "041920282163",
  pin: "23108300098",
  job_title: "Operador general",
  department: "Operaciones / Seguridad e higiene",
  work_location: "Pinitos",
  work_location_id: 1,
}

const mockOdooLogin: OdooLoginResult = {
  user: { uid: 1, name: "Usuario PWA", login: "demo" },
  permissions: {
    id: 1,
    name: "Guardia Demo",
    role: "guardia",
    requiere_gafete: true,
    puede_abrir_odoo: false,
    puede_entrada_salida: true,
    puede_logistica: true,
    ve_todos_los_almacenes: false,
    planta_predeterminada: "Pinitos",
  },
}

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
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || "Error Odoo")
  if (!json.ok) throw new Error(json.error || "Error Odoo")
  return json.data as T
}


export async function odooUserLogin(username: string, password: string): Promise<OdooLoginResult> {
  if (!useMock()) return odoo<OdooLoginResult>("odooUserLogin", { username, password })
  await delay(150)
  if (!username.trim() || !password.trim()) throw new Error("Captura usuario y contraseña")
  return mockOdooLogin
}

export function buildOdooContext(session?: AppSession | null) {
  if (!session) return undefined
  return {
    activePlant: session.activePlant || session.permissions.planta_predeterminada || session.employee?.work_location || session.permissions.empleado?.work_location || "",
    canSeeAll: Boolean(session.permissions.ve_todos_los_almacenes),
    employee: session.employee || session.permissions.empleado || undefined,
    permissions: session.permissions,
  }
}

export async function refreshAppSession(session: AppSession): Promise<AppSession> {
  if (useMock()) {
    await delay(100)
    return {
      ...session,
      permissions: { ...mockOdooLogin.permissions, ...(session.permissions || {}) },
      activePlant: session.activePlant || session.permissions?.planta_predeterminada || mockOdooLogin.permissions.planta_predeterminada,
    }
  }

  return odoo<AppSession>("refreshAppSession", { session })
}

// Valida el acceso operativo del empleado usando RFID/código de credencial o NIP de hr.employee.
export async function employeeLogin(code: string): Promise<EmployeeSession> {
  if (!useMock()) return odoo<EmployeeSession>("employeeLogin", { code })
  await delay(150)
  const clean = code.trim()
  if (clean === mockEmployee.barcode || clean === mockEmployee.pin) return mockEmployee
  throw new Error("No se encontró un empleado activo con ese código")
}




export async function employeePermissionLogin(code: string, odooUid: number): Promise<{ employee: EmployeeSession; permissions: OdooLoginResult["permissions"] }> {
  if (!useMock()) return odoo<{ employee: EmployeeSession; permissions: OdooLoginResult["permissions"] }>("employeePermissionLogin", { code, odooUid })
  await delay(150)
  const employee = await employeeLogin(code)
  return { employee, permissions: { ...mockOdooLogin.permissions, empleado: employee, planta_predeterminada: employee.work_location || mockOdooLogin.permissions.planta_predeterminada } }
}

// Busca un empleado por gafete/NIP para registrar entrada o salida de accesos manuales.
export async function lookupEmployeeAccess(code: string): Promise<EmployeeAccessLookup> {
  if (!useMock()) return odoo<EmployeeAccessLookup>("lookupEmployeeAccess", { code })
  await delay(150)
  const employee = await employeeLogin(code)
  const openAccess = accessRecords.find((record) => record.nombre.toLowerCase() === employee.name.toLowerCase() && record.estado === "en_planta") || null
  return { employee, openAccess }
}

// Busca un viaje por folio, orden o placas, que son los datos que puede traer un código escaneado.
export async function getTripByCode(code: string, context?: Pick<EmployeeSession, "id" | "work_location" | "work_location_id"> | ReturnType<typeof buildOdooContext>): Promise<Trip | null> {
  if (!useMock()) return odoo<Trip | null>("getTripByCode", { code, context })
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
export async function getAllTrips(context?: Pick<EmployeeSession, "id" | "work_location" | "work_location_id"> | ReturnType<typeof buildOdooContext>): Promise<Trip[]> {
  if (!useMock()) return odoo<Trip[]>("getAllTrips", { context })
  await delay(200)
  return trips.filter((trip) => trip.estado !== "planeado")
}

// Cambia el estado de un viaje y agrega fechas cuando se registra entrada, revisión o salida.
export async function updateTripStatus(folio: string, newStatus: TripStatus, additionalData?: Partial<Trip> & { employeeId?: number }, context?: ReturnType<typeof buildOdooContext>): Promise<Trip | null> {
  if (!useMock()) return odoo<Trip | null>("updateTripStatus", { folio, newStatus, additionalData, context })
  await delay(200)
  const index = trips.findIndex((t) => t.folio === folio)
  if (index === -1) return null
  trips[index] = { ...trips[index], estado: newStatus, ...additionalData }
  return trips[index]
}

// Marca que el camión entró correctamente y queda esperando siguiente paso operativo.
export async function validateEntry(folio: string, employeeId?: number, context?: ReturnType<typeof buildOdooContext>): Promise<Trip | null> {
  return updateTripStatus(folio, "en_espera", { fecha_entrada: nowIso(), employeeId }, context)
}

// Marca un viaje para revisión cuando la caseta detecta datos incorrectos o incompletos.
export async function markInvalid(folio: string, employeeId?: number, context?: ReturnType<typeof buildOdooContext>): Promise<Trip | null> {
  return updateTripStatus(folio, "en_revision", { fecha_entrada: nowIso(), employeeId }, context)
}

// Regresa el viaje a espera cuando logística corrigió la información pendiente.
export async function validateCorrection(folio: string, context?: ReturnType<typeof buildOdooContext>): Promise<Trip | null> {
  return updateTripStatus(folio, "en_espera", undefined, context)
}

// Registra la salida del camión y cierra el viaje en la vista de caseta.
export async function registerExit(folio: string, employeeId?: number, context?: ReturnType<typeof buildOdooContext>): Promise<Trip | null> {
  return updateTripStatus(folio, "finalizado", { fecha_salida: nowIso(), employeeId }, context)
}

// Obtiene las unidades internas disponibles para registrar accesos de vehículos PURP.
export async function getFleetVehicles(): Promise<FleetVehicle[]> {
  if (!useMock()) return odoo<FleetVehicle[]>("getFleetVehicles")
  await delay(100)
  return [...fleetVehicles]
}


// Busca una entrada/salida por folio de acceso generado por Odoo.
export async function getAccessByCode(code: string, context?: ReturnType<typeof buildOdooContext>): Promise<AccessRecord | null> {
  if (!useMock()) return odoo<AccessRecord | null>("getAccessByCode", { code, context })
  await delay(100)
  const clean = code.trim().toLowerCase()
  return accessRecords.find((r) => r.folio?.toLowerCase() === clean || r.id.toLowerCase() === clean) ?? null
}

// Lista las entradas y salidas manuales de visitantes o unidades no asociadas a viajes.
export async function getAccessRecords(context?: ReturnType<typeof buildOdooContext>): Promise<AccessRecord[]> {
  if (!useMock()) return odoo<AccessRecord[]>("getAccessRecords", { context })
  await delay(200)
  return [...accessRecords]
}

// Crea una entrada manual para una persona o vehículo que ingresa a planta.
export async function createAccessRecord(data: {
  nombre: string
  vehiculo: VehicleType
  vehiculo_purp?: string
  descripcion_vehiculo?: string
  employeeId?: number
  accessEmployeeId?: number
  planta?: string
}, context?: ReturnType<typeof buildOdooContext>): Promise<AccessRecord> {
  if (!useMock()) return odoo<AccessRecord>("createAccessRecord", { data, context })
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
export async function registerAccessExit(id: string, employeeId?: number, context?: ReturnType<typeof buildOdooContext>): Promise<AccessRecord | null> {
  if (!useMock()) return odoo<AccessRecord | null>("registerAccessExit", { id, employeeId, context })
  await delay(200)
  const index = accessRecords.findIndex((r) => r.id === id)
  if (index === -1) return null
  accessRecords[index] = { ...accessRecords[index], estado: "salida", fecha_salida: nowIso() }
  return accessRecords[index]
}

// Trae avisos pendientes que logística quiere que el guardia revise.
export async function getGuardNotifications(context?: Pick<EmployeeSession, "id" | "work_location"> | ReturnType<typeof buildOdooContext>): Promise<GuardNotification[]> {
  if (!useMock()) return odoo<GuardNotification[]>("getGuardNotifications", { context })
  await delay(100)
  const location = (context as any)?.activePlant?.toLowerCase?.() || (context as any)?.work_location?.toLowerCase?.() || (context as any)?.employee?.work_location?.toLowerCase?.()
  return notifications.filter((n) => !n.done && (!location || !n.almacen || n.almacen.toLowerCase().includes(location)))
}

// Marca un aviso como atendido para que deje de mostrarse como pendiente.
export async function acknowledgeGuardNotification(id: string): Promise<void> {
  if (!useMock()) return odoo<void>("acknowledgeGuardNotification", { id })
  notifications = notifications.map((n) => n.id === id ? { ...n, done: true } : n)
}


export async function updatePwaPlant(permissionId: number, plant: string, context?: ReturnType<typeof buildOdooContext>) {
  if (!useMock()) return odoo<{ ok: boolean; plant: string; permissions: any }>("updatePwaPlant", { permissionId, plant, context })
  await delay(100)
  return { ok: true, plant, permissions: { ...mockOdooLogin.permissions, planta_predeterminada: plant } }
}
