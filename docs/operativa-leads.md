# Operativa diaria de leads (SLA 24h)

## Objetivo

Ningun lead con `status = new` debe quedar sin contacto inicial por mas de 24 horas.

## Checklist diario (5-10 min)

1. Revisar leads vencidos por SLA:

```bash
curl -sS "https://muga.dev/api/leads/sla?hours=24&limit=50" \
  -H "Authorization: Bearer $LEADS_ADMIN_TOKEN"
```

2. Para cada lead vencido:

- contactar por email/whatsapp
- actualizar estado a `contacted`
- si aplica, pasar a `qualified`

3. Confirmar al cierre:

- `overdueCount = 0` (ideal)
- o justificar pendientes con motivo

## Actualizar estado por API

```bash
curl -sS -X POST "https://muga.dev/api/leads/estado" \
  -H "Authorization: Bearer $LEADS_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"leadId":123,"status":"contacted","setLastContactAt":true}'
```

## Regla comercial simple

- `new`: entro y no se contacto
- `contacted`: ya hubo primer respuesta
- `qualified`: hay encaje y posible propuesta
- `won`: cierra proyecto
- `lost`: no avanza
