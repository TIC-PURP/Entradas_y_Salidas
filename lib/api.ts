import type {
  AccessRecord,
  AppSession,
  ChatterMessage,
  EmployeeAccessLookup,
  EmployeeSession,
  FleetVehicle,
  GuardNotification,
  OdooContext,
  OdooLoginResult,
  Trip,
  TripStatus,
  VehicleType,
} from "./types"

const nowIso = () => new Date().toISOString()

// Envía una acción al endpoint interno; así el navegador no conoce las claves de Odoo.
async function odoo<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch("/api/odoo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  })

  let json: { ok?: boolean; data?: T; error?: string }
  try {
    json = await res.json()
  } catch {
    throw new Error("El servidor no regresó una respuesta válida.")
  }

  if (!res.ok) throw new Error(json.error || "Error Odoo")
  if (!json.ok) throw new Error(json.error || "Error Odoo")
  return json.data as T
}

export async function odooUserLogin(username: string, password: string): Promise<OdooLoginResult> {
  return odoo<OdooLoginResult>("odooUserLogin", { username, password })
}

export async function odooLogout(): Promise<void> {
  await odoo<void>("logout")
}

export function buildOdooContext(session?: AppSession | null): OdooContext | undefined {
  if (!session) return undefined
  return {
    activePlant:
      session.activePlant ||
      session.permissions.planta_predeterminada ||
      session.employee?.work_location ||
      session.permissions.empleado?.work_location ||
      "",
    canSeeAll: Boolean(session.permissions.ve_todos_los_almacenes),
    employee: session.employee || session.permissions.empleado || undefined,
    permissions: session.permissions,
  }
}

export async function refreshAppSession(session: AppSession): Promise<AppSession> {
  return odoo<AppSession>("refreshAppSession", { session })
}

// Valida el acceso operativo del empleado usando RFID/código de credencial o NIP de hr.employee.
export async function employeeLogin(code: string): Promise<EmployeeSession> {
  return odoo<EmployeeSession>("employeeLogin", { code })
}

export async function employeePermissionLogin(
  code: string,
  odooUid: number,
): Promise<{ employee: EmployeeSession; permissions: OdooLoginResult["permissions"] }> {
  return odoo<{ employee: EmployeeSession; permissions: OdooLoginResult["permissions"] }>("employeePermissionLogin", {
    code,
    odooUid,
  })
}

// Busca un empleado por gafete/NIP para registrar entrada o salida de accesos manuales.
export async function lookupEmployeeAccess(code: string): Promise<EmployeeAccessLookup> {
  return odoo<EmployeeAccessLookup>("lookupEmployeeAccess", { code })
}

// Busca un viaje por folio, orden o placas, que son los datos que puede traer un código escaneado.
export async function getTripByCode(
  code: string,
  context?: OdooContext,
): Promise<Trip | null> {
  return odoo<Trip | null>("getTripByCode", { code, context })
}

// Devuelve los viajes visibles para caseta; los pendientes aún no deben aparecer como operables.
export async function getAllTrips(
  context?: OdooContext,
): Promise<Trip[]> {
  return odoo<Trip[]>("getAllTrips", { context })
}

// Cambia el estado de un viaje y agrega fechas cuando se registra entrada, revisión o salida.
export async function updateTripStatus(
  folio: string,
  newStatus: TripStatus,
  additionalData?: Partial<Trip> & { employeeId?: number },
  context?: OdooContext,
): Promise<Trip | null> {
  return odoo<Trip | null>("updateTripStatus", { folio, newStatus, additionalData, context })
}

// Marca que el camión entró correctamente y queda esperando siguiente paso operativo.
export async function validateEntry(
  folio: string,
  employeeId?: number,
  context?: OdooContext,
): Promise<Trip | null> {
  return updateTripStatus(folio, "en_espera", { fecha_entrada: nowIso(), employeeId }, context)
}

// Marca un viaje para revisión cuando la caseta detecta datos incorrectos o incompletos.
export async function markInvalid(
  folio: string,
  employeeId?: number,
  context?: OdooContext,
): Promise<Trip | null> {
  return updateTripStatus(folio, "en_revision", { employeeId }, context)
}

// Regresa el viaje a espera cuando logística corrigió la información pendiente.
export async function validateCorrection(
  folio: string,
  context?: OdooContext,
): Promise<Trip | null> {
  return updateTripStatus(folio, "en_espera", undefined, context)
}

// Registra la salida del camión y cierra el viaje en la vista de caseta.
export async function registerExit(
  folio: string,
  employeeId?: number,
  context?: OdooContext,
): Promise<Trip | null> {
  return updateTripStatus(folio, "finalizado", { fecha_salida: nowIso(), employeeId }, context)
}

// Obtiene las unidades internas disponibles para registrar accesos de vehículos PURP.
export async function getFleetVehicles(): Promise<FleetVehicle[]> {
  return odoo<FleetVehicle[]>("getFleetVehicles")
}

// Busca una entrada/salida por folio de acceso generado por Odoo.
export async function getAccessByCode(code: string, context?: OdooContext): Promise<AccessRecord | null> {
  return odoo<AccessRecord | null>("getAccessByCode", { code, context })
}

// Lista las entradas y salidas manuales de visitantes o unidades no asociadas a viajes.
export async function getAccessRecords(context?: OdooContext): Promise<AccessRecord[]> {
  return odoo<AccessRecord[]>("getAccessRecords", { context })
}

// Crea una entrada manual para una persona o vehículo que ingresa a planta.
export async function createAccessRecord(
  data: {
    nombre: string
    vehiculo: VehicleType
    vehiculo_purp?: string
    descripcion_vehiculo?: string
    employeeId?: number
    accessEmployeeId?: number
    planta?: string
  },
  context?: OdooContext,
): Promise<AccessRecord> {
  return odoo<AccessRecord>("createAccessRecord", { data, context })
}

// Coloca la hora de salida a un acceso manual para saber que ya abandonó la planta.
export async function registerAccessExit(
  id: string,
  employeeId?: number,
  context?: OdooContext,
): Promise<AccessRecord | null> {
  return odoo<AccessRecord | null>("registerAccessExit", { id, employeeId, context })
}

// Trae avisos pendientes que logística quiere que el guardia revise.
export async function getGuardNotifications(
  context?: OdooContext,
): Promise<GuardNotification[]> {
  return odoo<GuardNotification[]>("getGuardNotifications", { context })
}

// Marca un aviso como atendido para que deje de mostrarse como pendiente.
export async function acknowledgeGuardNotification(id: string): Promise<void> {
  return odoo<void>("acknowledgeGuardNotification", { id })
}

export async function getRecordChatter(
  recordType: "trip" | "access",
  recordId: number,
  context?: OdooContext,
): Promise<ChatterMessage[]> {
  return odoo<ChatterMessage[]>("getRecordChatter", { recordType, recordId, context })
}

export async function postRecordChatter(
  recordType: "trip" | "access",
  recordId: number,
  message: string,
  context?: OdooContext,
): Promise<ChatterMessage[]> {
  return odoo<ChatterMessage[]>("postRecordChatter", { recordType, recordId, message, context })
}

export async function updatePwaPlant(permissionId: number, plant: string, context?: OdooContext) {
  return odoo<{ ok: boolean; plant: string; permissions: OdooLoginResult["permissions"] }>("updatePwaPlant", {
    permissionId,
    plant,
    context,
  })
}
