// Recibe solicitudes internas de la app y las convierte en operaciones seguras contra Odoo.

import { NextResponse } from "next/server"

type OdooIdName = false | [number, string]

type OdooTrip = {
  id: number
  [key: string]: unknown
  x_name?: string
  x_studio_orden_de_venta?: OdooIdName
  x_studio_transferencia?: OdooIdName
  x_studio_chofer?: string
  x_studio_placa?: string
  x_studio_linea_fletera_1?: OdooIdName
  x_studio_selection_field_8eu_1jmu93j7v?: string
  x_studio_entrada?: string
  x_studio_salida?: string
  x_studio_operador_entrada?: OdooIdName
  x_studio_operador_salida?: OdooIdName
}

type OdooAccess = {
  id: number
  [key: string]: unknown
  x_name?: string
  x_studio_vehiculo?: string
  x_studio_vehiculo_purp?: OdooIdName
  x_studio_descripcion_del_vehiculo?: string
  x_studio_entrada_planta?: string
  x_studio_salida_planta?: string
  x_studio_selection_field_87c_1jnb97pu7?: string
  x_studio_operador_entrada?: OdooIdName
  x_studio_operador_salida?: OdooIdName
}

type OdooChatterMessage = {
  id: number
  res_id: number
  body?: string
  date?: string
  author_id?: OdooIdName
  subject?: string
  message_type?: string
}

type OdooRpcError = {
  error?: {
    message?: string
    data?: {
      message?: string
      debug?: string
    }
  }
}

const fieldsCache = new Map<string, Set<string>>()

// Traduce estados entendibles de la app a los códigos internos que Odoo guarda.
const STATUS_TO_ODOO: Record<string, string> = {
  planeado: "status1",
  en_camino: "status2",
  en_revision: "status3",
  en_espera: "status4",
  en_proceso: "status5",
  finalizado: "status6",
}

const STATUS_FROM_ODOO: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_TO_ODOO).map(([key, value]) => [value, key]),
)

// Traduce estados de accesos manuales a los códigos internos usados por Odoo.
const ACCESS_TO_ODOO: Record<string, string> = {
  entrada: "status1",
  en_planta: "status2",
  salida: "status3",
}

const ACCESS_FROM_ODOO: Record<string, string> = Object.fromEntries(
  Object.entries(ACCESS_TO_ODOO).map(([key, value]) => [value, key]),
)

// Lee la configuración del ambiente para no escribir direcciones ni claves dentro del código.
const cfg = () => ({
  url: process.env.ODOO_URL?.trim().replace(/\/+$/, "").replace(/\/odoo$/, ""),
  db: process.env.ODOO_DB?.trim(),
  username: process.env.ODOO_USERNAME?.trim(),
  apiKey: process.env.ODOO_API_KEY?.trim(),
  viajesModel: process.env.ODOO_VIAJES_MODEL?.trim() || "x_viajes",
  accessModel: process.env.ODOO_ACCESS_MODEL?.trim() || "x_control_de_acceso",
  notifyField: process.env.ODOO_NOTIFY_FIELD?.trim() || "x_studio_notificar_guardia",
  tripWarehouseField: process.env.ODOO_TRIP_WAREHOUSE_FIELD?.trim() || "x_studio_related_field_7jn_1jn076pgg",
  notificationAckParamKey: process.env.ODOO_NOTIFICATION_ACK_PARAM_KEY?.trim() || "entradas_salidas.guard_notifications.acknowledged.v1",
  tripOperatorEntryField: process.env.ODOO_TRIP_OPERATOR_ENTRY_FIELD?.trim() || "x_studio_operador_entrada",
  tripOperatorExitField: process.env.ODOO_TRIP_OPERATOR_EXIT_FIELD?.trim() || "x_studio_operador_salida",
  accessOperatorEntryField: process.env.ODOO_ACCESS_OPERATOR_ENTRY_FIELD?.trim() || "x_studio_operador_entrada",
  accessOperatorExitField: process.env.ODOO_ACCESS_OPERATOR_EXIT_FIELD?.trim() || "x_studio_operador_salida",
  employeeWorkLocationField: process.env.ODOO_EMPLOYEE_WORK_LOCATION_FIELD?.trim() || "work_location_id",
  accessPersonEmployeeField: process.env.ODOO_ACCESS_PERSON_EMPLOYEE_FIELD?.trim() || "x_studio_empleado_visitante",
  accessPlantField: process.env.ODOO_ACCESS_PLANT_FIELD?.trim() || "x_studio_planta_pwa",
  supervisorCanViewAll: (process.env.ODOO_SUPERVISOR_CAN_VIEW_ALL ?? "true").toLowerCase() !== "false",
  employeeCodeFields: (process.env.ODOO_EMPLOYEE_CODE_FIELDS || "barcode,pin,identification_id,registration_number")
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean),
  chatterLookbackHours: Number(process.env.ODOO_CHATTER_LOOKBACK_HOURS || "48"),
})

// Revisa que existan las variables indispensables antes de intentar conectar con Odoo.
function requireConfig() {
  const c = cfg()
  const missing = Object.entries(c).filter(([key, value]) => ["url", "db", "username", "apiKey"].includes(key) && !value)
  if (missing.length) throw new Error(`Faltan variables .env.local: ${missing.map(([key]) => key).join(", ")}`)
  return c as Required<ReturnType<typeof cfg>>
}

function rpcMessage(payload: OdooRpcError, fallback = "Error RPC de Odoo") {
  return payload.error?.data?.message || payload.error?.message || fallback
}

// Hace una llamada directa al servicio JSON-RPC de Odoo y convierte errores técnicos en mensajes claros.
async function odooRpc<T>(service: string, method: string, args: unknown[]): Promise<T> {
  const c = requireConfig()
  const res = await fetch(`${c.url}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: { service, method, args },
      id: Date.now(),
    }),
    cache: "no-store",
  })

  const text = await res.text()
  let payload: any
  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error(`Odoo no regresó JSON. Revisa ODOO_URL. URL usada: ${c.url}/jsonrpc`)
  }

  if (!res.ok || payload.error) {
    throw new Error(rpcMessage(payload, `Error HTTP ${res.status} en Odoo`))
  }

  return payload.result as T
}

// Inicia sesión en Odoo y obtiene el identificador de usuario necesario para operar.
async function authenticate(): Promise<number> {
  const c = requireConfig()
  const uid = await odooRpc<number | false>("common", "authenticate", [c.db, c.username, c.apiKey, {}])
  if (!uid) {
    throw new Error("No se pudo autenticar con Odoo. Revisa ODOO_DB, ODOO_USERNAME, ODOO_API_KEY y que la API Key pertenezca a esta misma base/usuario.")
  }
  return uid
}

// Ejecuta una operación sobre un modelo de Odoo, como buscar, crear o actualizar registros.
async function callKw<T>(model: string, method: string, args: unknown[] = [], kwargs: Record<string, unknown> = {}): Promise<T> {
  const c = requireConfig()
  const uid = await authenticate()
  return await odooRpc<T>("object", "execute_kw", [c.db, uid, c.apiKey, model, method, args, kwargs])
}

async function getModelFields(model: string) {
  const cached = fieldsCache.get(model)
  if (cached) return cached

  const fields = await callKw<Record<string, unknown>>(model, "fields_get", [], { attributes: ["string", "type"] })
  const names = new Set(Object.keys(fields))
  fieldsCache.set(model, names)
  return names
}

async function existingFields(model: string, fields: string[]) {
  const available = await getModelFields(model)
  return fields.filter((field) => available.has(field))
}

async function searchRead<T>(
  model: string,
  domain: unknown[] = [],
  fields: string[] = [],
  kwargs: Record<string, unknown> = {},
) {
  return await callKw<T[]>(model, "search_read", [domain], {
    ...kwargs,
    fields: await existingFields(model, fields),
  })
}

async function readRecords<T>(model: string, ids: number[], fields: string[]) {
  return await callKw<T[]>(model, "read", [ids], { fields: await existingFields(model, fields) })
}

async function existingValues(model: string, values: Record<string, unknown>) {
  const available = await getModelFields(model)
  return Object.fromEntries(Object.entries(values).filter(([field]) => available.has(field)))
}

function orDomain(terms: unknown[][]) {
  if (terms.length === 0) return []
  if (terms.length === 1) return terms[0]
  return [...Array(terms.length - 1).fill("|"), ...terms]
}

function nameOf(value?: OdooIdName | number | string) {
  if (Array.isArray(value)) return value[1]
  if (typeof value === "number") return String(value)
  return String(value || "")
}

function normalizeLocation(value?: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

function canViewAllLocations(employee?: { can_view_all_locations?: boolean }) {
  return Boolean(employee?.can_view_all_locations)
}

function locationsMatch(employeeLocation?: unknown, tripWarehouse?: unknown) {
  const employee = normalizeLocation(employeeLocation)
  const warehouse = normalizeLocation(tripWarehouse)
  if (!employee || !warehouse) return true
  return employee.includes(warehouse) || warehouse.includes(employee)
}

function nowOdooDatetime() {
  return new Date().toISOString().slice(0, 19).replace("T", " ")
}

function toOdooDatetime(value: unknown) {
  if (!value) return undefined
  const date = new Date(String(value))
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString().slice(0, 19).replace("T", " ")
  }
  return String(value).slice(0, 19).replace("T", " ")
}

// Convierte un registro de viaje de Odoo al formato simple que entienden las pantallas.
function mapTrip(record: OdooTrip) {
  const warehouseField = cfg().tripWarehouseField
  const almacen = nameOf(record[warehouseField] as OdooIdName | number | string)
  return {
    id: record.id,
    folio: record.x_name || "",
    orden: nameOf(record.x_studio_orden_de_venta),
    movimiento_origen: nameOf(record.x_studio_transferencia),
    almacen,
    planta: almacen,
    chofer: record.x_studio_chofer || "",
    placas: record.x_studio_placa || "",
    linea_fletera: nameOf(record.x_studio_linea_fletera_1),
    estado: STATUS_FROM_ODOO[record.x_studio_selection_field_8eu_1jmu93j7v || ""] || "en_camino",
    fecha_entrada: record.x_studio_entrada || undefined,
    fecha_salida: record.x_studio_salida || undefined,
    operador_entrada: nameOf(record.x_studio_operador_entrada),
    operador_salida: nameOf(record.x_studio_operador_salida),
  }
}

// Convierte un acceso manual de Odoo al formato que muestra la app.
function mapAccess(record: OdooAccess) {
  const accessPlantField = cfg().accessPlantField
  const odooStatus = record.x_studio_selection_field_87c_1jnb97pu7 || "status2"
  return {
    id: String(record.id),
    nombre: record.x_name || "",
    vehiculo: record.x_studio_vehiculo || "Otro vehículo",
    vehiculo_purp: nameOf(record.x_studio_vehiculo_purp),
    descripcion_vehiculo: record.x_studio_descripcion_del_vehiculo || "",
    estado: ACCESS_FROM_ODOO[odooStatus] || "en_planta",
    fecha_entrada: record.x_studio_entrada_planta || undefined,
    fecha_salida: record.x_studio_salida_planta || undefined,
    operador_entrada: nameOf(record.x_studio_operador_entrada),
    operador_salida: nameOf(record.x_studio_operador_salida),
    planta: nameOf(record[accessPlantField] as OdooIdName | number | string),
  }
}

const tripFields = [
  "x_name",
  "x_studio_orden_de_venta",
  "x_studio_transferencia",
  "x_studio_chofer",
  "x_studio_placa",
  "x_studio_linea_fletera_1",
  "x_studio_selection_field_8eu_1jmu93j7v",
  "x_studio_entrada",
  "x_studio_salida",
  "x_studio_operador_entrada",
  "x_studio_operador_salida",
  cfg().tripWarehouseField,
]

const accessFields = [
  "x_name",
  "x_studio_vehiculo",
  "x_studio_vehiculo_purp",
  "x_studio_descripcion_del_vehiculo",
  "x_studio_entrada_planta",
  "x_studio_salida_planta",
  "x_studio_selection_field_87c_1jnb97pu7",
  "x_studio_operador_entrada",
  "x_studio_operador_salida",
  cfg().accessPlantField,
]


async function employeeLogin(code: string) {
  const raw = String(code || "")
  const clean = raw.trim()
  const digitsOnly = clean.replace(/\D/g, "")

  if (!clean) throw new Error("Captura o escanea el código del empleado.")

  const c = cfg()

  let available: Set<string>
  try {
    available = await getModelFields("hr.employee")
  } catch (error: any) {
    throw new Error(
      `El usuario API no tiene acceso al modelo de empleados (hr.employee). En Odoo asigna permisos de Empleados/RRHH al usuario de la API. Detalle: ${error?.message || error}`,
    )
  }

  const configuredCodeFields = Array.from(new Set(c.employeeCodeFields)).filter((field) => available.has(field))

  if (configuredCodeFields.length === 0) {
    throw new Error(
      `No encontré campos válidos para login en hr.employee. Configura ODOO_EMPLOYEE_CODE_FIELDS. Campos esperados: barcode,pin,identification_id,registration_number.`,
    )
  }

  const variants = Array.from(new Set([clean, digitsOnly].filter(Boolean)))
  const codeTerms: unknown[][] = []

  for (const field of configuredCodeFields) {
    for (const value of variants) {
      codeTerms.push([field, "=ilike", value])
    }
  }

  if (/^\d+$/.test(clean)) {
    const numericId = Number(clean)
    if (Number.isSafeInteger(numericId) && numericId > 0) {
      codeTerms.push(["id", "=", numericId])
    }
  }

  const searchDomain = orDomain(codeTerms)
  const activeDomain = available.has("active") ? ["&", ["active", "=", true], ...searchDomain] : searchDomain

  const employeeFields = await existingFields("hr.employee", [
    "name",
    "job_title",
    "department_id",
    c.employeeWorkLocationField,
    "work_location_id",
    "work_location_name",
    "active",
    "parent_id",
    "child_count",
  ])

  type EmployeeLoginRecord = {
    id: number
    name?: string
    job_title?: string
    department_id?: OdooIdName
    work_location_id?: OdooIdName
    work_location_name?: string
    [key: string]: unknown
    active?: boolean
    parent_id?: OdooIdName
    child_count?: number
  }

  let records: EmployeeLoginRecord[]

  try {
    records = await callKw<EmployeeLoginRecord[]>("hr.employee", "search_read", [activeDomain], {
      fields: employeeFields,
      limit: 1,
    })
  } catch (error: any) {
    throw new Error(
      `No pude validar el empleado en Odoo. Revisa que el usuario API tenga permiso de lectura en Empleados y pueda leer los campos ${configuredCodeFields.join(", ")}. Detalle: ${error?.message || error}`,
    )
  }

  let employee = records[0]

  // Si no encontró empleado activo, revisa si existe pero está archivado/inactivo para dar un mensaje más claro.
  if (!employee && available.has("active")) {
    const inactiveRecords = await callKw<EmployeeLoginRecord[]>("hr.employee", "search_read", [searchDomain], {
      fields: employeeFields,
      limit: 1,
    })
    if (inactiveRecords[0]?.id) {
      throw new Error(`El empleado ${inactiveRecords[0].name || inactiveRecords[0].id} existe, pero está inactivo/archivado en Odoo.`)
    }
  }

  if (!employee?.id) {
    throw new Error(
      `No se encontró un empleado activo con ese RFID/NIP. Código leído: ${clean}. Campos revisados: ${configuredCodeFields.join(", ")}.`,
    )
  }

  const locationValue = employee[c.employeeWorkLocationField] as OdooIdName | string | undefined
  const defaultLocation = employee.work_location_id

  let canViewAll = false
  if (c.supervisorCanViewAll) {
    if (Number(employee.child_count || 0) > 0) {
      canViewAll = true
    } else {
      try {
        const subordinates = await callKw<number>("hr.employee", "search_count", [[["parent_id", "=", employee.id], ["active", "=", true]]])
        canViewAll = subordinates > 0
      } catch (error) {
        console.warn("No pude validar subordinados del empleado para permisos de supervisor.", error)
      }
    }
  }

  return {
    id: employee.id,
    name: employee.name || `Empleado ${employee.id}`,
    job_title: employee.job_title || "",
    department: nameOf(employee.department_id),
    work_location: nameOf(locationValue) || nameOf(defaultLocation) || employee.work_location_name || "",
    work_location_id: Array.isArray(locationValue) ? locationValue[0] : Array.isArray(defaultLocation) ? defaultLocation[0] : undefined,
    can_view_all_locations: canViewAll,
  }
}

async function lookupEmployeeAccess(code: string) {
  const c = cfg()
  const employee = await employeeLogin(code)
  const accessFieldsSet = await getModelFields(c.accessModel!)

  const openDomainBase: unknown[] = [["x_studio_selection_field_87c_1jnb97pu7", "!=", "status3"]]
  let domain: unknown[] = []

  if (accessFieldsSet.has(c.accessPersonEmployeeField)) {
    domain = andDomain(openDomainBase, [[c.accessPersonEmployeeField, "=", employee.id]])
  } else {
    // Fallback sin campo many2one del visitante: busca por el nombre guardado en x_name.
    domain = andDomain(openDomainBase, [["x_name", "=ilike", employee.name]])
  }

  const records = await searchRead<OdooAccess>(c.accessModel!, domain, accessFields, { limit: 1, order: "id desc" })

  return {
    employee,
    openAccess: records[0] ? mapAccess(records[0]) : null,
  }
}

async function safeWrite(model: string, ids: number[], values: Record<string, unknown>, fallbackValues?: Record<string, unknown>) {
  const filteredValues = await existingValues(model, values)
  const filteredFallback = fallbackValues ? await existingValues(model, fallbackValues) : undefined

  try {
    return await callKw<boolean>(model, "write", [ids, filteredValues])
  } catch (error) {
    if (!filteredFallback) throw error
    console.warn(`Write con campos opcionales falló en ${model}. Reintentando sin campos opcionales.`, error)
    return await callKw<boolean>(model, "write", [ids, filteredFallback])
  }
}

async function getTrips(domain: unknown[] = [], employee?: { id?: number; work_location?: string; work_location_id?: number; can_view_all_locations?: boolean }) {
  const c = cfg()
  const locationDomain = employeeTripDomain(employee)
  const finalDomain = andDomain(domain, locationDomain)
  const records = await searchRead<OdooTrip>(c.viajesModel!, finalDomain, tripFields, { limit: 100, order: "id desc" })
  const mapped = records.map(mapTrip)
  if (canViewAllLocations(employee)) return mapped
  return mapped.filter((trip) => locationsMatch(employee?.work_location, trip.almacen))
}

function employeeTripDomain(employee?: { id?: number; work_location?: string; work_location_id?: number; can_view_all_locations?: boolean }) {
  const c = cfg()
  if (canViewAllLocations(employee)) return []
  if (!employee?.work_location && !employee?.work_location_id) return []

  // Si el campo de almacén del viaje es many2one, el filtro por ID es el más confiable.
  // Si no coincide con el ID de ubicación de trabajo, se aplica también un filtro ilike por nombre.
  const parts: unknown[][] = []
  if (employee.work_location_id) parts.push([c.tripWarehouseField, "=", Number(employee.work_location_id)])
  if (employee.work_location) parts.push([c.tripWarehouseField, "ilike", String(employee.work_location)])

  return orDomain(parts)
}

function andDomain(...domains: unknown[][]) {
  const clean = domains.filter((domain) => Array.isArray(domain) && domain.length > 0)
  if (clean.length === 0) return []
  if (clean.length === 1) return clean[0]
  return [...Array(clean.length - 1).fill("&"), ...clean.flat()]
}

// Busca un viaje usando el dato escaneado o escrito: folio, orden o placas.
async function getTripByCode(code: string, employee?: { id?: number; work_location?: string; work_location_id?: number; can_view_all_locations?: boolean }) {
  const c = cfg()
  const clean = String(code || "").trim()
  const available = await getModelFields(c.viajesModel!)
  const searchFields = ["x_name", "x_studio_placa", "x_studio_chofer"].filter((field) => available.has(field))
  const searchDomain = orDomain(searchFields.map((field) => [field, "=ilike", clean]))
  const domain = andDomain(searchDomain, employeeTripDomain(employee))
  const records = await searchRead<OdooTrip>(c.viajesModel!, domain, tripFields, { limit: 5 })
  const trips = records.map(mapTrip).filter((trip) => trip.estado !== "planeado" && (canViewAllLocations(employee) || locationsMatch(employee?.work_location, trip.almacen)))
  return trips[0] || null
}

// Actualiza el estado del viaje y guarda fechas de entrada o salida cuando aplica.
async function updateTripStatus(folio: string, newStatus: string, additionalData: Record<string, unknown> = {}) {
  const c = cfg()
  const trip = await getTripByCode(folio)
  if (!trip?.id) return null

  const status = STATUS_TO_ODOO[newStatus]
  if (!status) throw new Error(`Estado de viaje no soportado: ${newStatus}`)

  const values: Record<string, unknown> = { x_studio_selection_field_8eu_1jmu93j7v: status }
  if (additionalData.fecha_entrada) values.x_studio_entrada = toOdooDatetime(additionalData.fecha_entrada)
  if (additionalData.fecha_salida) values.x_studio_salida = toOdooDatetime(additionalData.fecha_salida)

  const fallbackValues = { ...values }
  const employeeId = Number(additionalData.employeeId)
  if (Number.isFinite(employeeId) && employeeId > 0) {
    if (["en_espera", "en_revision"].includes(newStatus)) values[c.tripOperatorEntryField] = employeeId
    if (newStatus === "finalizado") values[c.tripOperatorExitField] = employeeId
  }

  await safeWrite(c.viajesModel!, [trip.id], values, fallbackValues)
  if (["en_espera", "en_revision", "finalizado"].includes(newStatus)) {
    await acknowledgeTripNotifications(trip.id)
  }
  return getTripByCode(folio)
}

async function getFleetVehicles() {
  type FleetVehicleRecord = {
    id: number
    name?: string
    license_plate?: string
    active?: boolean
    driver_employee_id?: OdooIdName
    state_id?: OdooIdName
  }

  let available: Set<string>
  try {
    available = await getModelFields("fleet.vehicle")
  } catch (error: any) {
    throw new Error(
      `No pude leer el modelo de Flotilla (fleet.vehicle). Da permisos de Flotilla/Encargado o Flotilla/Administrador al usuario API. Detalle: ${error?.message || error}`
    )
  }

  const domain = available.has("active") ? [["active", "=", true]] : []

  // IMPORTANTE:
  // En fleet.vehicle, display_name existe en la vista pero no está almacenado en SQL.
  // Si se solicita u ordena por display_name desde RPC, Odoo puede regresar:
  // "Cannot convert field fleet.vehicle.display_name to SQL because it is not stored".
  // Por eso solo pedimos campos almacenados y ordenamos por name o license_plate.
  const fields = ["id", "name", "license_plate", "active", "driver_employee_id", "state_id"].filter((field) =>
    field === "id" || available.has(field),
  )

  const orderField = available.has("name") ? "name" : available.has("license_plate") ? "license_plate" : "id"

  let records: FleetVehicleRecord[]
  try {
    records = await searchRead<FleetVehicleRecord>("fleet.vehicle", domain, fields, {
      limit: 300,
      order: `${orderField} asc`,
    })
  } catch (error: any) {
    throw new Error(
      `No pude cargar vehículos de Flotilla. Revisa permisos del usuario API sobre fleet.vehicle. Detalle: ${error?.message || error}`
    )
  }

  return records.map((vehicle) => {
    const vehicleName = vehicle.name || ""
    const plate = vehicle.license_plate || ""
    const baseName = vehicleName || plate || `Vehículo ${vehicle.id}`
    const driver = nameOf(vehicle.driver_employee_id)

    return {
      id: vehicle.id,
      name: plate && !baseName.includes(plate) ? `${baseName} / ${plate}` : baseName,
      license_plate: plate,
      driver,
      state: nameOf(vehicle.state_id),
    }
  })
}

async function findFleetVehicleId(value?: string) {
  const term = String(value || "").trim()
  if (!term) return null

  const numericId = Number(term)
  if (Number.isSafeInteger(numericId) && numericId > 0) {
    const records = await searchRead<{ id: number }>("fleet.vehicle", [["id", "=", numericId]], ["id"], { limit: 1 })
    if (records[0]?.id) return records[0].id
  }

  const found = await callKw<Array<[number, string]>>(
    "fleet.vehicle",
    "name_search",
    [term],
    { operator: "ilike", limit: 1 },
  )

  return found?.[0]?.[0] || null
}

async function getAccessRecords(employee?: { id?: number; work_location?: string; work_location_id?: number; can_view_all_locations?: boolean }) {
  const c = cfg()
  const available = await getModelFields(c.accessModel!)
  let domain: unknown[] = [["x_studio_selection_field_87c_1jnb97pu7", "!=", "status3"]]

  if (!canViewAllLocations(employee) && employee?.work_location && available.has(c.accessPlantField)) {
    domain = andDomain(domain, [[c.accessPlantField, "ilike", String(employee.work_location)]])
  }

  const records = await searchRead<OdooAccess>(
    c.accessModel!,
    domain,
    accessFields,
    { limit: 100, order: "id desc" },
  )
  const mapped = records.map(mapAccess)
  if (canViewAllLocations(employee)) return mapped
  return mapped.filter((record) => !record.planta || locationsMatch(employee?.work_location, record.planta))
}

// Crea en Odoo una entrada manual para visitante, proveedor o unidad interna.
async function createAccessRecord(data: any) {
  const c = cfg()
  const vehicleType = data.vehiculo === "Vehículo PURP" ? "Vehículo PURP" : "Otro vehículo"

  const values: Record<string, unknown> = {
    x_name: data.nombre,
    x_studio_vehiculo: vehicleType,
    x_studio_entrada_planta: nowOdooDatetime(),
    x_studio_selection_field_87c_1jnb97pu7: "status2",
  }

  const employeeId = Number(data.employeeId)
  if (Number.isFinite(employeeId) && employeeId > 0) {
    values[c.accessOperatorEntryField] = employeeId
  }

  const accessEmployeeId = Number(data.accessEmployeeId)
  if (Number.isFinite(accessEmployeeId) && accessEmployeeId > 0) {
    values[c.accessPersonEmployeeField] = accessEmployeeId
  }

  if (data.work_location) {
    values[c.accessPlantField] = String(data.work_location)
  }

  if (vehicleType === "Vehículo PURP") {
    const maybeId = Number(data.vehiculo_purp)
    if (Number.isFinite(maybeId) && maybeId > 0) {
      values.x_studio_vehiculo_purp = maybeId
    } else {
      const vehicleId = await findFleetVehicleId(data.vehiculo_purp)
      if (!vehicleId) {
        throw new Error(`No encontré el vehículo PURP en fleet.vehicle: ${data.vehiculo_purp}`)
      }
      values.x_studio_vehiculo_purp = vehicleId
    }
  } else {
    values.x_studio_descripcion_del_vehiculo = data.descripcion_vehiculo
  }

  const id = await callKw<number>(c.accessModel!, "create", [await existingValues(c.accessModel!, values)])
  const records = await readRecords<OdooAccess>(c.accessModel!, [id], accessFields)
  return records[0] ? mapAccess(records[0]) : null
}

// Registra en Odoo la salida de una persona o vehículo que ya estaba dentro.
async function registerAccessExit(id: string, employeeId?: number) {
  const c = cfg()
  const recordId = Number(id)
  if (!Number.isFinite(recordId)) throw new Error(`ID de acceso inválido: ${id}`)

  const values: Record<string, unknown> = {
    x_studio_salida_planta: nowOdooDatetime(),
    x_studio_selection_field_87c_1jnb97pu7: "status3",
  }
  const employee = Number(employeeId)
  if (Number.isFinite(employee) && employee > 0) {
    values[c.accessOperatorExitField] = employee
  }

  await safeWrite(c.accessModel!, [recordId], values)

  const records = await readRecords<OdooAccess>(c.accessModel!, [recordId], accessFields)
  return records[0] ? mapAccess(records[0]) : { id, estado: "salida", fecha_salida: nowOdooDatetime() }
}

function stripHtml(value?: string) {
  return String(value || "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .trim()
}

function hoursAgoOdooDatetime(hours: number) {
  const safeHours = Number.isFinite(hours) && hours > 0 ? hours : 48
  return new Date(Date.now() - safeHours * 60 * 60 * 1000).toISOString().slice(0, 19).replace("T", " ")
}

type AckCache = {
  ids: Set<string>
  loadedAt: number
  persistAvailable?: boolean
}

const globalForNotifications = globalThis as typeof globalThis & {
  __guardNotificationAckCache?: AckCache
}

const ackCache = globalForNotifications.__guardNotificationAckCache ?? {
  ids: new Set<string>(),
  loadedAt: 0,
}

globalForNotifications.__guardNotificationAckCache = ackCache

async function readAcknowledgedNotificationIds() {
  const c = cfg()
  if (Date.now() - ackCache.loadedAt < 10_000) return ackCache.ids

  try {
    const value = await callKw<string | false>("ir.config_parameter", "get_param", [c.notificationAckParamKey])
    const parsed = JSON.parse(String(value || "[]"))
    ackCache.ids = new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [])
    ackCache.persistAvailable = true
  } catch (error) {
    ackCache.persistAvailable = false
    console.warn("No pude leer notificaciones atendidas en ir.config_parameter. Uso memoria del servidor.", error)
  }

  ackCache.loadedAt = Date.now()
  return ackCache.ids
}

async function writeAcknowledgedNotificationIds(ids: Set<string>) {
  const c = cfg()
  const limited = Array.from(ids).slice(-1000)
  ackCache.ids = new Set(limited)
  ackCache.loadedAt = Date.now()

  try {
    await callKw<boolean>("ir.config_parameter", "set_param", [c.notificationAckParamKey, JSON.stringify(limited)])
    ackCache.persistAvailable = true
  } catch (error: any) {
    ackCache.persistAvailable = false
    throw new Error(`No pude guardar la notificación como enterada de forma global en Odoo. Da permisos de Ajustes/Parámetros del sistema al usuario API o crea acceso a ir.config_parameter. Detalle: ${error?.message || error}`)
  }
}

async function acknowledgeTripNotifications(tripId?: number) {
  if (!tripId) return
  const c = cfg()
  const messages = await searchRead<OdooChatterMessage>(
    "mail.message",
    [
      ["model", "=", c.viajesModel],
      ["res_id", "=", tripId],
      ["message_type", "=", "comment"],
      ["date", ">=", hoursAgoOdooDatetime(c.chatterLookbackHours)],
    ],
    ["id"],
    { limit: 100 },
  )
  const ids = await readAcknowledgedNotificationIds()
  for (const message of messages) {
    ids.add(`mail.message:${message.id}`)
  }
  await writeAcknowledgedNotificationIds(ids)
}

// Revisa mensajes recientes y banderas de Odoo para avisar a caseta sobre correcciones o pendientes.
async function getGuardNotifications(employee?: { id?: number; work_location?: string; can_view_all_locations?: boolean }) {
  const c = cfg()

  const tripFieldsForNotifications = ["x_name", "x_studio_selection_field_8eu_1jmu93j7v", c.tripWarehouseField]
  const trips = await searchRead<OdooTrip>(c.viajesModel!, [], tripFieldsForNotifications, {
    limit: 200,
    order: "id desc",
  })

  const tripById = new Map<number, { folio: string; status: string; warehouse: string }>()
  for (const trip of trips) {
    const status = STATUS_FROM_ODOO[trip.x_studio_selection_field_8eu_1jmu93j7v || ""] || "en_camino"
    const warehouse = nameOf(trip[c.tripWarehouseField] as OdooIdName | number | string)
    if (
      trip.id &&
      trip.x_name &&
      ["en_camino", "en_revision"].includes(status) &&
(canViewAllLocations(employee) || locationsMatch(employee?.work_location, warehouse))
    ) {
      tripById.set(trip.id, { folio: trip.x_name, status, warehouse })
    }
  }

  if (tripById.size === 0) return []
  const acknowledgedIds = await readAcknowledgedNotificationIds()

  const domain: unknown[] = [
    ["model", "=", c.viajesModel],
    ["res_id", "in", Array.from(tripById.keys())],
    ["message_type", "=", "comment"],
    ["date", ">=", hoursAgoOdooDatetime(c.chatterLookbackHours)],
  ]

  const records = await searchRead<OdooChatterMessage>("mail.message", domain, ["id", "res_id", "body", "date", "author_id", "subject", "message_type"], {
    limit: 100,
    order: "id desc",
  })

  return records
    .map((message) => {
      const trip = tripById.get(message.res_id)
      const folio = trip?.folio || String(message.res_id)
      const author = nameOf(message.author_id)
      const body = stripHtml(message.body)
      const prefix = author ? `${author}: ` : ""
      return {
        id: `mail.message:${message.id}`,
        messageId: message.id,
        folio,
        almacen: trip?.warehouse,
        tripId: message.res_id,
        title: `Nuevo comentario en ${folio}`,
        message: body ? `${prefix}${body}` : `${prefix}Se agregó un comentario al chatter.`,
        date: message.date,
      }
    })
    .filter((item) => item.message.trim().length > 0 && !acknowledgedIds.has(item.id))
}

// Marca una notificación como atendida para que no siga apareciendo al guardia.
async function acknowledgeGuardNotification(id: string) {
  const ids = await readAcknowledgedNotificationIds()
  ids.add(String(id))
  await writeAcknowledgedNotificationIds(ids)
  return { ok: true, id }
}

// Punto de entrada único: recibe la acción solicitada por la app y llama a la función correspondiente.
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { action } = body
    let data: unknown

    if (action === "ping") data = { uid: await authenticate(), ok: true }
    else if (action === "employeeLogin") data = await employeeLogin(body.code)
    else if (action === "lookupEmployeeAccess") data = await lookupEmployeeAccess(body.code)
    else if (action === "getTripByCode") data = await getTripByCode(body.code, body.employee)
    else if (action === "getAllTrips") data = await getTrips([["x_studio_selection_field_8eu_1jmu93j7v", "!=", "status1"]], body.employee)
    else if (action === "updateTripStatus") data = await updateTripStatus(body.folio, body.newStatus, body.additionalData || {})
    else if (action === "getAccessRecords") data = await getAccessRecords(body.employee)
    else if (action === "createAccessRecord") data = await createAccessRecord(body.data)
    else if (action === "registerAccessExit") data = await registerAccessExit(body.id, body.employeeId)
    else if (action === "getFleetVehicles") data = await getFleetVehicles()
    else if (action === "getGuardNotifications") data = await getGuardNotifications(body.employee)
    else if (action === "acknowledgeGuardNotification") data = await acknowledgeGuardNotification(body.id)
    else throw new Error(`Acción no soportada: ${action}`)

    return NextResponse.json({ ok: true, data })
  } catch (error: any) {
    console.error("/api/odoo error", error)
    return NextResponse.json({ ok: false, error: error?.message || "Error desconocido" }, { status: 500 })
  }
}
