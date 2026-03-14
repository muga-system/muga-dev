# Plan de seguimiento de leads (MUGA)

## Estado actual

- [x] Formulario funcionando en home/contacto.
- [x] Guardado en Supabase.
- [x] Redirección a página post-envío.
- [x] Notificación interna por correo.
- [x] Autorespuesta al cliente.

## Backlog priorizado

### Prioridad alta

- [x] Definir SLA interno (`new -> contacted` en menos de 24h).
- [x] Agregar y usar estados comerciales (`new`, `contacted`, `qualified`, `won`, `lost`).
- [x] Registrar `last_contact_at` para control operativo.
- [x] Implementar anti-spam básico (honeypot + rate limit por IP/email).
- [x] Crear alertas de error SMTP (cuando no se pueda enviar correo).

### Prioridad media

- [ ] Crear vista interna de leads (`/admin/leads`) con filtros por fecha, estado y presupuesto. (Pausado por ahora)
- [ ] Mostrar historial por contacto (mismo email). (Pausado por ahora)
- [x] Agregar resumen diario interno de leads (correo automático).
- [ ] Personalizar secuencia de correos según tipo de lead (`start`, `business`, `premium`).

### Prioridad baja

- [ ] Dashboard simple de embudo (origen, tipo de lead, tasa de contacto).
- [ ] Plantillas de correo adicionales por etapa comercial.
- [ ] Limpieza periódica y normalización de datos históricos.

## Plan sugerido por fases

### Semana 1 (impacto directo)

- [x] Estados comerciales + `last_contact_at`.
- [x] SLA y checklist operativo de respuesta.
- [x] Anti-spam básico.
- [x] Alertas de fallos SMTP.

### Semana 2 (escala y visibilidad)

- [ ] Vista interna de leads. (Pausado por ahora)
- [x] Resumen diario automático.
- [ ] Métricas de embudo iniciales. (Pausado por ahora)

## Checklist de validación

- [ ] Lead nuevo se guarda correctamente.
- [ ] Lead premium llega con etiqueta correcta.
- [ ] Correo interno llega en todos los casos.
- [ ] Autorespuesta llega al cliente.
- [ ] No hay duplicados inesperados.
- [ ] No hay errores 5xx en `/api/contacto`.

## Decisiones pendientes

- [ ] Definir responsable de seguimiento diario.
- [ ] Definir horarios de respuesta.
- [ ] Definir regla de escalamiento para leads premium.
