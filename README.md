# Gestión de Incidencias - PayFlow (API de Pasarela de Pagos)

Repositorio del Laboratorio de Gestión de Incidencias TIC - UTP.

## Descripción
Este proyecto simula la gestión del ciclo de vida completo de una incidencia crítica (Severidad P1) en producción dentro del servicio `PaymentGatewayService` de **PayFlow**, aplicando prácticas de **Site Reliability Engineering (SRE)**, **ITIL v4**, trazabilidad con **GitHub Issues**, ramificación de emergencia (**Hotfix Branching**), **Pull Requests** con cierre automatizado y documentación de **Blameless Post-Mortem**.

## Estructura del Repositorio
- `.github/ISSUE_TEMPLATE/incident_report.md`: Plantilla estandarizada para el reporte y triage de incidentes en producción.
- `src/config/database.js`: Módulo de gestión de conexiones a base de datos del servicio de pagos.
- `docs/postmortems/2026-10-28-incidente-pasarela-pagos.md`: Informe retrospectivo (Blameless Post-Mortem) del Incidente #1.
- `docs/RESPUESTAS_CUESTIONARIO.md`: Desarrollo del Cuestionario de Juicio Crítico del laboratorio.

## Autor
- **Steve Kelvin Coaquira Mamani** - *Incident Commander / SRE*
