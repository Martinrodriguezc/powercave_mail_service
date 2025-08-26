# Powercave Mail Service API

API para el servicio de correos de Powercave. Permite envío individual y masivo de recordatorios de vencimiento de planes.

## 🚀 Instalación de la Colección Postman

1. Abre Postman
2. Haz clic en **Import** en la esquina superior izquierda
3. Selecciona el archivo `Powercave_Mail_Service.postman_collection.json`
4. La colección aparecerá en tu workspace

## 🔧 Configuración

La colección usa una variable de entorno:
- `base_url`: Por defecto `http://localhost:3000`

Para cambiar la URL:
1. Ve a la pestaña **Variables** en la colección
2. Modifica el valor de `base_url`

## 📡 Endpoints

### 1. Envío Individual - `POST /send_reminder`

Envía un recordatorio individual de vencimiento de plan.

**Body:**
```json
{
    "to": "martin.rodriguez@uc.cl",
    "userName": "Martin",
    "planName": "Plan Mensual",
    "expiryDate": "01/09/25"
}
```

**Respuesta Exitosa:**
```json
{
    "message": "Reminder sent successfully"
}
```

### 2. Envío Masivo - `POST /send_bulk_reminders`

Envía múltiples recordatorios de forma concurrente.

**Body:**
```json
{
    "reminders": [
        {
            "to": "martin.rodriguez@uc.cl",
            "userName": "Martin",
            "expiryDate": "01/09/25",
            "planName": "Plan Mensual"
        },
        {
            "to": "powercave.chile@gmail.com",
            "userName": "Powercave",
            "expiryDate": "01/09/25",
            "planName": "Plan de prueba"
        }
    ]
}
```

**Respuesta Exitosa:**
```json
{
    "message": "Bulk reminders sent successfully",
    "successful": 2,
    "failed": 0,
    "failures": []
}
```

**Respuesta con Fallos Parciales:**
```json
{
    "message": "Bulk reminders sent successfully",
    "successful": 1,
    "failed": 1,
    "failures": [
        {
            "email": "invalid@email.com",
            "error": "Invalid email address"
        }
    ]
}
```

## 🎯 Ventajas del Envío Masivo

- ⚡ **Concurrencia**: Todos los emails se procesan simultáneamente
- 🛡️ **Resistente a fallos**: Si un email falla, los otros continúan
- 📊 **Reporte detallado**: Información completa de éxitos y fallos
- 🚀 **Rendimiento**: Mucho más rápido que envíos secuenciales

## 🧪 Tests Incluidos

La colección incluye tests automáticos que verifican:
- Códigos de estado HTTP correctos
- Estructura de respuesta esperada
- Campos requeridos en las respuestas

## 🔍 Ejemplos de Uso

### Ejemplo 1: Recordatorio Individual
```bash
curl -X POST http://localhost:3000/send_reminder \
  -H "Content-Type: application/json" \
  -d '{
    "to": "martin.rodriguez@uc.cl",
    "userName": "Martin",
    "planName": "Plan Mensual",
    "expiryDate": "01/09/25"
  }'
```

### Ejemplo 2: Recordatorios Masivos
```bash
curl -X POST http://localhost:3000/send_bulk_reminders \
  -H "Content-Type: application/json" \
  -d '{
    "reminders": [
      {
        "to": "martin.rodriguez@uc.cl",
        "userName": "Martin",
        "expiryDate": "01/09/25",
        "planName": "Plan Mensual"
      },
      {
        "to": "powercave.chile@gmail.com",
        "userName": "Powercave",
        "expiryDate": "01/09/25",
        "planName": "Plan de prueba"
      }
    ]
  }'
```

## 📋 Campos Requeridos

### Para ambos endpoints:
- `to`: Email del destinatario (string)
- `userName`: Nombre del usuario (string)
- `planName`: Nombre del plan (string)
- `expiryDate`: Fecha de vencimiento (string)

### Adicional para envío masivo:
- `reminders`: Array de objetos con los datos anteriores

## ⚠️ Códigos de Error

- `400`: Datos faltantes o formato incorrecto
- `500`: Error interno del servidor (problemas de SMTP, etc.)

## 🌟 Características del Template

El email incluye:
- ✅ Diseño responsive
- ✅ Branding de Powercave
- ✅ Información personalizada del plan
- ✅ Fecha de vencimiento destacada
- ✅ Información de contacto

---

**¿Necesitas ayuda?** Contacta al equipo de desarrollo o revisa los logs del servidor para más detalles sobre errores específicos.
