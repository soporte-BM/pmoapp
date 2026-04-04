# PMO Profitability Suite

Aplicación web para la gestión y análisis de rentabilidad de proyectos de consultoría.
**Historial Arquitectónico**: Originalmente diseñada con una arquitectura "Zero-Dependency" (LocalStorage), la aplicación ha sido migrada a una arquitectura **Cliente-Servidor (Node.js + Azure SQL Database)** para asegurar la sincronización y persistencia de datos en la nube.

## 🚀 Cómo ejecutar
- **Modo Nube (Por defecto)**: Abre el frontend (`index.html` vía Live Server) y la aplicación se conectará automáticamente a la API en Azure (`https://pmoapp.azurewebsites.net/api`).
- **Modo Desarrollo (Local)**: Si vas a desarrollar el backend localmente, cambia la URL en `apiService.js` a `localhost:3000`, entra a la carpeta `/backend` e inicia el servidor con `npm run dev`.

## 🏗 Arquitectura Actualizada
La aplicación implementa un patrón MVC con un Backend de consumo REST:

- **Frontend (`src/`)**: 
    - `apiService`: Concentra la comunicación HTTP con la API en Azure.
    - `StorageService`: Evolucionó de ser la base de datos principal a ser una **Caché temporal (SessionStorage)** para mayor performance interactiva.
    - `AnalyticsService`: Motor de cálculo de márgenes y alertas inteligentes.
    - Múltiples vistas renderizadas por componentes.
- **Estilos (`styles/`)**:
    - `main.css`: Variables globales y layout base.
    - `dashboard.css`: Grid system para los reportes tipo Power BI.
    - `forms.css`: Estilos para formularios de alta usabilidad.

## 💡 Funcionalidades Clave
1. **Dashboard Ejecutivo**: KPIs en tiempo real, alertas visuales (Rojo/Amarillo/Verde).
2. **Alertas Tempranas**:
   - 🔴 **Crítico**: Margen < 10%
   - 🟡 **Riesgo**: Margen < 20%
   - 🟢 **Saludable**: Margen ≥ 20%
3. **Análisis Automático**: El sistema explica *por qué* un proyecto tiene baja rentabilidad (ej. "Costo laboral excesivo").
4. **Persistencia**: Los datos se guardan automáticamante en tu navegador.

## 🔮 Escalabilidad
El código está diseñado para ser modular. Para agregar un módulo de RRHH:
1. Crear una nueva "View" en el objeto `App`.
2. Extender el modelo de datos en `StorageService`.
3. Agregar la lógica de cálculo en un nuevo servicio (ej. `HrService`).

---
*Desarrollado con estándares modernos de Web: HTML5, CSS3, ES6+.*
