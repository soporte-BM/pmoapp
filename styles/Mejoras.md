# Registro de Mejoras y Diagnóstico de Conexión en Azure

**Fecha:** 22 de Octubre de 2026  
**Proyecto:** PMO Profitability Suite (Project Commercial Report)  
**Ambiente:** Azure Web Apps (Node.js) + Azure SQL Database (Serverless)

---

## 1. Problema Reportado

Al acceder a la aplicación web, no se lograba visualizar la información del dashboard ni de los proyectos, mostrándose la pantalla de error:
> *"Error de Conexión. No se pudo conectar con el servidor.  
> Nota: Como el sistema está alojado en la nube (Azure), si ha pasado mucho tiempo sin uso, el servidor entra en Standby por ahorro de energía.  
> Por favor, espere 15 segundos y recargue la página."*

Además, tras ocurrir este fallo, **se hacía necesario reiniciar manualmente todo el sistema desde el portal de Azure** para que la aplicación volviera a responder.

---

## 2. Diagnóstico de Causa Raíz

### 2.1 Los Tiempos de Reposo en Azure
1. **Azure App Service (Worker Node.js):** Se apaga automáticamente tras **20 minutos** continuos sin recibir solicitudes HTTP (política estándar de ahorro de recursos).
2. **Azure SQL Database (Serverless):** Entra en estado de **Auto-Pausa** tras **60 minutos** (1 hora) sin conexiones activas, reduciendo su cómputo (vCores) a cero.

### 2.2 El Timeout de 15 Segundos (`ETIMEOUT`)
* Cuando un usuario intentaba ingresar después de una pausa, Azure App Service encendía el contenedor Node.js e intentaba conectar con Azure SQL.
* Azure SQL tarda entre **30 y 60 segundos** en reanudar su cómputo desde el estado de pausa.
* Sin embargo, el conector de Node.js (`tedious` / `mssql`) tenía configurado un timeout por defecto de solo **15 segundos**.
* Al llegar al segundo 15, la conexión abortaba con el error:  
  `{"message":"Error fetching projects","error":{"code":"ETIMEOUT","name":"ConnectionError"}}`

### 2.3 El "Modo Zombie" (Por qué exigía reiniciar Azure)
* En `backend/src/server.ts`, al fallar la conexión inicial en el arranque por timeout, la variable `pool` quedaba en `null`.
* La función `getPool()` en `backend/src/db/index.ts` era completamente sincrónica y estática:
  ```typescript
  export const getPool = () => {
      if (!pool) throw new Error('Database not connected');
      return pool;
  };
  ```
* **Nunca volvía a intentar reconectar**. El proceso quedaba atrapado en un estado zombi donde el 100% de las peticiones futuras eran rechazadas de inmediato con `500 Database not connected`.
* La única forma de sacarlo de ese estado era reiniciar el App Service en Azure.

---

## 3. Mejoras Implementadas en el Código

### 3.1 Backend: Pool Resiliente y Auto-Sanador (`backend/src/db/index.ts`)
* **Timeouts ampliados a 60 segundos:** Se fijó `connectionTimeout: 60000` y `requestTimeout: 60000` para tolerar holgadamente el despertar de Azure SQL.
* **Pool Dinámico (`min: 0`):** Se evitó mantener conexiones zombis cuando Azure corta sockets inactivos.
* **Auto-Reconexión Transparente (`await getPool()`):** Si la base de datos se durmió o el pool se cerró, cada consulta valida el estado y reconecta automáticamente en segundo plano. **Se eliminó por completo la necesidad de reiniciar Azure.**
* **Repositorios actualizados:** Se actualizaron `projectRepository.ts`, `resourceRepository.ts`, `rateRepository.ts` y `closureRepository.ts` para consumir el pool asíncrono auto-sanador.

### 3.2 Endpoints de Salud y Diagnóstico (`backend/src/server.ts`)
* Se mantuvo `/health` para validación básica de la API.
* Se agregó `/health/db` que comprueba activamente la conectividad con Azure SQL y sirve como objetivo para el ping de mantenimiento.

### 3.3 Frontend: Reintentos Automáticos y Experiencia de Usuario
* **Reintentos en `src/services/apiService.js`:** Implementación de `fetchWithRetry` que reintenta hasta 2 veces las peticiones GET si el servidor está en proceso de arranque.
* **UI de Carga y Recuperación (`src/components/dashboard-view.js`, `projects-view.js`, `resources-view.js`):**
  * Indicador de carga animado explicando el estado de despertar.
  * Uso automático de los datos en caché local (`StorageService`) si la red experimenta lentitud.
  * Botón interactivo *"🔄 Reintentar Conexión Ahora"* para no forzar recargas completas del navegador.

---

## 4. Automatización Keep-Alive (GitHub Action)

Para evitar que Azure entre en reposo durante el horario de trabajo de la empresa, se implementó el workflow:
* **Archivo:** `.github/workflows/keep_alive.yml`
* **Frecuencia:** Cada 15 minutos (`*/15 11-22 * * 1-5`).
* **Horario:** Lunes a Viernes de **08:00 a 19:45** (hora local de Chile/Brasil, UTC-3).
* **Función:** Envía una solicitud GET a `https://pmoapp-avbhckasgjbfcag4.brazilsouth-01.azurewebsites.net/health/db`.
* **Resultado:** Mantiene tanto el contenedor de Azure App Service como la base de datos Azure SQL activos y listos para respuesta inmediata (<1 segundo).
* **Costo:** **$0 USD**.

---

## 5. Historial de Despliegue en GitHub

* **Commit 1 (`af20545`):** `fix: pool de base de datos resiliente, timeout de 60s y auto-reintentos para standby en Azure`
* **Commit 2 (`bee7641`):** `ci: agregar github action keep-alive para mantener activo azure y la base de datos`
* **Rama:** `main` (Despliegue automático a Azure Web Apps mediante GitHub Actions).
