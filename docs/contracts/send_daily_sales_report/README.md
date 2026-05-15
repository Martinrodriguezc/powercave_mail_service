# POST /mail/send_daily_sales_report

## Propósito

Envía al equipo administrativo del gimnasio un resumen diario de ventas, desglosado en tres categorías: planes/membresías, alimentos (suplementos, snacks, bebidas) y mercadería (ropa, accesorios). Cada categoría trae el listado individual de ventas con cliente, producto, monto y hora, más un subtotal. Adicionalmente incluye el `totalRevenue` global del día. Lo dispara un job programado del backend (`sales_registry`) una vez al día.

## Autenticación

- Mecanismo: API Key
- Middleware: `requireApiKey` (`internal/middleware.ts/apiKeyAuth.ts`)
- Comparación en tiempo constante (`crypto.timingSafeEqual`).

## Request

### Headers

| Header | Valor | Requerido |
|---|---|---|
| `Content-Type` | `application/json` | Sí |
| `X-API-Key` | `<MAIL_SERVICE_API_KEY>` | Sí |

### Body

El controller pasa el body crudo (`req.body`) al servicio. El tipo es `DailySalesReportMail` (`internal/domain/mail.ts`). Validaciones server-side (en `sales_service.ts`):

- `to` requerido (truthy).
- `subject` requerido (truthy).
- `reportDate` requerido (truthy).
- `totalRevenue` debe ser `typeof === 'number'`.
- `sentBy` lo provee el controller con default `'sales_registry_backend'`.

**Las tres categorías (`planSales`, `foodSales`, `merchandiseSales`) NO se validan explícitamente** en el servicio — el helper accede directamente a `opts.planSales.sales`, `opts.planSales.totalAmount`, etc. Si alguna categoría falta o no tiene la forma esperada, se rompe en el renderer con un `TypeError` no controlado (que termina como 500). El backend tiene que enviar las tres siempre.

```
{
  "to": "...",
  "subject": "...",
  "gymName": "...",
  "logoUrl": "...",
  "reportDate": "...",
  "totalRevenue": 285000,
  "planSales": {
    "totalAmount": 180000,
    "sales": [
      { "clientName": "...", "planName": "...", "amount": 45000, "time": "09:15" }
    ]
  },
  "foodSales": {
    "totalAmount": 35000,
    "sales": [
      { "clientName": "...", "foodName": "...", "amount": 5500, "time": "10:23" }
    ]
  },
  "merchandiseSales": {
    "totalAmount": 70000,
    "sales": [
      { "clientName": "...", "productName": "...", "amount": 25000, "time": "12:18" }
    ]
  }
}
```

| Campo | Tipo | Requerido | Validación / descripción |
|---|---|---|---|
| `to` | `string` (email) | Sí | Destinatario único. Solo validación de truthy. |
| `subject` | `string` | Sí | Asunto del correo. Truthy. |
| `gymName` | `string` | No (efectivo) | Si falta se renderiza como `""`. |
| `logoUrl` | `string \| null` | No | URL HTTPS del logo (sin validación de schema). Adjuntado como inline-CID. |
| `reportDate` | `string` | Sí | String pre-formateado por el backend (formato libre, p. ej. `"15 de mayo de 2026"`). Se interpola tal cual. |
| `sentBy` | `string` | No | Default `'sales_registry_backend'`. **No se pasa a `sendMail`** en este endpoint (se ignora; el servicio omite `userName`). |
| `totalRevenue` | `number` | Sí | Total global del día en CLP. **Debe ser número** (validado). Se formatea server-side con `toLocaleString("es-CL")`. |
| `planSales` | `{ totalAmount, sales: [] }` | Sí (de facto) | Categoría de ventas de planes/membresías. Ver subtabla. |
| `foodSales` | `{ totalAmount, sales: [] }` | Sí (de facto) | Categoría de ventas de alimentos/suplementos. Ver subtabla. |
| `merchandiseSales` | `{ totalAmount, sales: [] }` | Sí (de facto) | Categoría de ventas de mercadería/tienda. Ver subtabla. |

**Estructura de cada categoría:**

| Campo | Tipo | Requerido | Validación / descripción |
|---|---|---|---|
| `totalAmount` | `number` | Sí (de facto) | Subtotal de la categoría en CLP. Se formatea con `toLocaleString("es-CL")`. **No se valida** contra la suma de `sales[].amount` — el servidor confía. |
| `sales` | `Array<Sale>` | Sí (de facto) | Lista de ventas individuales. Si está vacío, se renderiza párrafo "No se registraron ventas de … hoy." (mensaje específico por categoría). |

**Item de venta (`Sale`)** — la **clave del nombre del item cambia por categoría**:

| Campo | Tipo | Requerido | Validación / descripción |
|---|---|---|---|
| `clientName` | `string` | Sí (de facto) | Nombre del cliente. Sin escape HTML. |
| `planName` | `string` | Sí en `planSales` | Nombre del plan. Solo en items de `planSales`. |
| `foodName` | `string` | Sí en `foodSales` | Nombre del alimento/suplemento. Solo en items de `foodSales`. |
| `productName` | `string` | Sí en `merchandiseSales` | Nombre del producto. Solo en items de `merchandiseSales`. |
| `amount` | `number` | Sí (de facto) | Monto de la venta individual en CLP. **Debe ser número** (no string) — el helper llama `toLocaleString("es-CL")` directamente. |
| `time` | `string` | Sí (de facto) | Hora pre-formateada. Convención del backend: `"HH:mm"` (24h), p. ej. `"09:15"`. No se valida formato; se interpola tal cual. |

Ver `request.json` para ejemplo completo con todas las categorías pobladas.

## Responses

### 200 OK

```json
{ "message": "Daily sales report sent successfully" }
```

Ver `response.json`.

### 400 / 401 / 403

Del middleware `requireApiKey` (igual que el resto de endpoints con API Key).

### 500 Internal Server Error

```json
{ "message": "Error sending daily sales report", "error": "<error.message>" }
```

Causas:

- Validaciones del servicio (devueltas como 500 vía catch genérico):
  - `"Sent by is required"` (nunca debería ocurrir porque el controller fija un default).
  - `"Destination email (to) is required"`.
  - `"Subject is required"`.
  - `"Report date is required"`.
  - `"Total revenue must be a number"`.
- `TypeError` por acceso a `opts.planSales.sales` si la categoría no llega.
- Error de Resend.

## Comportamiento

- **Side effects**: ninguno hacia DB. `sendMail` no escribe en `mail_logs` (verificado en `internal/service/mail.ts`).
- **Cálculos en el servidor**:
  - `totalRevenue` y `totalAmount` por categoría: **NO se recalculan ni validan**. El servidor confía en lo que manda el backend. Si el backend manda `totalRevenue=10000` con ventas que suman `15000`, el email se envía con el valor incorrecto.
  - Formato de moneda: `formatCurrency(n)` = `` `$${n.toLocaleString("es-CL")}` `` (separador de miles `.`, sin decimales). Aplicado a `totalRevenue`, `totalAmount` de cada sección y `amount` de cada venta.
  - Año del footer: `new Date().getFullYear()`.
  - `reportDate` se interpola sin transformar.
- **Formato esperado**:
  - `amount` y `totalAmount`: **`number`** (no string). El renderer hace `toLocaleString` directo. Convención: enteros sin decimales (CLP).
  - `time`: **`string`** en formato `"HH:mm"` 24h (pre-formateado por el backend).
  - `reportDate`: **`string`** en español (p. ej. `"15 de mayo de 2026"`).
- **Locale / timezone**: solo el formato de moneda usa `"es-CL"`. **No hay conversión de timezone en este endpoint** — el backend manda `reportDate` y `time` ya formateados con el timezone correcto.
- **Bulk**: no. Un destinatario único (`to: string`).
- **Async**: handler espera (`await`) el envío.

## Template HTML

- Archivo: `internal/html/daily_sales_report.html`.
- Renderer: `internal/service/sales/helpers.ts → renderDailySalesReportHTML`.

### Placeholders consumidos

| Placeholder | Reemplazo | Notas |
|---|---|---|
| `{{logoImg}}` | `getLogoImgHtml(logoUrl, gymName)` | Global. |
| `{{gymName}}` | `opts.gymName \|\| ""` | Global. En `<title>`, preheader, header, saludo, footer. |
| `{{reportDate}}` | `opts.reportDate \|\| ""` | **Sustitución única**, no global. Barra dorada. |
| `{{totalRevenue}}` | `formatCurrency(opts.totalRevenue)` | Único. Bloque destacado tras el saludo, fuente 32px. |
| `{{year}}` | `new Date().getFullYear()` | Único (no `/g`). Footer. |
| `{{planSalesSection}}` | Tabla HTML o mensaje vacío | Único. |
| `{{foodSalesSection}}` | Tabla HTML o mensaje vacío | Único. |
| `{{merchandiseSalesSection}}` | Tabla HTML o mensaje vacío | Único. |

### Tablas dinámicas

`renderSalesSection(config)` genera una tabla por categoría. Si `sales` está vacío, devuelve un párrafo con el `emptyMessage` específico:

- `planSales` → "No se registraron ventas de planes hoy."
- `foodSales` → "No se registraron ventas de alimentos hoy."
- `merchandiseSales` → "No se registraron ventas de productos hoy."

Si tiene ventas, construye una tabla con header `Cliente | <columnHeader> | Monto | Hora` y `<tr>` por venta concatenados, más un `<tfoot>` con el `totalAmount` de la categoría. El `<columnHeader>` y la clave para extraer el nombre del item varían:

| Categoría | columnHeader | itemNameKey |
|---|---|---|
| `planSales` | `"Plan"` | `"planName"` |
| `foodSales` | `"Producto"` | `"foodName"` |
| `merchandiseSales` | `"Producto"` | `"productName"` |

**Sin escape HTML**: `clientName`, `planName/foodName/productName`, `gymName`, `reportDate` se interpolan crudos. Riesgo de inyección.

## Notas e inconsistencias

- **`totalRevenue` no se valida vs categorías**: el servidor confía. Si el backend tiene un bug en el cálculo, el email queda inconsistente. Para Go: considerar validar `totalRevenue == planSales.totalAmount + foodSales.totalAmount + merchandiseSales.totalAmount` o reemplazar `totalRevenue` por la suma server-side.
- **`totalAmount` por categoría no se valida vs `sales[].amount`**: mismo problema.
- **Las tres categorías son obligatorias de facto** pero **no validadas explícitamente**. Si el backend omite `foodSales`, el handler revienta con `TypeError: Cannot read property 'sales' of undefined` y responde 500 con un mensaje poco descriptivo.
- **Sin escape HTML** en strings (a diferencia de `low_stock_alert.ts`). Endurecer en el port.
- **Clave de item heterogénea por categoría** (`planName` / `foodName` / `productName`): en Go conviene unificar a `itemName` y derivar la columna al render, o mantener el esquema discriminado pero documentarlo en struct tags.
- **`sentBy`** se acepta y se loguea con default, pero **no se persiste** (no hay `mail_logs` para este endpoint) y **no se pasa a `sendMail`** (a diferencia de `send_daily_admin_report` que sí lo pasa como `userName`). Inconsistencia entre los dos reportes.
- **Validaciones devuelven 500 en lugar de 400**: las cinco validaciones del servicio se lanzan como `Error` y caen al catch genérico. Para Go, separar errores de validación (400) de errores operacionales (500).
- **`time` sin validación de formato**: se asume `"HH:mm"` pero podría llegar cualquier cosa. Endurecer en el port.
- **`amount` y `totalAmount` deben ser números**: si llegan como string el `toLocaleString` falla en runtime. El servicio sólo valida `typeof totalRevenue === 'number'`, no los demás.
- **CLAUDE.md global desactualizado**: indica que el reminder service maneja deduplicación 48h vía `EmailLog`, pero este endpoint **no usa** ese flujo y no escribe `mail_logs`.
- **Postman**: este endpoint **no aparece** en `docs/Powercave_Mail_Service.postman_collection.json`.
- **`Content-Type`**: no validado explícitamente; depende del body parser de Express.
