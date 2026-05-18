/**
 * Helpers para conectar con Odoo desde el servidor.
 *
 * Esta capa se usa en el route handler de la API interna de Next.js
 * para proteger las credenciales de la aplicación y evitar exponerlas
 * al cliente.
 */

type OdooAuthResult = {
  uid: number
  session_id: string
  cookie: string
}

const requiredEnv = (value: string | undefined, name: string): string => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

const ODOO_URL = requiredEnv(process.env.ODOO_URL, 'ODOO_URL').replace(/\/+$/, '')
const ODOO_DB = requiredEnv(process.env.ODOO_DB, 'ODOO_DB')
const ODOO_USERNAME = requiredEnv(process.env.ODOO_USERNAME, 'ODOO_USERNAME')
const ODOO_API_KEY = requiredEnv(process.env.ODOO_API_KEY, 'ODOO_API_KEY')

const JSON_HEADERS = {
  'Content-Type': 'application/json',
}

const buildOdooUrl = (path: string) => `${ODOO_URL}${path}`

const authenticate = async (): Promise<OdooAuthResult> => {
  const response = await fetch(buildOdooUrl('/web/session/authenticate'), {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      jsonrpc: '2.0',
      params: {
        db: ODOO_DB,
        login: ODOO_USERNAME,
        password: ODOO_API_KEY,
      },
    }),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`Odoo authentication failed: ${message}`)
  }

  const payload = await response.json()
  if (payload.error) {
    throw new Error(`Odoo authentication error: ${payload.error.message || JSON.stringify(payload.error)}`)
  }

  const cookie = response.headers.get('set-cookie')
  if (!cookie) {
    throw new Error('Odoo authentication did not return a session cookie.')
  }

  return {
    uid: payload.result.uid,
    session_id: payload.result.session_id,
    cookie,
  }
}

const odooJsonRpc = async (
  path: string,
  params: Record<string, unknown>,
  cookie?: string,
) => {
  const response = await fetch(buildOdooUrl(path), {
    method: 'POST',
    headers: {
      ...JSON_HEADERS,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params,
    }),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`Odoo request failed (${response.status}): ${message}`)
  }

  const payload = await response.json()

  if (payload.error) {
    throw new Error(`Odoo JSON-RPC error: ${payload.error.message || JSON.stringify(payload.error)}`)
  }

  return payload.result
}

export const searchRead = async (
  model: string,
  domain: unknown[] = [],
  fields: string[] = [],
  limit?: number,
) => {
  const auth = await authenticate()
  const params: Record<string, unknown> = {
    model,
    method: 'search_read',
    args: [domain],
    kwargs: {
      fields,
    },
  }

  if (typeof limit === 'number') {
    params.kwargs = {
      ...(params.kwargs as Record<string, unknown>),
      limit,
    }
  }

  return await odooJsonRpc(`/web/dataset/call_kw/${model}/search_read`, params, auth.cookie)
}

export const createRecord = async (model: string, values: Record<string, unknown>) => {
  const auth = await authenticate()
  return await odooJsonRpc(
    `/web/dataset/call_kw/${model}/create`,
    {
      model,
      method: 'create',
      args: [values],
      kwargs: {},
    },
    auth.cookie,
  )
}

export const writeRecord = async (
  model: string,
  ids: number[] | number,
  values: Record<string, unknown>,
) => {
  const auth = await authenticate()
  return await odooJsonRpc(
    `/web/dataset/call_kw/${model}/write`,
    {
      model,
      method: 'write',
      args: [Array.isArray(ids) ? ids : [ids], values],
      kwargs: {},
    },
    auth.cookie,
  )
}
