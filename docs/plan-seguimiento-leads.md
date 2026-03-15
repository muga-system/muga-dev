# Plan de seguimiento de leads (MUGA)

## Estado actual

- [x] Formulario funcionando en home/contacto.
- [x] Guardado en Supabase.
- [x] Redirección a página post-envío.
- [x] Notificación interna por correo.
- [x] Autorespuesta al cliente.
- [x] Resumen diario automático por cron.
- [x] Dashboard interno `/metricas` con filtros y visualizaciones.
- [x] Acceso protegido al panel de métricas.
- [x] Exportación CSV filtrada desde métricas.

## Backlog priorizado

### Prioridad alta

- [x] Definir SLA interno (`new -> contacted` en menos de 24h).
- [x] Agregar y usar estados comerciales (`new`, `contacted`, `qualified`, `won`, `lost`).
- [x] Registrar `last_contact_at` para control operativo.
- [x] Implementar anti-spam básico (honeypot + rate limit por IP/email).
- [x] Crear alertas de error SMTP (cuando no se pueda enviar correo).
- [x] Alertas automáticas de SLA vencido (`new` >24h y >48h).

### Prioridad media

- [x] Agregar resumen diario interno de leads (correo automático).
- [x] Personalizar secuencia de correos según tipo de lead (`start`, `business`, `premium`).
- [x] Dashboard de embudo, estado y fuentes en `/metricas`.
- [x] Proteger acceso de `/metricas` con login y sesión.
- [x] Exportar CSV de leads filtrados desde el panel.
- [ ] Tracking UTM completo en métricas (`utm_source`, `utm_medium`, `utm_campaign`).

### Prioridad baja

- [ ] Plantillas de correo adicionales por etapa comercial.
- [ ] Limpieza periódica y normalización de datos históricos.
- [ ] KPI de negocio semanales (tiempo a primer contacto, conversión por fuente).

## Plan sugerido por fases

### Semana 1 (impacto directo)

- [x] Estados comerciales + `last_contact_at`.
- [x] SLA y checklist operativo de respuesta.
- [x] Anti-spam básico.
- [x] Alertas de fallos SMTP.

### Semana 2 (escala y visibilidad)

- [x] Resumen diario automático.
- [x] Métricas de embudo y filtros en `/metricas`.
- [x] Protección de acceso al panel.
- [x] Exportación CSV filtrada.

### Semana 3 (optimización operativa)

- [x] SLA automático con alertas escalonadas.
- [ ] Métricas con UTM por canal/campaña.
- [ ] Reporte semanal con comparativa vs semana anterior.

## Checklist de validación

- [x] Lead nuevo se guarda correctamente.
- [x] Lead premium llega con etiqueta correcta.
- [x] Correo interno llega en todos los casos.
- [x] Autorespuesta llega al cliente.
- [x] No hay duplicados inesperados.
- [x] No hay errores 5xx en `/api/contacto`.
- [x] `/metricas` requiere login para mostrar datos.
- [x] `/api/leads/export.csv` bloquea acceso sin sesión.

## Decisiones pendientes

- [ ] Definir responsable de seguimiento diario.
- [ ] Definir horarios de respuesta.
- [ ] Definir regla de escalamiento para leads premium.
