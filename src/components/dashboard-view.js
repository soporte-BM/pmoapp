import { StorageService } from '../services/storage.js';
import { AnalyticsService } from '../services/analytics.js';
import { ApiService } from '../services/apiService.js';
import { formatCurrency, formatPercent, formatPeriod, parsePeriodToMmmYy } from '../utils/format.js';

export async function renderDashboard(container, options = {}) {
    const { 
        projectFilter = 'all', 
        calcMode = 'accumulated', // 'accumulated' or 'punctual'
        showAllProjects = false,
        startDate = '',
        endDate = '',
        skipFetch = false
    } = options;

    if (!skipFetch) {
        container.innerHTML = '<div style="padding:20px; text-align:center;">Cargando datos desde el servidor...</div>';
        try {
            const [dbProjects, dbClosures] = await Promise.all([
                ApiService.getProjects(),
                ApiService.getAllEntries()
            ]);

            const mappedProjects = dbProjects.map(p => ({
                id: String(p.id),
                code: p.project_code,
                name: p.name,
                manager: p.manager,
                status: p.status === 'INACTIVE' ? 'Finalizado' : 'Activo'
            }));

            const mappedEntries = dbClosures.map(c => ({
                id: String(c.id),
                projectCode: c.project_code,
                project: c.project_name, 
                month: parsePeriodToMmmYy(c.period),
                revenue: Number(c.revenue) || 0,
                thirdPartyCosts: Number(c.third_party_costs) || 0,
                professionals: (c.resources || []).map(r => ({
                    name: r.resource_name,
                    hours: Number(r.hours),
                    rate: Number(r.rate_snapshot_direct) + Number(r.rate_snapshot_indirect)
                })),
                tipoRegistro: c.status === 'VALIDATED' ? 'REAL' : 'PROYECCION' 
            }));

            StorageService.saveProjectsBulk(mappedProjects);
            StorageService.saveEntriesBulk(mappedEntries);
        } catch (err) {
            console.error('Error sincronizando con Backend en Dashboard:', err);
            // Only alert if there is no local cache yet (meaning it's probably a cold start failure)
            if (!sessionStorage.getItem('pmo_projects_v1')) {
                container.innerHTML = `
                    <div style="padding:40px; text-align:center; color:#b91c1c;">
                        <h2>Error de Conexión</h2>
                        <p>No se pudo conectar con el servidor.</p>
                        <p><strong>Nota:</strong> Como el sistema está alojado en la nube (Azure), si ha pasado mucho tiempo sin uso, el servidor entra en Standby por ahorro de energía.</p>
                        <p><strong>Por favor, espere 15 segundos y <a href="#" onclick="window.location.reload()" style="color:#2a7fde; font-weight:bold;">recargue la página</a>.</strong></p>
                    </div>
                `;
                return; // Stop rendering the rest of the empty dashboard
            }
        }
    }

    const allProjects = StorageService.getProjects();
    const activeProjectNames = new Set(allProjects.filter(p => p.status === 'Activo').map(p => p.name));
    
    const projectCodeMap = new Map();
    allProjects.forEach(p => {
        if (p.name && p.code) {
            projectCodeMap.set(p.name, p.code);
        }
    });

    const isExcelEntry = (entry) => {
        return entry.professionals && entry.professionals.length === 1 && 
               (entry.professionals[0].name === 'Carga Histórica' || entry.professionals[0].name === 'Recurso Importado');
    };

    let rawEntries = StorageService.getAllEntries();

    // 1. Filter by Project Status (Active vs All)
    let filteredAllEntries = [...rawEntries];
    if (!showAllProjects) {
        filteredAllEntries = filteredAllEntries.filter(e => activeProjectNames.has(e.project));
    }

    const MONTHS_ORDER = {
        'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
        'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11
    };

    const getPeriodValue = (period) => {
        if (!period) return 0;
        const [m, y] = period.split('-');
        return parseInt(y) * 12 + MONTHS_ORDER[m];
    };

    const availableProjects = showAllProjects 
        ? allProjects.map(p => p.name).sort() 
        : Array.from(activeProjectNames).sort();

    // 2. Filter by Specific Project
    if (projectFilter !== 'all') {
        filteredAllEntries = filteredAllEntries.filter(e => e.project === projectFilter);
    }

    // Deduplicate entries separately for REAL and PROYECCION
    let realEntriesMap = new Map();
    let projEntriesMap = new Map();

    filteredAllEntries.forEach(entry => {
        const key = `${entry.project}_${entry.month}`;
        const type = entry.tipoRegistro || 'REAL';
        const targetMap = type === 'PROYECCION' ? projEntriesMap : realEntriesMap;

        if (!targetMap.has(key)) {
            targetMap.set(key, entry);
        } else {
            const existing = targetMap.get(key);
            if (isExcelEntry(existing) && !isExcelEntry(entry)) {
                targetMap.set(key, entry);
            } else if (isExcelEntry(existing) === isExcelEntry(entry)) {
                targetMap.set(key, entry);
            }
        }
    });

    const validRealEntries = Array.from(realEntriesMap.values());
    const validProjEntries = Array.from(projEntriesMap.values());

    // Consolidate REAL entries per project for KPIs and Tables
    const projectConsolidated = new Map();
    validRealEntries.forEach(entry => {
        const metrics = AnalyticsService.calculateMetrics(entry);
        if (!projectConsolidated.has(entry.project)) {
            projectConsolidated.set(entry.project, {
                project: entry.project,
                month: entry.month, 
                revenue: 0,
                totalCost: 0,
                margin: 0,
                profitability: 0
            });
        }
        const pData = projectConsolidated.get(entry.project);
        pData.revenue += metrics.revenue;
        pData.totalCost += metrics.totalCost;
        pData.margin += metrics.margin;
        
        if (getPeriodValue(entry.month) > getPeriodValue(pData.month)) {
            pData.month = entry.month;
        }
    });

    const processedData = Array.from(projectConsolidated.values()).map(pData => {
        pData.profitability = pData.revenue > 0 ? (pData.margin / pData.revenue) * 100 : 0;
        return pData;
    }).sort((a, b) => b.profitability - a.profitability);

    const totalRevenue = processedData.reduce((sum, e) => sum + e.revenue, 0);
    const totalMargin = processedData.reduce((sum, e) => sum + e.margin, 0);
    const avgProfitability = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

    // --- KPI DESVIACIÓN CALCULATION ---
    let kpiDeviationPercent = null;
    let kpiDeviationCLP = null;
    
    const devPeriodsMap = new Map();
    [...validRealEntries, ...validProjEntries].forEach(entry => {
        const d = AnalyticsService.calculateMetrics(entry);
        const tipoRegistro = entry.tipoRegistro || 'REAL';

        if (!devPeriodsMap.has(d.month)) {
            devPeriodsMap.set(d.month, { realRevenue: 0, realCost: 0, projRevenue: 0, projCost: 0 });
        }
        const current = devPeriodsMap.get(d.month);
        
        if (tipoRegistro === 'PROYECCION') {
            current.projRevenue += d.revenue;
            current.projCost += d.totalCost;
        } else {
            current.realRevenue += d.revenue;
            current.realCost += d.totalCost;
        }
    });

    const devSortedPeriods = Array.from(devPeriodsMap.keys()).sort((a, b) => {
        const [monthA, yearA] = a.split('-');
        const [monthB, yearB] = b.split('-');
        const dateA = parseInt(yearA) * 12 + MONTHS_ORDER[monthA];
        const dateB = parseInt(yearB) * 12 + MONTHS_ORDER[monthB];
        return dateA - dateB;
    });

    let devFirstProjIndex = -1;
    devSortedPeriods.forEach((p, idx) => {
        const metrics = devPeriodsMap.get(p);
        if (metrics.projRevenue > 0 || metrics.projCost > 0) {
            if (devFirstProjIndex === -1) {
                devFirstProjIndex = idx;
            }
        }
    });

    let devRunningRealRev = 0, devRunningRealCost = 0;
    let devAccumulatedProjRev = 0, devAccumulatedProjCost = 0;
    let lastComparableData = null;

    devSortedPeriods.forEach((p, idx) => {
        const originalMetrics = devPeriodsMap.get(p);
        let activeRealRev = originalMetrics.realRevenue;
        let activeRealCost = originalMetrics.realCost;
        let activeProjRev = originalMetrics.projRevenue;
        let activeProjCost = originalMetrics.projCost;

        if (calcMode === 'accumulated') {
            devRunningRealRev += originalMetrics.realRevenue;
            devRunningRealCost += originalMetrics.realCost;
            
            if (devFirstProjIndex === -1 || idx < devFirstProjIndex) {
                devAccumulatedProjRev = 0;
                devAccumulatedProjCost = 0;
            } else if (idx === devFirstProjIndex) {
                const baseRealRev = devRunningRealRev - originalMetrics.realRevenue;
                const baseRealCost = devRunningRealCost - originalMetrics.realCost;
                devAccumulatedProjRev = baseRealRev + originalMetrics.projRevenue;
                devAccumulatedProjCost = baseRealCost + originalMetrics.projCost;
            } else {
                devAccumulatedProjRev += originalMetrics.projRevenue;
                devAccumulatedProjCost += originalMetrics.projCost;
            }

            activeRealRev = devRunningRealRev;
            activeRealCost = devRunningRealCost;
            activeProjRev = devAccumulatedProjRev;
            activeProjCost = devAccumulatedProjCost;
        }

        const hasReal = originalMetrics.realRevenue > 0 || originalMetrics.realCost > 0;
        let isProjActive = originalMetrics.projRevenue > 0 || originalMetrics.projCost > 0;
        if (calcMode === 'accumulated') {
            isProjActive = (devFirstProjIndex !== -1 && idx >= devFirstProjIndex);
        }

        if (hasReal && isProjActive) {
            const realMargin = activeRealRev - activeRealCost;
            const realProfit = activeRealRev > 0 ? (realMargin / activeRealRev) * 100 : 0;
            
            const projMargin = activeProjRev - activeProjCost;
            const projProfit = activeProjRev > 0 ? (projMargin / activeProjRev) * 100 : 0;

            lastComparableData = {
                realProfit,
                projProfit,
                realRev: activeRealRev
            };
        }
    });

    if (lastComparableData) {
        kpiDeviationPercent = lastComparableData.realProfit - lastComparableData.projProfit;
        kpiDeviationCLP = lastComparableData.realRev * (kpiDeviationPercent / 100);
    }
    // --- END KPI CALCULATION ---

    // Insights renderizados dinámicamente por initCharts para mantener consistencia 100% con la visualización

    const html = `
        <div class="dashboard-grid">
            <!-- Filters Section -->
            <div class="dashboard-filters" style="grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 15px; background: white; padding: 15px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 5px; align-items: center;">
                <div style="display: flex; gap: 10px; align-items: center;">
                    <label for="dash-project-filter" style="font-weight: 500; color: #4b5563;">Proyecto:</label>
                    <select id="dash-project-filter" class="form-input" style="width: auto;">
                        <option value="all" ${projectFilter === 'all' ? 'selected' : ''}>Todos los proyectos</option>
                        ${availableProjects.map(p => {
                            const pCode = projectCodeMap.get(p) || '';
                            const display = pCode ? `${p} - ${pCode}` : p;
                            return `<option value="${p}" ${projectFilter === p ? 'selected' : ''}>${display}</option>`;
                        }).join('')}
                    </select>
                </div>

                <div style="display: flex; gap: 10px; align-items: center;">
                    <label for="dash-calc-mode" style="font-weight: 500; color: #4b5563;">Modo:</label>
                    <select id="dash-calc-mode" class="form-input" style="width: auto;">
                        <option value="accumulated" ${calcMode === 'accumulated' ? 'selected' : ''}>Acumulado</option>
                        <option value="punctual" ${calcMode === 'punctual' ? 'selected' : ''}>Mensual</option>
                    </select>
                </div>

                <div style="display: flex; gap: 10px; align-items: center;">
                    <label for="dash-start-date" style="font-weight: 500; color: #4b5563;">Desde:</label>
                    <input type="month" id="dash-start-date" class="form-input" style="width: auto;" value="${startDate}">
                </div>
                
                <div style="display: flex; gap: 10px; align-items: center;">
                    <label for="dash-end-date" style="font-weight: 500; color: #4b5563;">Hasta:</label>
                    <input type="month" id="dash-end-date" class="form-input" style="width: auto;" value="${endDate}">
                </div>

                <div style="flex-grow: 1; display: flex; justify-content: flex-end;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: #4b5563; font-weight: 500;">
                        <input type="checkbox" id="toggle-all-projects" ${showAllProjects ? 'checked' : ''}>
                        Incluir finalizados
                    </label>
                </div>
            </div>

            <!-- KPI Row -->
            <div class="kpi-row">
                <div class="kpi-card">
                    <span class="kpi-title">Ingresos Totales</span>
                    <span class="kpi-value">${formatCurrency(totalRevenue)}</span>
                </div>
                <div class="kpi-card ${avgProfitability < 20 ? 'warning' : 'success'}">
                    <span class="kpi-title">Rentabilidad Global</span>
                    <span class="kpi-value">${formatPercent(avgProfitability)}</span>
                    <span class="kpi-trend text-secondary" style="font-weight: normal;">Margen: ${formatCurrency(Math.round(totalRevenue * (avgProfitability / 100)))}</span>
                    <span class="kpi-trend text-secondary">Objetivo: 20%</span>
                </div>
                <div class="kpi-card">
                    <span class="kpi-title">% Desviación</span>
                    ${kpiDeviationPercent !== null ? `
                    <span class="kpi-value">${kpiDeviationPercent.toFixed(1)}%</span>
                    <span class="kpi-trend text-secondary" style="font-weight: normal;">Desviación: ${formatCurrency(Math.round(kpiDeviationCLP))}</span>
                    ` : ''}
                </div>
                <div class="kpi-card danger">
                    <span class="kpi-title">En Riesgo (<10%)</span>
                    <span class="kpi-value">${processedData.filter(d => d.profitability < 10).length}</span>
                </div>
            </div>

            <!-- Main Charts -->
            <div class="chart-container span-4">
                <div class="chart-header">
                    <h3 class="chart-title">Evolución del Negocio (Rentabilidad vs Ingresos/Costos)</h3>
                </div>
                <div class="custom-chart-legend" style="display: flex; flex-wrap: wrap; gap: 20px; font-size: 0.9em; margin-bottom: 15px;">
                    <div style="display: flex; gap: 15px; align-items: center;">
                        <strong>Líneas:</strong>
                        <span style="display: flex; align-items: center; gap: 5px;"><span style="display: inline-block; width: 20px; border-bottom: 3px solid #2A7FDE;"></span> REAL</span>
                        <span style="display: flex; align-items: center; gap: 5px;"><span style="display: inline-block; width: 20px; border-bottom: 3px dashed #2A7FDE;"></span> PROYECCIÓN</span>
                    </div>
                    <div style="display: flex; gap: 15px; align-items: center;">
                        <strong>Barras:</strong>
                        <span style="display: flex; align-items: center; gap: 5px;">Ingreso Total = </span>
                        <span style="display: flex; align-items: center; gap: 5px;"><span style="display: inline-block; width: 14px; height: 14px; background: #7A7A7A;"></span> Costo Total</span> +
                        <span style="display: flex; align-items: center; gap: 5px;"><span style="display: inline-block; width: 14px; height: 14px; background: #0B8E84;"></span> Margen</span>
                    </div>
                </div>
                <div class="chart-wrapper">
                    <canvas id="profitChart"></canvas>
                </div>
            </div>

            <!-- Analysis & Rankings -->
             <div class="analysis-panel">
                <h3 class="chart-title">Análisis Inteligente</h3>
                <div class="analysis-grid">
                    <div class="analysis-box" id="insights-container">
                        <h4>🔍 Hallazgos Principales</h4>
                        <ul class="analysis-list" id="dashboard-insights-list">
                            <!-- Populated dynamically by initCharts matching exact visual data -->
                        </ul>
                    </div>
                     <div class="analysis-box">
                        <h4>🏆 Ranking de Rentabilidad</h4>
                         <table class="ranking-table">
                            <thead>
                                <tr>
                                    <th>Status</th>
                                    <th>Proyecto</th>
                                    <th>Ingreso</th>
                                    <th>Margen %</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${processedData.filter(p => activeProjectNames.has(p.project)).map(p => {
        const health = AnalyticsService.getHealthStatus(p.profitability);
        return `
                                    <tr>
                                        <td><span class="status-dot bg-${health.status}"></span></td>
                                        <td>${p.project}</td>
                                        <td>${formatCurrency(p.revenue)}</td>
                                        <td class="${health.status === 'danger' ? 'text-danger' : ''}"><strong>${formatPercent(p.profitability)}</strong></td>
                                    </tr>
                                    `;
    }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
    
    // Convert period to an absolute month value for comparison
    const getPeriodValueSafe = (periodStr) => {
        if (!periodStr) return 0;
        const [m, yStr] = periodStr.split('-');
        let y = parseInt(yStr);
        if (y < 100) y += 2000;
        return y * 12 + MONTHS_ORDER[m];
    };

    const getIsoMonthValue = (isoString) => {
        if (!isoString) return 0;
        const [y, m] = isoString.split('-');
        return parseInt(y) * 12 + (parseInt(m) - 1);
    };

    let chartEntries = [...validRealEntries, ...validProjEntries];
    
    if (startDate || endDate) {
        let startVal = startDate ? getIsoMonthValue(startDate) : 0;
        let endVal = endDate ? getIsoMonthValue(endDate) : Infinity;
        
        chartEntries = chartEntries.filter(e => {
            const pv = getPeriodValueSafe(e.month);
            return pv >= startVal && pv <= endVal;
        });
    }

    initCharts(chartEntries, calcMode);

    const getOptions = () => ({
        projectFilter: document.getElementById('dash-project-filter').value,
        calcMode: document.getElementById('dash-calc-mode').value,
        showAllProjects: document.getElementById('toggle-all-projects').checked,
        startDate: document.getElementById('dash-start-date').value,
        endDate: document.getElementById('dash-end-date').value,
        skipFetch: true // prevent re-fetching on local filter changes
    });

    const addListener = (id) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => renderDashboard(container, getOptions()));
    };

    addListener('dash-project-filter');
    addListener('dash-calc-mode');
    addListener('toggle-all-projects');
    addListener('dash-start-date');
    addListener('dash-end-date');
}

function initCharts(allEntries, calcMode) {
    if (!allEntries || allEntries.length === 0) return;

    // Group data by period
    const periodsMap = new Map();
    
    allEntries.forEach(entry => {
        const d = AnalyticsService.calculateMetrics(entry);
        const tipoRegistro = entry.tipoRegistro || 'REAL';

        if (!periodsMap.has(d.month)) {
            periodsMap.set(d.month, { 
                realRevenue: 0, realCost: 0, 
                projRevenue: 0, projCost: 0 
            });
        }
        const current = periodsMap.get(d.month);
        
        if (tipoRegistro === 'PROYECCION') {
            current.projRevenue += d.revenue;
            current.projCost += d.totalCost;
        } else {
            current.realRevenue += d.revenue;
            current.realCost += d.totalCost;
        }
    });

    // Sort periods chronologically
    // Note: MONTHS_ORDER is now defined at the top of the file, we can just use the same logic
    // but here we just need a local map if we don't pass getPeriodValue down, which we don't.
    const CHART_MONTHS_ORDER = {
        'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
        'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11
    };
    
    const sortedPeriods = Array.from(periodsMap.keys()).sort((a, b) => {
        const [monthA, yearA] = a.split('-');
        const [monthB, yearB] = b.split('-');
        const dateA = parseInt(yearA) * 12 + CHART_MONTHS_ORDER[monthA];
        const dateB = parseInt(yearB) * 12 + CHART_MONTHS_ORDER[monthB];
        return dateA - dateB;
    });
    
    const labels = sortedPeriods.map(p => formatPeriod(p));
    
    const costData = [];
    const marginData = [];
    
    const projCostData = [];
    const projMarginData = [];

    const profitData = [];
    const projProfitData = [];
    
    const tooltipData = [];

    // Find the index of the first period with projection data
    let firstProjIndex = -1;
    sortedPeriods.forEach((p, idx) => {
        const metrics = periodsMap.get(p);
        if (metrics.projRevenue > 0 || metrics.projCost > 0) {
            if (firstProjIndex === -1) {
                firstProjIndex = idx;
            }
        }
    });

    let runningRealRev = 0, runningRealCost = 0;
    let accumulatedProjRev = 0, accumulatedProjCost = 0;

    sortedPeriods.forEach((p, idx) => {
        const originalMetrics = periodsMap.get(p);
        let activeMetrics = { ...originalMetrics };
        
        const originalRealRev = originalMetrics.realRevenue;
        const originalRealCost = originalMetrics.realCost;
        const originalProjRev = originalMetrics.projRevenue;
        const originalProjCost = originalMetrics.projCost;

        if (calcMode === 'accumulated') {
            runningRealRev += originalRealRev;
            runningRealCost += originalRealCost;
            
            if (firstProjIndex === -1 || idx < firstProjIndex) {
                accumulatedProjRev = 0;
                accumulatedProjCost = 0;
            } else if (idx === firstProjIndex) {
                const baseRealRev = runningRealRev - originalRealRev;
                const baseRealCost = runningRealCost - originalRealCost;
                accumulatedProjRev = baseRealRev + originalProjRev;
                accumulatedProjCost = baseRealCost + originalProjCost;
            } else {
                accumulatedProjRev += originalProjRev;
                accumulatedProjCost += originalProjCost;
            }

            activeMetrics.realRevenue = runningRealRev;
            activeMetrics.realCost = runningRealCost;
            activeMetrics.projRevenue = accumulatedProjRev;
            activeMetrics.projCost = accumulatedProjCost;
        }

        const realMargin = activeMetrics.realRevenue - activeMetrics.realCost;
        const realProfitPercent = activeMetrics.realRevenue > 0 ? (realMargin / activeMetrics.realRevenue) * 100 : null;

        const projMargin = activeMetrics.projRevenue - activeMetrics.projCost;
        const projProfitPercent = activeMetrics.projRevenue > 0 ? (projMargin / activeMetrics.projRevenue) * 100 : null;

        const hasReal = originalRealRev > 0 || originalRealCost > 0;
        const hasProj = originalProjRev > 0 || originalProjCost > 0;
        
        costData.push(hasReal ? activeMetrics.realCost : null);
        marginData.push(hasReal ? realMargin : null);
        
        if (calcMode === 'accumulated') {
            const isProjActive = (firstProjIndex !== -1 && idx >= firstProjIndex);
            projCostData.push(isProjActive ? activeMetrics.projCost : null);
            projMarginData.push(isProjActive ? projMargin : null);
        } else {
            projCostData.push(hasProj ? activeMetrics.projCost : null);
            projMarginData.push(hasProj ? projMargin : null);
        }

        if (hasReal) {
            profitData.push(realProfitPercent !== null ? realProfitPercent.toFixed(1) : 0);
        } else {
            profitData.push(null);
        }

        if (calcMode === 'accumulated') {
            if (firstProjIndex === -1 || idx < firstProjIndex) {
                 projProfitData.push(null);
            } else {
                 projProfitData.push(projProfitPercent !== null ? projProfitPercent.toFixed(1) : 0);
            }
        } else {
            if (hasProj) {
                projProfitData.push(projProfitPercent !== null ? projProfitPercent.toFixed(1) : 0);
            } else {
                projProfitData.push(null);
            }
        }

        let totalRev = activeMetrics.realRevenue + activeMetrics.projRevenue;
        let totalMargin = realMargin + projMargin;
        let combinedProfitDesc = totalRev > 0 ? (totalMargin / totalRev) * 100 : 0;

        tooltipData.push({
            period: formatPeriod(p),
            realRev: activeMetrics.realRevenue,
            realCost: activeMetrics.realCost,
            realMarg: realMargin,
            realProfit: realProfitPercent !== null ? realProfitPercent.toFixed(1) : 'N/A',
            rawRealProfit: realProfitPercent,
            projRev: activeMetrics.projRevenue,
            projCost: activeMetrics.projCost,
            projMarg: projMargin,
            projProfit: projProfitPercent !== null ? projProfitPercent.toFixed(1) : 'N/A',
            rawProjProfit: projProfitPercent,
            profitPercent: combinedProfitDesc.toFixed(1),
            hasRealDot: profitData[profitData.length - 1] !== null,
            hasProjDot: projProfitData[projProfitData.length - 1] !== null
        });
    });

    const insights = [];

    // 1.1 Desviación de Margen (Last period that has both REAL and PROJ original data != null in the chart)
    let devPeriod = null;
    for (let i = tooltipData.length - 1; i >= 0; i--) {
        const d = tooltipData[i];
        if (d.hasRealDot && d.hasProjDot && d.rawRealProfit !== null && d.rawProjProfit !== null && isFinite(d.rawRealProfit) && isFinite(d.rawProjProfit)) {
            devPeriod = d;
            break;
        }
    }
    
    if (devPeriod) {
        const devPercent = devPeriod.rawRealProfit - devPeriod.rawProjProfit;
        const devCLP = devPeriod.realRev * (devPercent / 100);

        insights.push({
            title: 'Desviación de Margen',
            details: [`La diferencia entre la rentabilidad real y la proyectada es de ${devPercent.toFixed(1)} puntos porcentuales.`],
            data: `(Desviación: ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(Math.round(devCLP))})`
        });
    }

    // 1.2 Tendencia Reciente (Last 3 visible real non-null points)
    const realPoints = tooltipData.filter(d => d.hasRealDot && d.rawRealProfit !== null && isFinite(d.rawRealProfit));
    if (realPoints.length >= 3) {
        const p0 = realPoints[realPoints.length - 3];
        const p2 = realPoints[realPoints.length - 1];

        const diff = p2.rawRealProfit - p0.rawRealProfit;

        let trendLabel = 'estable';
        if (diff > 0.5) trendLabel = 'creciente';
        else if (diff < -0.5) trendLabel = 'decreciente';

        insights.push({
            title: 'Tendencia Reciente',
            details: [`La evolución en los últimos 3 periodos reales es ${trendLabel}.`],
            data: `(Variación Rentabilidad: ${diff > 0 ? '+' : ''}${diff.toFixed(1)}%)`
        });
    }

    // 1.3 Proyección Final (Last visible projection point in chart)
    let lastProjPoint = null;
    for (let i = tooltipData.length - 1; i >= 0; i--) {
        if (tooltipData[i].hasProjDot && tooltipData[i].rawProjProfit !== null && isFinite(tooltipData[i].rawProjProfit)) {
            lastProjPoint = tooltipData[i];
            break;
        }
    }
    
    if (lastProjPoint) {
        const finalProf = lastProjPoint.rawProjProfit;
        let proyClass = 'alta rentabilidad';
        if (finalProf < 10) proyClass = 'baja rentabilidad o deterioro';
        else if (finalProf < 20) proyClass = 'rentabilidad media';

        insights.push({
            title: 'Proyección Final',
            details: [`El resultado esperado en base a la proyección es de ${proyClass}.`],
            data: `(Rentabilidad Proyectada: ${finalProf.toFixed(1)}%)`
        });
    }

    const insightsHtml = insights.map(i => `
        <li>
            <strong>${i.title}:</strong> ${i.details.join(' ')}
            <br/><span>${i.data}</span>
        </li>`).join('');
        
    const insightsListEl = document.getElementById('dashboard-insights-list');
    
    if (insightsListEl) {
        insightsListEl.innerHTML = insightsHtml;
    }

    const customCanvasBackgroundColor = {
        id: 'customCanvasBackgroundColor',
        beforeDraw: (chart, args, options) => {
            const {ctx} = chart;
            ctx.save();
            ctx.globalCompositeOperation = 'destination-over';
            ctx.fillStyle = options.color || '#F3F3F3';
            ctx.fillRect(0, 0, chart.width, chart.height);
            ctx.restore();
        }
    };

    new Chart(document.getElementById('profitChart'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    type: 'line',
                    label: 'REAL',
                    data: profitData,
                    borderColor: '#2A7FDE',
                    backgroundColor: '#2A7FDE',
                    borderWidth: 3,
                    tension: 0.3,
                    yAxisID: 'y',
                    spanGaps: true,
                    order: 0
                },
                {
                    type: 'line',
                    label: 'PROYECCION',
                    data: projProfitData,
                    borderColor: '#2A7FDE',
                    backgroundColor: 'transparent',
                    borderWidth: 3,
                    borderDash: [5, 5],
                    tension: 0.3,
                    yAxisID: 'y',
                    spanGaps: true,
                    order: 0
                },
                {
                    type: 'bar',
                    label: 'REAL_COST',
                    data: costData,
                    backgroundColor: '#7A7A7A',
                    yAxisID: 'y1',
                    stack: 'Stack Real',
                    order: 2
                },
                {
                    type: 'bar',
                    label: 'REAL_MARGIN',
                    data: marginData,
                    backgroundColor: '#0B8E84',
                    yAxisID: 'y1',
                    stack: 'Stack Real',
                    order: 1
                },
                {
                    type: 'bar',
                    label: 'PROJ_COST',
                    data: projCostData,
                    backgroundColor: 'rgba(122, 122, 122, 0.4)',
                    borderColor: '#7A7A7A',
                    borderWidth: { top: 2, right: 2, left: 2, bottom: 0 },
                    borderDash: [5, 5],
                    yAxisID: 'y1',
                    stack: 'Stack Proj',
                    order: 2
                },
                {
                    type: 'bar',
                    label: 'PROJ_MARGIN',
                    data: projMarginData,
                    backgroundColor: 'rgba(11, 142, 132, 0.4)',
                    borderColor: '#0B8E84',
                    borderWidth: { top: 2, right: 2, left: 2, bottom: 0 },
                    borderDash: [5, 5],
                    yAxisID: 'y1',
                    stack: 'Stack Proj',
                    order: 1
                }
            ]
        },
        plugins: [customCanvasBackgroundColor],
        options: {
            events: ['click'],
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: true,
            },
            plugins: { 
                customCanvasBackgroundColor: {
                    color: '#F3F3F3',
                },
                legend: { 
                    display: false
                },
                tooltip: {
                    callbacks: {
                        title: function() {
                            return null; // Hide default title
                        },
                        beforeBody: function(context) {
                            const index = context[0].dataIndex;
                            const data = tooltipData[index];
                            
                            let lines = [
                                `Periodo: ${data.period}`
                            ];

                            if (data.realRev > 0 || data.realCost > 0) {
                                lines.push('--- REAL ---');
                                lines.push(`valor REAL: ${data.realProfit}%`);
                                lines.push(`Ingreso: ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(data.realRev)}`);
                                lines.push(`Costo:   ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(data.realCost)}`);
                                lines.push(`Margen:  ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(data.realMarg)}`);
                            }

                            if (data.projRev > 0 || data.projCost > 0) {
                                lines.push('--- PROYECCION ---');
                                lines.push(`valor PROYECCION: ${data.projProfit}%`);
                                lines.push(`Ingreso: ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(data.projRev)}`);
                                lines.push(`Costo:   ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(data.projCost)}`);
                                lines.push(`Margen:  ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(data.projMarg)}`);
                            }
                            
                            if ((data.realRev > 0 || data.realCost > 0) && (data.projRev > 0 || data.projCost > 0)) {
                                if (data.rawProjProfit !== null && data.rawRealProfit !== null && isFinite(data.rawProjProfit) && isFinite(data.rawRealProfit)) {
                                    const devPercent = data.rawRealProfit - data.rawProjProfit;
                                    const devCLP = data.realRev * (devPercent / 100);
                                    lines.push('--- COMPARATIVO ---');
                                    lines.push(`% Desviación: ${devPercent.toFixed(1)}%`);
                                    lines.push(`Monto Desviación: ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(Math.round(devCLP))}`);
                                }
                            }

                            return lines;
                        },
                        label: function() {
                            return null; // Suppress the default dataset label since we handle it in beforeBody
                        }
                    }
                }
            },
            scales: { 
                x: {
                    stacked: true,
                    grid: { display: false }
                },
                y: { 
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Rentabilidad (%)'
                    },
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    stacked: true,
                    title: {
                        display: true,
                        text: 'Monto (CLP)'
                    },
                    grid: {
                        drawOnChartArea: false, // only want the grid lines for one axis to show up
                    },
                    ticks: {
                        callback: function(value) {
                            if (value >= 1000000) {
                                return '$' + (value / 1000000).toFixed(1) + 'M';
                            } else if (value >= 1000) {
                                return '$' + (value / 1000).toFixed(1) + 'k';
                            }
                            return '$' + value;
                        }
                    }
                } 
            }
        }
    });
}
