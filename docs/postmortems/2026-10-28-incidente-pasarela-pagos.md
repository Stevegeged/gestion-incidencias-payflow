# Informe Post-Mortem (Blameless): Caída Masiva de Pasarela de Pagos por Agotamiento del Pool de Conexiones a Base de Datos

## 1. Datos de Resumen del Incidente

| Campo | Detalle |
| :--- | :--- |
| **ID de Incidente** | [Issue #1](https://github.com/Stevegeged/gestion-incidencias-payflow/issues/1) |
| **Pull Request de Remediación** | [PR #2](https://github.com/Stevegeged/gestion-incidencias-payflow/pull/2) |
| **Fecha del Incidente** | 2026-10-28 |
| **Servicio / Componente Afectado** | API de Pasarela de Pagos (`PaymentGatewayService` / `DBConnectionPool`) |
| **Entorno** | Producción |
| **Severidad Clasificada** | `sev: P1-critical` (P1 - Crítico) |
| **Incident Commander (IC)** | Steve Kelvin Coaquira Mamani |
| **Estado del Incidente** | Resuelto y Cerrado (`Closed`) |
| **Hora de Inicio de la Caída** | 2026-10-28 10:00 UTC |
| **Hora de Detección (Logs/Alerta)** | 2026-10-28 10:02 UTC |
| **Hora de Resolución (Mitigación)** | 2026-10-28 10:35 UTC |
| **MTTD (Mean Time To Detect)** | 2 minutos (SLA <= 15 min — Margen de 86.67%) |
| **MTTR (Mean Time To Resolve)** | 33 minutos (SLA <= 120 min — Margen de 72.5%) |
| **Downtime Total (MTTD + MTTR)** | 35 minutos (Ventana máx. 120 min — Margen de 70.83%) |

---

## 2. Resumen Ejecutivo e Impacto al Negocio

El 28 de octubre de 2026, entre las **10:00 UTC** y las **10:35 UTC** (tras un despliegue previo a las **09:30 UTC**), el servicio principal de procesamiento de pagos de **PayFlow** (`PaymentGatewayService`) experimentó una degradación severa que derivó en una interrupción total mediante respuestas **HTTP 504 Gateway Timeout**.

La falla fue originada por una fuga de conexiones (*connection leak*) introducida en el módulo `src/config/database.js`, donde las conexiones adquiridas del pool de base de datos no eran liberadas tras finalizar la ejecución de `processPayment(orderId)`. Al alcanzarse el límite estático de **50 conexiones activas**, las nuevas solicitudes quedaron bloqueadas en cola (142 hilos en espera) hasta agotar el tiempo de espera de 30,000 ms (`TimeoutException`).

### Cuantificación del Impacto
* **Transacciones Afectadas:** **450 transacciones** abortadas con error HTTP 504 Gateway Timeout.
* **Impacto Financiero Estimado:** **$18,500 USD** en volumen de procesamiento retenido/no concretado durante la ventana del incidente.
* **Disponibilidad del Servicio:** Caída del **100%** en el endpoint transaccional `POST /api/v1/payments` durante 35 minutos de Downtime total en hora pico.
* **Cumplimiento de SLA:** Se cumplió ampliamente el SLA de respuesta de emergencia con un **MTTD de 2 minutos** (límite <= 15 min), un **MTTR de 33 minutos** (72.5% de margen respecto al límite de 120 min) y un **Downtime Total de 35 minutos** (70.83% de margen).

---

## 3. Cronología Detallada del Evento (UTC)

| Hora (UTC) | Evento / Acción Ejecutada |
| :--- | :--- |
| **09:30 UTC** | Se despliega en producción una actualización del módulo `src/config/database.js` en la rama `main` que introduce inadvertidamente la fuga de conexiones. |
| **10:00 UTC** | **Inicio del Incidente:** El tráfico de hora pico satura el límite de 50/50 conexiones activas del pool. El API Gateway comienza a devolver errores masivos `HTTP 504 Gateway Timeout`. |
| **10:02 UTC** | **Detección (MTTD = 2 min):** Las alertas de monitoreo y los logs de producción registran `TimeoutException: Unable to acquire connection from pool after 30000ms. Active connections: 50/50. Waiting threads: 142` y fallo crítico en `Order #98421`. Se abre el **Issue #1** en GitHub. |
| **10:05 UTC** | **Triage y Asignación:** **Steve Kelvin Coaquira Mamani** asume el rol de **Incident Commander (IC)**, clasifica el incidente con etiquetas `status: triage`, `sev: P1-critical` y `domain: backend`, y fija la ventana SLA (MTTD <= 15 min, MTTR <= 2 h). |
| **10:12 UTC** | **Diagnóstico de Causa Raíz:** Ingeniería localiza el defecto en `src/config/database.js`: la función `processPayment` incrementa `pool.activeConnections++` sin liberar el recurso al finalizar. |
| **10:15 UTC** | **Aislamiento (Hotfix Branch):** Se crea la rama de emergencia `hotfix/issue-1-fix-db-connection-leak` desde `main`. |
| **10:22 UTC** | **Implementación del Parche:** Se agrega el bloque `try...finally` para garantizar la liberación explícita (`pool.activeConnections--`) y se amplía `maxConnections` de 50 a 100. Se realiza commit con `[Fixes #1]`. |
| **10:28 UTC** | **Code Review y Pull Request:** Se abre el **Pull Request #2** (`fix(database): corrige fuga de conexiones en pool de BD (Hotfix P1)`) con `Closes #1` y se aprueba tras validación técnica. |
| **10:32 UTC** | **Fusión y Despliegue:** Se fusiona el PR #2 hacia `main`, cerrando automáticamente el Issue #1 e iniciando el despliegue del hotfix en producción. |
| **10:35 UTC** | **Resolución y Estabilización (MTTR = 33 min / Downtime = 35 min):** Se verifica la normalización del pool de conexiones, latencia < 120 ms y 0% de errores HTTP 504. Se declara resuelto el incidente. |

---

## 4. Análisis de Causa Raíz: Metodología de los 5 Porqués (5 Whys)

1. **¿Por qué los usuarios recibieron errores masivos `HTTP 504 Gateway Timeout` al procesar sus pagos?**
   * *Porque* el servicio `PaymentGatewayService` no pudo completar las transacciones antes de que el API Gateway agotara su tiempo de espera de 30 segundos.
2. **¿Por qué `PaymentGatewayService` demoró más de 30 segundos intentando procesar cada transacción?**
   * *Porque* las peticiones quedaron bloqueadas esperando adquirir una conexión disponible del `DBConnectionPool` (`TimeoutException: Unable to acquire connection from pool after 30000ms`), acumulando 142 hilos en espera.
3. **¿Por qué el pool de conexiones se quedó sin conexiones disponibles (50/50 activas permanentemente)?**
   * *Porque* cada invocación a `processPayment(orderId)` en `src/config/database.js` incrementaba el contador `pool.activeConnections++`, pero nunca liberaba ni devolvía la conexión al pool al finalizar la operación.
4. **¿Por qué el código en `src/config/database.js` no liberaba la conexión al finalizar la transacción?**
   * *Porque* la función fue implementada sin una estructura de control `try...finally` que garantizara la liberación explícita del recurso (`pool.activeConnections--`), tanto en ejecuciones exitosas como ante excepciones.
5. **¿Por qué este defecto de fuga de recursos llegó al entorno de producción sin ser detectado antes?**
   * *Porque* el pipeline de Integración Continua (CI) carecía de pruebas de carga/concurrencia superiores al umbral del pool (50 peticiones) y de reglas de análisis estático (linter) que verificaran el cierre obligatorio de recursos de base de datos.

---

## 5. Declaración de Filosofía Blameless (Cultura Sin Culpa)

> En estricto apego a las mejores prácticas de **Site Reliability Engineering (SRE)**, este análisis retrospectivo se rige bajo una filosofía **Blameless (Sin Culpa)**. Asumimos que los ingenieros involucrados actuaron de buena fe con la información y las herramientas disponibles en su momento. El objetivo de este documento no es señalar individuos, sino identificar las brechas sistémicas en nuestros controles de calidad, pruebas automatizadas de concurrencia y observabilidad preventiva que permitieron que una fuga de conexiones llegara a producción. Castigar el error humano oculta los fallos del sistema; aprender de él fortalece nuestra resiliencia operativa.

---

## 6. Lecciones Aprendidas

### ¿Qué funcionó bien?
* La alerta automatizada y el registro estructurado mediante la plantilla `.github/ISSUE_TEMPLATE/incident_report.md` permitieron detectar el incidente en un **MTTD de solo 2 minutos**.
* El flujo de **Hotfix Branching** (`hotfix/issue-1-fix-db-connection-leak`) y la vinculación automatizada (`Fixes #1` / `Closes #1`) garantizaron trazabilidad extremo a extremo entre el incidente, el código fuente, el Pull Request y el tablero Kanban.
* El tiempo de resolución (**MTTR = 33 min**) y de indisponibilidad total (**Downtime = 35 min**) se mantuvieron muy por debajo del límite máximo del SLA para incidentes P1 (120 minutos), con márgenes de **72.5%** y **70.83%** respectivamente.

### ¿Qué salió mal o pudo mejorar?
* Las pruebas unitarias previas solo validaban invocaciones individuales (< 50 llamadas), por lo que nunca saturaron el límite del pool en el entorno de staging.
* No existía una alerta preventiva (Warning) cuando el uso del pool de conexiones superaba el 75% de su capacidad, alertando recién cuando se alcanzó el 100% (50/50).

---

## 7. Plan de Acción (Action Items)

| ID | Acción Correctiva / Preventiva | Tipo | Prioridad | Responsable | Fecha Límite | Estado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **AI-01** | Liberar explícitamente conexiones mediante bloque `try...finally` y ampliar pool a 100 en `src/config/database.js`. | Mitigación (Corto Plazo) | P1 - Alta | Steve Kelvin Coaquira Mamani | 2026-10-28 | Completado (PR #2) |
| **AI-02** | Implementar pruebas automatizadas de estrés y concurrencia (> 150 peticiones simultáneas) en el pipeline CI/CD de GitHub Actions. | Prevención (Mediano Plazo) | P1 - Alta | Steve Kelvin Coaquira Mamani | 2026-11-04 | Pendiente |
| **AI-03** | Configurar alertas proactivas en el sistema APM cuando `activeConnections / maxConnections` supere el 75% durante más de 60 segundos. | Observabilidad (Corto Plazo) | P2 - Media | Steve Kelvin Coaquira Mamani | 2026-11-02 | Pendiente |
| **AI-04** | Incorporar reglas de análisis estático (ESLint / SonarQube) y checklist de gestión de recursos en la plantilla de Pull Request. | Proceso (Mediano Plazo) | P2 - Media | Steve Kelvin Coaquira Mamani | 2026-11-06 | Pendiente |
| **AI-05** | Implementar un mecanismo de *Circuit Breaker* y *Connection Idle Timeout* automático en el driver de base de datos para reciclar conexiones huérfanas. | Resiliencia (Largo Plazo) | P2 - Media | Steve Kelvin Coaquira Mamani | 2026-11-12 | Pendiente |
