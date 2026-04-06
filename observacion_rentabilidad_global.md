# Observaciones: Cálculo de Rentabilidad Global (App PMO vs Excel)

**Fecha:** 5 de Abril de 2026
**Contexto:** Discrepancia encontrada en la visualización de la "Rentabilidad Final" del proyecto `BM25-AMS40-ING`.
- **Resultado en Excel (Usuario):** `10.7%`
- **Resultado en Dashboard PMO:** `-50.3%`

---

## 🔍 Hallazgo Principal

Tras auditar el flujo de datos desde la base de datos (Azure SQL) hasta el renderizado en el Frontend (en los archivos `projects-view.js` y `dashboard-view.js`), se descubrió que ambas herramientas están procesando conjuntos de datos diferentes debido a una regla de negocio embebida en la aplicación web.

La diferencia matemática proviene **exclusivamente del tratamiento de los registros proyectados (`PROYECCION`)**.

### 1. Enfoque del Cálculo en Excel (Ciclo de Vida Completo)
El cálculo manual que arroja un `10.73%` está integrando dentro de su fórmula **todos los registros documentados para el proyecto**, sin distinguir si corresponden a meses pasados cerrados (Reales) o a proyecciones futuras.

*Métricas sumadas (Periodos REALES + PROYECCIONES):*
- Ingresos Totales: `$115,610,669`
- Costos Totales: `$103,200,664`
- Margen Consolidado: `$12,410,005`
- **Rentabilidad Calculada:** `10.73%` ✅

### 2. Enfoque del Cálculo en App PMO (Solo Efectivo Consolidado)
La aplicación web toma una política conservadora. La métrica de "Rentabilidad Final" del proyecto **excluye de la fórmula cualquier periodo que todavía se encuentre en estado de "PROYECCION" / "DRAFT"**, contando solamente los periodos catalogados como "REAL" / "VALIDATED".

En este proyecto específico, el mes proyectado de mayor ingreso (Marzo 2026, con `$51 Millones` de ingreso y `$13 Millones` de costo) queda fuera del cálculo.

*Métricas sumadas de la App (EXCLUYENDO Marzo/Abril proyectado):*
- Ingresos Reales: `$45,963,745`
- Costos Reales: `$69,104,828`
- Margen Real: `-$23,141,083`
- **Rentabilidad Calculada:** `-50.34%` 🚨

---

## 🧩 Opciones para Futuro Análisis o Solución

Dependiendo de cómo la PMO o el negocio necesite trazar el éxito y la rentabilidad del proyecto en conjunto con directores o stakeholders, hay varias formas de actuar a futuro:

1. **Unificar al Estándar de Excel (Cambiar App PMO)**
   - **Qué requiere:** Eliminar el condicional `if (type !== 'REAL') return;` de la lógica de agrupamiento en el grid de la vista de proyectos. 
   - **Efecto:** La visualización de proyectos automáticamente consolidará el proyecto entero (resultado: `10.7%`).

2. **Mantener Separado y Crear un Switch de Vista (Recomendado)**
   - **Qué requiere:** Desarrollar en la vista de control una separación visual (Ej. una columna de `Rentabilidad a la Fecha` vs. `Rentabilidad al Cierre / Proyectada`) o agregar un botón tipo "Incluir Proyecciones en KPI Global".
   - **Efecto:** Le permite a los PM visualizar el estado rojo real (`-50.3%`) alertándolos en el presente, pero dejándoles justificar el KPI global de recuperación proyectada (`10.7%`). 

---
> *Nota generada automáticamente para archivo investigativo. Queda a la espera de resolución del equipo sobre reglas de negocio.*
