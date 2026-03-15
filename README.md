# muga-dev-site

**Estado:** Activo

Sitio oficial de MUGA.dev (Astro), con captación de leads en Supabase,
automatización por correo y panel interno de métricas protegido.

## Stack
- Astro 5
- Tailwind CSS 4
- Node.js 22
- Vercel (deploy y cron)
- Supabase (persistencia de leads)

## Requisitos
- Node.js 22.x
- npm

## Desarrollo local
```bash
npm install
npm run dev:node22
```

## Build local
```bash
npm run build:node22
```

## Variables de entorno
Base mínima:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_LEADS_TABLE` (opcional, por defecto `leads`)

Para automatización por correo:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `ALERT_FROM_EMAIL`
- `ALERT_TO_EMAIL`
- `AUTO_REPLY_ENABLED` (opcional)

Para resumen diario por cron:

- `LEADS_CRON_TOKEN`

Para proteger el panel `/metricas`:

- `METRICAS_PANEL_PASSWORD`
- `METRICAS_SESSION_SALT`

Referencia completa: `.env.example`.

## Endpoints internos
- `POST /api/contacto`: guarda lead y dispara notificaciones.
- `GET /api/leads/resumen-diario`: resumen diario (requiere token en `Authorization`).
- `GET /api/leads/export.csv`: exporta CSV filtrado (requiere sesión de `/metricas`).
