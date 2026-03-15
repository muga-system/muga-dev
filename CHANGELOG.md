# Registro de Cambios (Changelog)

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/),
y este proyecto adhiere a [Versionado Semántico](https://semver.org/lang/es/).

## [1.2.0] - 2026-03-15

### Añadido
- Endpoint `POST /api/contacto` con guardado en Supabase usando `service_role`.
- Notificación interna por correo y autorespuesta al cliente con variantes `start`, `business` y `premium`.
- Persistencia de eventos de correo (`lead_email_events`) y fallos SMTP (`smtp_failures`) para auditoría.
- Resumen diario automático de leads (`/api/leads/resumen-diario`) con ejecución programada en Vercel Cron.
- Dashboard interno `/metricas` con filtros por período, estado y fuente, más visualizaciones de embudo y tendencia.
- Exportación de leads filtrados en CSV (`/api/leads/export.csv`).
- Nuevo caso en `/casos`: Mandorla como Cliente 03.

### Cambiado
- Se eliminó el flujo anterior basado en webhook externo y se consolidó la captura en la API interna.
- Se pausó la interfaz `/admin/leads` para mantener una operación más simple basada en panel de métricas.
- Se removió la integración de WhatsApp externa para evitar complejidad operativa innecesaria.
- Se fijó Node.js 22 como versión objetivo de ejecución y build.

### Corregido
- Corrección del envío de scripts para evitar carga de rutas `.ts` en producción.
- Ajustes de lectura de variables de entorno en runtime para endpoints server.
- Corrección en inserción de campos para evitar errores por columnas inexistentes en `leads`.

### Seguridad
- Protección anti-spam básica en `/api/contacto` (honeypot y rate limit por `IP + email`).
- Acceso protegido para `/metricas` con login, cookie `httpOnly` y cierre de sesión.
- Bloqueo de exportación CSV sin sesión válida (`401 unauthorized`).

## [0.0.6] - 2025-08-26

### Añadido
- Componente reutilizable IconWithBlurEffect para efectos de blur en iconos SVG
- Implementación del componente en las secciones de Modelo de Negocio y Características

### Mejorado
- Refactorización para eliminar código duplicado en páginas
- Mayor consistencia visual entre secciones
- Mejor mantenibilidad del código con componentes reutilizables

### Corregido
- Problemas de visualización en la página de características
- Conflictos entre efectos de luz y efectos de blur en iconos

## [0.0.5] - 2025-08-25

### Añadido
- Iconos SVG con efecto blur en la sección de Modelo de Negocio
- Implementación de iconos específicos para cada sección del BentoGrid

### Mejorado
- Optimización de la visibilidad de iconos al hacer hover
- Consistencia visual en todas las secciones del Modelo de Negocio

## [0.0.4] - 2025-08-24

### Añadido
- Sistema de iconografía en carpeta public/icons para mejor rendimiento
- Implementación de iconos SVG en las secciones de características

### Mejorado
- Optimización de la visualización de iconos con control de z-index
- Mejora en el espaciado vertical de párrafos con clase py-10

## [0.0.3] - 2025-08-23

### Añadido
- Implementación de BentoGrid personalizado en la página de características
- Mejora de la experiencia de usuario en diferentes dispositivos

### Cambiado
- Aplicación del color de fondo bg-zinc-900/95 a todo el sitio
- Visualización del breadcrumb solo en dispositivos desktop

## [0.0.2] - 2025-08-22

### Añadido
- Definiciones de tipos compartidos
- Interfaces Props para componentes
- Funcionalidad de badge en PageHeroSection
- Página 404 personalizada
- Mejoras en diseño y contenido de la página de características
- Badge "Comunicación" en la página de contacto

### Corregido
- Comportamiento inconsistente de la barra de navegación
- Navegación móvil mejorada con JavaScript en lugar de :target

## [0.0.1] - 2025-08-22

### Añadido
- Versión inicial del sitio
- Estructura básica de páginas
- Componentes UI fundamentales
