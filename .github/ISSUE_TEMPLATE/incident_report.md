---
name: Reporte de Incidencia
about: Utilice esta plantilla para registrar interrupciones o degradaciones en producción.
title: '[INCIDENTE] <Título corto del problema>'
labels: 'status: triage'
assignees: ''
---
## 1. Información General
* **Servicio / Módulo Afectado:** API de Pasarela de Pagos
* **Entorno:** Producción
* **Hora de Detección:** 2026-10-28 10:00 UTC
* **Severidad Estimada:** P1 - Crítico
## 2. Descripción del Síntoma
Error HTTP 504 Gateway Timeout masivo al intentar procesar transacciones.
## 3. Evidencias Técnicas y Logs
```text
[2026-10-28T10:02:15Z] [ERROR] [DBConnectionPool] TimeoutException: Unable to acquire connection from pool after 30000ms. Active connections: 50/50. Waiting threads: 142.
[2026-10-28T10:02:18Z] [CRITICAL] [PaymentGatewayService] Payment processing failed for Order #98421. Transaction aborted.
```
## 4. Pasos para Reproducir
1. Enviar petición POST al endpoint de pagos en hora pico.
2. Superar las 50 peticiones concurrentes.
## 5. Acciones de Contención Propuestas
- [x] Aislar componente afectado
- [x] Liberar conexiones de base de datos
- [x] Modificar variables de entorno / parches de emergencia
