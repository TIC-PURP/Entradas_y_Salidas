# Entradas y Salidas - PWA conectada a Odoo

PWA para control de entradas/salidas y logistica conectada directamente a Odoo mediante la API interna de Next.js.

## Principios de esta version

- No usa datos simulados ni datos de prueba locales.
- Todas las consultas y escrituras pasan por Odoo.
- Para probar contra una base de pruebas, cambia `ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME` y `ODOO_API_KEY` en `.env.local`.
- `.env.local` no debe subirse a GitHub ni compartirse.

Variables obligatorias para despliegue:

```text
ODOO_URL
ODOO_DB
ODOO_USERNAME
ODOO_API_KEY
APP_SESSION_SECRET
APP_ORIGIN
```

`APP_SESSION_SECRET` debe ser un valor aleatorio de al menos 32 caracteres y distinto de la API Key de Odoo. `APP_ORIGIN` debe ser el origen HTTPS publico exacto de la PWA, por ejemplo `https://entradas.example.com`.

Configuracion recomendada:

```text
API_REQUIRE_SAME_ORIGIN=true
API_RATE_LIMIT_WINDOW_MS=60000
API_RATE_LIMIT_MAX=10
```

## Conexion Odoo

La conexion esta en:

```text
app/api/odoo/route.ts
```

La PWA consume:

```text
/app/api/odoo
```

El backend se conecta a Odoo con JSON-RPC:

```text
/jsonrpc
service: common / object
method: authenticate / execute_kw
```

## Permisos PWA

La PWA consulta el modelo:

```text
x_permisos_pwa
```

Campos principales:

```text
x_studio_usuario_odoo
x_studio_empleado
x_studio_rol_pwa
x_studio_requiere_gafete
x_studio_puede_abrir_odoo
x_studio_puede_entradasalida
x_studio_ve_logistica
x_studio_ve_todos_los_almacenes
x_studio_planta_predeterminada
```

Flujo:

1. El usuario inicia sesion con credenciales de Odoo.
2. La PWA consulta sus permisos en `x_permisos_pwa`.
3. Si `x_studio_requiere_gafete = true`, solicita escanear gafete/NIP.
4. Las acciones operativas se registran con el empleado en:
   - `x_studio_operador_entrada`
   - `x_studio_operador_salida`
5. La visibilidad se filtra por `x_studio_planta_predeterminada`, salvo que `x_studio_ve_todos_los_almacenes = true`.

## Modelos usados

### Viajes

```text
x_viajes
```

Campo de estado:

```text
x_studio_selection_field_8eu_1jmu93j7v
```

Estados usados por la PWA:

```text
status2 -> En camino
status3 -> En revision
status4 -> En espera
status5 -> En bascula
status6 -> Embarque
status7 -> En bascula y sellos
status8 -> Finalizado
```

### Entrada / Salida

```text
x_control_de_acceso
```

Campos principales:

```text
x_studio_folio
x_studio_planta
x_studio_vehiculo
x_studio_vehiculo_purp
x_studio_descripcion_del_vehiculo
x_studio_entrada_planta
x_studio_salida_planta
x_studio_operador_entrada
x_studio_operador_salida
x_studio_selection_field_87c_1jnb97pu7
```

Estados:

```text
status1 -> Entrada
status2 -> Planta
status3 -> Salida
```

## Comandos

Instalar:

```powershell
npm install
```

Desarrollo:

```powershell
npm run dev
```

Desarrollo con HTTPS local para camara en red:

```powershell
npm run dev:https
```

Validar:

```powershell
npm run lint
npm run typecheck
npm run build
npm audit --omit=dev --audit-level=moderate
```

Produccion:

```powershell
npm start
```

## Seguridad

- Usa un usuario tecnico dedicado para la API.
- Las operaciones autenticadas usan una cookie de sesion firmada, `HttpOnly`, `SameSite=Strict` y segura en produccion; el servidor vuelve a obtener permisos desde Odoo.
- No confies en el contexto enviado por el navegador: planta, permisos y operador se validan del lado servidor.
- Mantiene `API_REQUIRE_SAME_ORIGIN=true` y configura limites de intentos para login.
- Revoca cualquier API Key que haya sido expuesta por capturas, ZIP o GitHub.
- Usa HTTPS en produccion.
- No habilites datos simulados en produccion; esta version no incluye modo simulado.

## Organizacion aplicada

Esta version mantiene la operacion en la pantalla principal (`app/page.tsx`) para que todos los flujos respeten la misma sesion Odoo/PWA y los permisos dinamicos.

Se eliminaron vistas heredadas que consultaban datos sin contexto de permisos:

```text
/app/viajes
/app/accesos
```

Esas rutas ahora redirigen a `/` para evitar pantallas paralelas sin sesion, sin planta activa o sin empleado operativo.

Tambien se limpiaron archivos no usados:

```text
components/TripCard.tsx
lib/odoo.ts
styles/globals.css
postcss.config.js
tsconfig.tsbuildinfo
```

La tarjeta activa de viajes es:

```text
components/trip-card.tsx
```

La capa cliente para hablar con el backend esta en:

```text
lib/api.ts
```

La capa servidor que habla con Odoo esta en:

```text
app/api/odoo/route.ts
```

Esto reduce duplicidad y evita que existan dos flujos distintos para viajes o entradas/salidas.
