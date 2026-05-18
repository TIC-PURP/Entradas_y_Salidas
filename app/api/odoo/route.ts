import { NextResponse } from "next/server"

type OdooIdName = false | [number, string]

type OdooTrip = {
  id: number
  x_name?: string
  x_studio_orden_de_venta?: OdooIdName
  x_studio_transferencia?: OdooIdName
  x_studio_chofer?: string
  x_studio_placa?: string
  x_studio_linea_fletera_1?: OdooIdName
  x_studio_selection_field_8eu_1jmu93j7v?: string
  x_studio_entrada?: string
  x_studio_salida?: string
}

type OdooAccess = {
  id: number
  x_name?: string
  x_studio_vehiculo?: string
  x_studio_vehiculo_purp?: OdooIdName
  x_studio_descripcion_del_vehiculo?: string
  x_studio_entrada_planta?: string
  x_studio_salida_planta?: string
  x_studio_selection_field_87c_1jnb97pu7?: string
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

const ACCESS_TO_ODOO: Record<string, string> = {
  entrada: "status1",
  en_planta: "status2",
  salida: "status3",
}

const ACCESS_FROM_ODOO: Record<string, string> = Object.fromEntries(
  Object.entries(ACCESS_TO_ODOO).map(([key, value]) => [value, key]),
)

const cfg = () => ({
  url: process.env.ODOO_URL?.trim().replace(/\/+$/, "").replace(/\/odoo$/, ""),
  db: process.env.ODOO_DB?.trim(),
  username: process.env.ODOO_USERNAME?.trim(),
  apiKey: process.env.ODOO_API_KEY?.trim(),
  viajesModel: process.env.ODOO_VIAJES_MODEL?.trim() || "x_viajes",
  accessModel: process.env.ODOO_ACCESS_MODEL?.trim() || "x_control_de_acceso",
  notifyField: process.env.ODOO_NOTIFY_FIELD?.trim() || "x_studio_notificar_guardia",
  chatterLookbackHours: Number(process.env.ODOO_CHATTER_LOOKBACK_HOURS || "48"),
})

function requireConfig() {
  const c = cfg()
  const missing = Object.entries(c).filter(([key, value]) => ["url", "db", "username", "apiKey"].includes(key) && !value)
  if (missing.length) throw new Error(`Faltan variables .env.local: ${missing.map(([key]) => key).join(", ")}`)
  return c as Required<ReturnType<typeof cfg>>
}

function rpcMessage(payload: OdooRpcError, fallback = "Error RPC de Odoo") {
  return payload.error?.data?.message || payload.error?.message || fallback
}

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

async function authenticate(): Promise<number> {
  const c = requireConfig()
  const uid = await odooRpc<number | false>("common", "authenticate", [c.db, c.username, c.apiKey, {}])
  if (!uid) {
    throw new Error("No se pudo autenticar con Odoo. Revisa ODOO_DB, ODOO_USERNAME, ODOO_API_KEY y que la API Key pertenezca a esta misma base/usuario.")
  }
  return uid
}

async function callKw<T>(model: string, method: string, args: unknown[] = [], kwargs: Record<string, unknown> = {}): Promise<T> {
  const c = requireConfig()
  const uid = await authenticate()
  return await odooRpc<T>("object", "execute_kw", [c.db, uid, c.apiKey, model, method, args, kwargs])
}

function nameOf(value?: OdooIdName | number | string) {
  if (Array.isArray(value)) return value[1]
  if (typeof value === "number") return String(value)
  return String(value || "")
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

function mapTrip(record: OdooTrip) {
  return {
    id: record.id,
    folio: record.x_name || "",
    orden: nameOf(record.x_studio_orden_de_venta),
    movimiento_origen: nameOf(record.x_studio_transferencia),
    chofer: record.x_studio_chofer || "",
    placas: record.x_studio_placa || "",
    linea_fletera: nameOf(record.x_studio_linea_fletera_1),
    estado: STATUS_FROM_ODOO[record.x_studio_selection_field_8eu_1jmu93j7v || ""] || "en_camino",
    fecha_entrada: record.x_studio_entrada || undefined,
    fecha_salida: record.x_studio_salida || undefined,
  }
}

function mapAccess(record: OdooAccess) {
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
]

const accessFields = [
  "x_name",
  "x_studio_vehiculo",
  "x_studio_vehiculo_purp",
  "x_studio_descripcion_del_vehiculo",
  "x_studio_entrada_planta",
  "x_studio_salida_planta",
  "x_studio_selection_field_87c_1jnb97pu7",
]

async function getTrips(domain: unknown[] = []) {
  const c = cfg()
  const records = await callKw<OdooTrip[]>(c.viajesModel!, "search_read", [domain], { fields: tripFields, limit: 100, order: "id desc" })
  return records.map(mapTrip)
}

async function getTripByCode(code: string) {
  const c = cfg()
  const clean = String(code || "").trim()
  const domain: unknown[] = ["|", "|", ["x_name", "=ilike", clean], ["x_studio_placa", "=ilike", clean], ["x_studio_chofer", "=ilike", clean]]
  const records = await callKw<OdooTrip[]>(c.viajesModel!, "search_read", [domain], { fields: tripFields, limit: 1 })
  const trip = records[0] ? mapTrip(records[0]) : null
  if (trip?.estado === "planeado") return null
  return trip
}

async function updateTripStatus(folio: string, newStatus: string, additionalData: Record<string, unknown> = {}) {
  const c = cfg()
  const trip = await getTripByCode(folio)
  if (!trip?.id) return null

  const status = STATUS_TO_ODOO[newStatus]
  if (!status) throw new Error(`Estado de viaje no soportado: ${newStatus}`)

  const values: Record<string, unknown> = { x_studio_selection_field_8eu_1jmu93j7v: status }
  if (additionalData.fecha_entrada) values.x_studio_entrada = toOdooDatetime(additionalData.fecha_entrada)
  if (additionalData.fecha_salida) values.x_studio_salida = toOdooDatetime(additionalData.fecha_salida)

  await callKw<boolean>(c.viajesModel!, "write", [[trip.id], values])
  return getTripByCode(folio)
}

async function getFleetVehicles() {
  const records = await callKw<Array<{ id: number; display_name?: string; name?: string; license_plate?: string }>>(
    "fleet.vehicle",
    "search_read",
    [[]],
    { fields: ["display_name", "name", "license_plate"], limit: 200, order: "display_name asc" },
  )

  return records.map((vehicle) => ({
    id: vehicle.id,
    name: vehicle.display_name || vehicle.name || vehicle.license_plate || String(vehicle.id),
    license_plate: vehicle.license_plate || "",
  }))
}

async function findFleetVehicleId(value?: string) {
  const term = String(value || "").trim()
  if (!term) return null

  const found = await callKw<Array<[number, string]>>(
    "fleet.vehicle",
    "name_search",
    [term],
    { operator: "ilike", limit: 1 },
  )

  return found?.[0]?.[0] || null
}

async function getAccessRecords() {
  const c = cfg()
  const records = await callKw<OdooAccess[]>(
    c.accessModel!,
    "search_read",
    [[ ["x_studio_selection_field_87c_1jnb97pu7", "!=", "status3"] ]],
    { fields: accessFields, limit: 100, order: "id desc" },
  )
  return records.map(mapAccess)
}

async function createAccessRecord(data: any) {
  const c = cfg()
  const vehicleType = data.vehiculo === "Vehículo PURP" ? "Vehículo PURP" : "Otro vehículo"

  const values: Record<string, unknown> = {
    x_name: data.nombre,
    x_studio_vehiculo: vehicleType,
    x_studio_entrada_planta: nowOdooDatetime(),
    x_studio_selection_field_87c_1jnb97pu7: "status2",
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

  const id = await callKw<number>(c.accessModel!, "create", [values])
  const records = await callKw<OdooAccess[]>(c.accessModel!, "read", [[id]], { fields: accessFields })
  return records[0] ? mapAccess(records[0]) : null
}

async function registerAccessExit(id: string) {
  const c = cfg()
  const recordId = Number(id)
  if (!Number.isFinite(recordId)) throw new Error(`ID de acceso inválido: ${id}`)

  await callKw<boolean>(c.accessModel!, "write", [[recordId], {
    x_studio_salida_planta: nowOdooDatetime(),
    x_studio_selection_field_87c_1jnb97pu7: "status3",
  }])

  const records = await callKw<OdooAccess[]>(c.accessModel!, "read", [[recordId]], { fields: accessFields })
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

async function getGuardNotifications() {
  const c = cfg()

  const trips = await callKw<OdooTrip[]>(c.viajesModel!, "search_read", [[]], {
    fields: ["x_name", "x_studio_selection_field_8eu_1jmu93j7v"],
    limit: 200,
    order: "id desc",
  })

  const tripById = new Map<number, string>()
  for (const trip of trips) {
    if (trip.id && trip.x_name) tripById.set(trip.id, trip.x_name)
  }

  if (tripById.size === 0) return []

  const domain: unknown[] = [
    ["model", "=", c.viajesModel],
    ["res_id", "in", Array.from(tripById.keys())],
    ["message_type", "=", "comment"],
    ["date", ">=", hoursAgoOdooDatetime(c.chatterLookbackHours)],
  ]

  const records = await callKw<OdooChatterMessage[]>("mail.message", "search_read", [domain], {
    fields: ["id", "res_id", "body", "date", "author_id", "subject", "message_type"],
    limit: 100,
    order: "id desc",
  })

  return records
    .map((message) => {
      const folio = tripById.get(message.res_id) || String(message.res_id)
      const author = nameOf(message.author_id)
      const body = stripHtml(message.body)
      const prefix = author ? `${author}: ` : ""
      return {
        id: `mail.message:${message.id}`,
        messageId: message.id,
        folio,
        tripId: message.res_id,
        title: `Nuevo comentario en ${folio}`,
        message: body ? `${prefix}${body}` : `${prefix}Se agregó un comentario al chatter.`,
        date: message.date,
      }
    })
    .filter((item) => item.message.trim().length > 0)
}

async function acknowledgeGuardNotification(id: string) {
  // Las notificaciones de chatter se marcan como leídas del lado de la PWA
  // con localStorage. No se modifica el mensaje original en Odoo.
  return { ok: true, id }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { action } = body
    let data: unknown

    if (action === "ping") data = { uid: await authenticate(), ok: true }
    else if (action === "getTripByCode") data = await getTripByCode(body.code)
    else if (action === "getAllTrips") data = await getTrips([["x_studio_selection_field_8eu_1jmu93j7v", "!=", "status1"]])
    else if (action === "updateTripStatus") data = await updateTripStatus(body.folio, body.newStatus, body.additionalData || {})
    else if (action === "getAccessRecords") data = await getAccessRecords()
    else if (action === "createAccessRecord") data = await createAccessRecord(body.data)
    else if (action === "registerAccessExit") data = await registerAccessExit(body.id)
    else if (action === "getFleetVehicles") data = await getFleetVehicles()
    else if (action === "getGuardNotifications") data = await getGuardNotifications()
    else if (action === "acknowledgeGuardNotification") data = await acknowledgeGuardNotification(body.id)
    else throw new Error(`Acción no soportada: ${action}`)

    return NextResponse.json({ ok: true, data })
  } catch (error: any) {
    console.error("/api/odoo error", error)
    return NextResponse.json({ ok: false, error: error?.message || "Error desconocido" }, { status: 500 })
  }
}
