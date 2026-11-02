# Respuestas al Cuestionario de Juicio Crítico (Sección 5.2)

**Curso:** Herramientas de Desarrollo (Semana 12 - Sesión 23)  
**Docente:** Ing. Juan Carlos Adco Chura  
**Estudiante / Incident Commander:** Steve Kelvin Coaquira Mamani  

---

## Pregunta 1: Evaluación Cuantitativa del Cumplimiento de SLA (MTTD, MTTR y Downtime Total)

### Con base en la cronología UTC registrada durante la emergencia (inicio de degradación a las 10:00 UTC, detección en logs a las 10:02 UTC y restablecimiento total a las 10:35 UTC), calcule matemáticamente el MTTD, el MTTR y el Downtime Total, determinando si el equipo cumplió con el SLA para un incidente P1-Crítico (MTTD <= 15 min, MTTR <= 2 horas) y el porcentaje de margen obtenido.

Para evaluar objetivamente el desempeño operativo del equipo de **Site Reliability Engineering (SRE)** bajo el mando del *Incident Commander*, desglosamos las marcas de tiempo de la incidencia **#1**:

* $T_{\text{inicio}}$ (Inicio de la interrupción en producción): **10:00 UTC**
* $T_{\text{detección}}$ (Alerta en `DBConnectionPool` y captura de evidencia): **10:02 UTC**
* $T_{\text{resolución}}$ (Despliegue del hotfix PR #2 y estabilización del servicio): **10:35 UTC**

#### 1. Cálculo de MTTD (Mean Time To Detect)
$$\text{MTTD} = T_{\text{detección}} - T_{\text{inicio}} = \text{10:02 UTC} - \text{10:00 UTC} = \mathbf{2\text{ minutos}}$$
* **Límite SLA establecido:** $\le 15\text{ minutos}$.
* **Evaluación:** **CUMPLIDO** ($2\text{ min} \le 15\text{ min}$). Se consumió únicamente el $13.33\%$ de la ventana permitida, logrando un **margen de eficiencia en detección del $86.67\%$** ($\frac{15 - 2}{15} \times 100\%$).

#### 2. Cálculo de MTTR (Mean Time To Resolve / Restore)
$$\text{MTTR} = T_{\text{resolución}} - T_{\text{detección}} = \text{10:35 UTC} - \text{10:02 UTC} = \mathbf{33\text{ minutos}}$$
* **Límite SLA establecido:** $\le 2\text{ horas} = 120\text{ minutos}$.
* **Cálculo del Margen de SLA en MTTR:**
  $$\text{Uso de ventana MTTR} = \frac{33\text{ min}}{120\text{ min}} \times 100\% = 27.5\%$$
  $$\text{Margen de cumplimiento en MTTR} = \frac{120 - 33}{120} \times 100\% = \frac{87}{120} \times 100\% = \mathbf{72.5\%}$$
* **Evaluación:** **CUMPLIDO AMPLIAMENTE** con un **72.5% de margen a favor** (87 minutos por debajo del umbral crítico de penalización contractual).

#### 3. Cálculo del Downtime Total (Indisponibilidad Acumulada)
$$\text{Downtime Total} = \text{MTTD} + \text{MTTR} = T_{\text{resolución}} - T_{\text{inicio}} = 2\text{ min} + 33\text{ min} = \mathbf{35\text{ minutos}}$$
* **Cálculo del Margen sobre la Ventana Máxima de 120 minutos:**
  $$\text{Uso de ventana total} = \frac{35\text{ min}}{120\text{ min}} \times 100\% = 29.17\%$$
  $$\text{Margen en Downtime Total} = \frac{120 - 35}{120} \times 100\% = \frac{85}{120} \times 100\% = \mathbf{70.83\%}$$
* **Dictamen Técnico:** A pesar de la severidad crítica (**P1**) y del impacto sobre 450 transacciones ($18,500 USD), la estandarización del flujo con plantilla de Triage y Hotfix Branching permitió resolver la emergencia manteniendo un **72.5% de margen en MTTR** y un **70.83% de margen en Downtime Total**.

---

## Pregunta 2: Estrategia de Ramificación de Emergencia (Hotfix Branching), Trazabilidad (`Closes #1`) y Riesgo de Commits Directos a `main`

### ¿Por qué es obligatorio aislar el parche en una rama `hotfix/*` y vincular el Pull Request mediante `Closes #1` en lugar de realizar un `git push` directo a la rama `main` durante una emergencia en producción?

Aunque durante una caída P1 existe presión comercial por restaurar el servicio de inmediato, realizar commits directos sobre `main` vulnera la **gobernanza del cambio (ITIL Change Enablement)** e incrementa exponencialmente el riesgo operativo:

1. **Aislamiento y Protección del Tronco Principal (`main`):** La rama `hotfix/issue-1-fix-db-connection-leak` permite desarrollar y probar la cláusula `try...finally` de `src/config/database.js` en un entorno aislado sin bloquear ni mezclar cambios con otras características en desarrollo.
2. **Principio de Cuatro Ojos (Code Review de Emergencia) y No Regresión:** Bajo estrés por una caída masiva, los desarrolladores son propensos a introducir errores secundarios (por ejemplo, decrementar `pool.activeConnections` por debajo de cero o dejar variables huérfanas). El **Pull Request (#2)** exige una validación técnica explícita antes de la fusión y permite ejecutar pipelines automatizados de CI.
3. **Trazabilidad Bidireccional Inmutable (`[Fixes #1]` y `Closes #1`):** Vincular semánticamente el commit y el Pull Request con el **Issue #1** elimina la deriva operativa (*operational drift*). El cierre del ticket ocurre de forma atómica e instantánea en el momento exacto en que el código verificado se fusiona a `main`, dejando una pista de auditoría forense completa (Issue $\leftrightarrow$ Commit `6002047` $\leftrightarrow$ PR #2 $\leftrightarrow$ Tablero Kanban) indispensable para normativas como **PCI-DSS** e **ISO/IEC 20000**.
4. **Reversión Atómica (Fast Rollback):** Si el parche produjera un efecto adverso inesperado en producción, una fusión vía Pull Request permite ejecutar un `git revert` atómico del *merge commit* en segundos.

---

## Pregunta 3: Filosofía Blameless Post-Mortem y Resiliencia Sistémica mediante los 5 Porqués

### ¿Por qué la cultura "Blameless" (Sin Culpa) combinada con la metodología de los 5 Porqués es superior a un enfoque punitivo para prevenir la recurrencia de incidentes críticos en ingeniería de software?

En sistemas distribuidos y sociotécnicos complejos como **PayFlow**, el error humano nunca es la causa raíz real, sino el detonante visible de debilidades latentes en la arquitectura y en los procesos de aseguramiento de calidad:

1. **Seguridad Psicológica y Disminución del MTTR:** Un enfoque punitivo incentiva el ocultamiento de evidencia y el retraso en el escalamiento de alertas por temor a sanciones. Por el contrario, una cultura **Blameless** fomenta que los ingenieros expongan de inmediato qué cambio se desplegó a las 09:30 UTC, permitiendo identificar la fuga de conexiones en `processPayment(orderId)` en pocos minutos.
2. **Profundización Sistémica con los 5 Porqués:** Si el análisis se detuviera en *"el programador olvidó liberar la conexión"*, la única acción sería amonestar al individuo, dejando intacta la vulnerabilidad para el siguiente desarrollador. Al aplicar los **5 Porqués**, descubrimos las verdaderas fallas estructurales del sistema:
   * Ausencia de estructuras obligatorias de liberación de recursos (`try...finally`) validadas por análisis estático (linters).
   * Inexistencia de pruebas automatizadas de estrés/concurrencia en CI/CD que superaran el umbral de 50 conexiones simultáneas antes de llegar a producción.
   * Falta de alertas preventivas de saturación del pool (por ejemplo, al alcanzar el 75% u 80% de `maxConnections`).
3. **Transformación del Incidente en Resiliencia Activa (Action Items):** El **Blameless Post-Mortem** convierte el impacto financiero sufrido ($18,500 USD) en mejoras permanentes de ingeniería documentadas en una matriz de **Action Items** con responsable asignado (**Steve Kelvin Coaquira Mamani**), fortaleciendo la arquitectura contra toda una categoría de fallos de agotamiento de recursos.
