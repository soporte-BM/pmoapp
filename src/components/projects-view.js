import { ApiService } from '../services/apiService.js';
import { AnalyticsService } from '../services/analytics.js';
import { formatPercent, parsePeriodToMmmYy } from '../utils/format.js';

export async function renderProjects(container) {
    let projects = await ApiService.getProjects();
    const entries = await ApiService.getAllEntries();
    
    // Sort projects by Proyecto_Codigo by default
    projects.sort((a, b) => a.code.localeCompare(b.code));

    // Calculate profitability per project
    const projectStats = {};
    entries.forEach(entry => {
        const metrics = AnalyticsService.calculateMetrics(entry);
        if (!projectStats[entry.project]) {
            projectStats[entry.project] = {
                totalRevenue: 0,
                totalMargin: 0
            };
        }
        projectStats[entry.project].totalRevenue += metrics.revenue;
        projectStats[entry.project].totalMargin += metrics.margin;
    });

    const getProfitabilityColor = (profitability) => {
        if (profitability > 20) return '#0B8E84';
        if (profitability >= 10) return '#C9A227';
        return '#B03A2E';
    };

    let currentFilter = 'Todos';

    const render = () => {
        const filteredProjects = projects.filter(p => currentFilter === 'Todos' || p.status === currentFilter);

        const html = `
            <div class="projects-container">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <label for="statusFilter" style="font-weight: 500;">Filtro por Estado:</label>
                        <select id="statusFilter" class="form-input" style="width: auto;">
                            <option value="Todos" ${currentFilter === 'Todos' ? 'selected' : ''}>Todos</option>
                            <option value="Activo" ${currentFilter === 'Activo' ? 'selected' : ''}>Activo</option>
                            <option value="Finalizado" ${currentFilter === 'Finalizado' ? 'selected' : ''}>Finalizado</option>
                        </select>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <input type="file" id="excel-upload" accept=".xlsx, .xls" style="display: none;" />
                        <button id="btn-import-excel" class="btn-secondary">⬇️ Importar Excel</button>
                        <button id="btn-clear-imports" class="btn-secondary" style="color: #b45309; border-color: #b45309;">🗑️ Limpiar Importaciones</button>
                        <button id="btn-new-project" class="btn-primary">+ Nuevo Proyecto</button>
                    </div>
                </div>

                <div class="table-container" style="background: white; border-radius: 8px; padding: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <table class="data-table" style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="border-bottom: 2px solid #e5e7eb; text-align: left;">
                                <th style="padding: 12px; color: #6b7280;">Código</th>
                                <th style="padding: 12px; color: #6b7280;">Nombre del Proyecto</th>
                                <th style="padding: 12px; color: #6b7280;">Estado</th>
                                <th style="padding: 12px; color: #6b7280;">Rentabilidad Final</th>
                                <th style="padding: 12px; color: #6b7280; text-align: center;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredProjects.map(p => {
                                const stats = projectStats[p.name] || { totalRevenue: 0, totalMargin: 0 };
                                const profitability = stats.totalRevenue > 0 ? (stats.totalMargin / stats.totalRevenue) * 100 : 0;
                                const color = getProfitabilityColor(profitability);
                                
                                return `
                                    <tr style="border-bottom: 1px solid #e5e7eb;">
                                        <td style="padding: 12px;">${p.code}</td>
                                        <td style="padding: 12px;">${p.name}</td>
                                        <td style="padding: 12px;">
                                            <select class="status-select form-input" data-id="${p.id}" style="width: 130px; padding: 6px; border-radius: 4px;">
                                                <option value="Activo" ${p.status === 'Activo' ? 'selected' : ''}>Activo</option>
                                                <option value="Finalizado" ${p.status === 'Finalizado' ? 'selected' : ''}>Finalizado</option>
                                            </select>
                                        </td>
                                        <td style="padding: 12px;">
                                            <strong style="color: ${color}; font-size: 1.1em;">${formatPercent(profitability)}</strong>
                                        </td>
                                        <td style="padding: 12px; text-align: center;">
                                            <button class="btn-edit-registries" data-name="${p.name}" style="background: none; border: none; cursor: pointer; font-size: 1.2rem;" title="Ver Cierres de Mes">📅</button>
                                            <button class="btn-edit-project" data-id="${p.id}" data-code="${p.code}" data-name="${p.name}" style="background: none; border: none; cursor: pointer; font-size: 1.2rem;" title="Editar Proyecto">✏️</button>
                                            <button class="btn-delete-project" data-name="${p.name}" data-id="${p.id}" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; color: #dc2626;" title="Eliminar Proyecto">🗑️</button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                            ${filteredProjects.length === 0 ? '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #6b7280;">No hay proyectos para el filtro seleccionado.</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        container.innerHTML = html;
        attachEvents();
    };

    const attachEvents = () => {
        const filter = document.getElementById('statusFilter');
        if (filter) {
            filter.addEventListener('change', (e) => {
                currentFilter = e.target.value;
                render();
            });
        }

        const btnNew = document.getElementById('btn-new-project');
        if (btnNew) {
            btnNew.addEventListener('click', () => {
                let modalContainer = document.getElementById('modal-container');
                let modalOverlay = document.getElementById('modal-overlay');

                if (!modalContainer || !modalOverlay) {
                    modalOverlay = document.createElement('div');
                    modalOverlay.id = 'modal-overlay';
                    modalContainer = document.createElement('div');
                    modalContainer.id = 'modal-container';
                    document.body.appendChild(modalOverlay);
                    document.body.appendChild(modalContainer);
                }

                modalOverlay.className = 'hidden';
                modalOverlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000;';
                modalContainer.className = 'hidden';
                modalContainer.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1001; background: transparent; width: 100%; display: flex; justify-content: center;';

                const html = `
                    <div class="modal-content" style="background: white; padding: 20px; border-radius: 8px; width: 90%; max-width: 400px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                        <h3 style="margin-bottom: 20px; color: var(--secondary);">Crear Nuevo Proyecto</h3>
                        <div class="form-group" style="margin-bottom: 15px;">
                            <label class="form-label" style="display:block; margin-bottom: 5px; font-weight: 500;">Código del Proyecto:</label>
                            <input type="text" id="new-project-code" class="form-input" style="width: 100%; padding: 8px;" placeholder="Ej: PRJ-001" autocomplete="off" />
                        </div>
                        <div class="form-group" style="margin-bottom: 15px;">
                            <label class="form-label" style="display:block; margin-bottom: 5px; font-weight: 500;">Nombre del Proyecto:</label>
                            <input type="text" id="new-project-name" class="form-input" style="width: 100%; padding: 8px;" placeholder="Ej: Transformación Digital BM" autocomplete="off" />
                        </div>
                        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
                            <button id="btn-cancel-new" class="btn-secondary" style="padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer;">Cancelar</button>
                            <button id="btn-save-new" class="btn-primary" style="padding: 8px 16px; background: #0B8E84; color: white; border: none; border-radius: 4px; cursor: pointer;">Crear Proyecto</button>
                        </div>
                    </div>
                `;

                modalContainer.innerHTML = html;
                modalContainer.classList.remove('hidden');
                modalOverlay.classList.remove('hidden');

                document.getElementById('btn-cancel-new').addEventListener('click', () => {
                    modalContainer.classList.add('hidden');
                    modalOverlay.classList.add('hidden');
                });

                document.getElementById('btn-save-new').addEventListener('click', () => {
                    const code = document.getElementById('new-project-code').value.trim();
                    const name = document.getElementById('new-project-name').value.trim();

                    if (!code) {
                        alert("El código del proyecto es obligatorio.");
                        return;
                    }
                    if (!name) {
                        alert("El nombre del proyecto es obligatorio.");
                        return;
                    }

                    const codeExists = projects.some(p => p.code.toLowerCase() === code.toLowerCase());
                    if (codeExists) {
                        alert("El código de proyecto '" + code + "' ya está en uso. Ingresa uno diferente.");
                        return;
                    }

                    const newProject = { code, name, status: 'Activo' };
                    ApiService.saveProject(newProject).then(() => {
                        modalContainer.classList.add('hidden');
                        modalOverlay.classList.add('hidden');
                        ApiService.getProjects().then(p => {
                            projects = p;
                            render();
                        });
                    }).catch(err => alert("Error al crear proyecto: " + err.message));
                });
            });
        }

        const selects = document.querySelectorAll('.status-select');
        selects.forEach(select => {
            select.addEventListener('async change', async (e) => {
                const id = e.target.getAttribute('data-id');
                const newStatus = e.target.value;
                const project = projects.find(p => p.id == id); // id from API might be a number
                if (project) {
                    project.status = newStatus;
                    try {
                        // Normally we'd use an update endpoint, but for now we re-save
                        await ApiService.saveProject(project); 
                    } catch (error) {
                        alert('Error al guardar el estado: ' + error.message);
                        projects = await ApiService.getProjects();
                        render();
                    }
                }
            });
        });

        const registryBtns = document.querySelectorAll('.btn-edit-registries');
        registryBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const projectName = e.target.closest('button').dataset.name;
                openEditModal(projectName);
            });
        });

        const editBtns = document.querySelectorAll('.btn-edit-project');
        editBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const btnEl = e.target.closest('button');
                const projectId = btnEl.dataset.id;
                const projectCode = btnEl.dataset.code;
                const projectName = btnEl.dataset.name;
                openEditProjectModal(projectId, projectCode, projectName);
            });
        });

        const deleteBtns = document.querySelectorAll('.btn-delete-project');
        deleteBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const btnEl = e.target.closest('button');
                const projectName = btnEl.dataset.name;
                const projectId = btnEl.dataset.id;
                
                if (confirm(`¿Está seguro de que desea eliminar el proyecto "${projectName}"?`)) {
                    const validation = prompt(`ADVERTENCIA: Esta acción eliminará el proyecto y todos sus registros de horas (cierres).\nPara confirmar de forma definitiva, escriba exactamente: ELIMINAR`);
                    if (validation === 'ELIMINAR') {
                        try {
                            await ApiService.deleteProject(projectId);
                            alert('Proyecto y registros eliminados exitosamente.');
                            renderProjects(container);
                        } catch(error) {
                            alert('Error al eliminar proyecto: ' + error.message);
                        }
                    } else if (validation !== null) {
                        alert('Palabra de validación incorrecta. Eliminación cancelada.');
                    }
                }
            });
        });

        const btnImportExcel = document.getElementById('btn-import-excel');
        const excelUpload = document.getElementById('excel-upload');
        if (btnImportExcel && excelUpload) {
            btnImportExcel.addEventListener('click', () => excelUpload.click());
            excelUpload.addEventListener('change', handleExcelUpload);
        }

        const btnClearImports = document.getElementById('btn-clear-imports');
        if (btnClearImports) {
            btnClearImports.addEventListener('click', async () => {
                const allEntries = await ApiService.getAllEntries();
                const historicalEntries = allEntries.filter(e =>
                    e.professionals && e.professionals.length === 1 &&
                    (e.professionals[0].resourceName === 'Carga Histórica' || e.professionals[0].resourceName === 'Recurso Importado')
                );

                if (historicalEntries.length === 0) {
                    alert('No hay registros de importaciones históricas para eliminar.');
                    return;
                }

                alert('Limpieza masiva requiere endpoint especial en SQL. Contacte a soporte.');
            });
        }
    };

    const openEditProjectModal = (projectId, currentCode, currentName) => {
        let modalContainer = document.getElementById('modal-container');
        let modalOverlay = document.getElementById('modal-overlay');

        if (!modalContainer || !modalOverlay) {
            modalOverlay = document.createElement('div');
            modalOverlay.id = 'modal-overlay';
            modalContainer = document.createElement('div');
            modalContainer.id = 'modal-container';
            document.body.appendChild(modalOverlay);
            document.body.appendChild(modalContainer);
        }

        modalOverlay.className = 'hidden';
        modalOverlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000;';
        modalContainer.className = 'hidden';
        modalContainer.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1001; background: transparent; width: 100%; display: flex; justify-content: center;';

        const html = `
            <div class="modal-content" style="background: white; padding: 20px; border-radius: 8px; width: 90%; max-width: 400px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="margin-bottom: 20px; color: var(--secondary);">Editar Proyecto</h3>
                <div class="form-group" style="margin-bottom: 15px;">
                    <label class="form-label" style="display:block; margin-bottom: 5px; font-weight: 500;">Código del Proyecto:</label>
                    <input type="text" id="edit-project-code" class="form-input" style="width: 100%; padding: 8px;" value="${currentCode}" autocomplete="off" />
                </div>
                <div class="form-group" style="margin-bottom: 15px;">
                    <label class="form-label" style="display:block; margin-bottom: 5px; font-weight: 500;">Nombre del Proyecto:</label>
                    <input type="text" id="edit-project-name" class="form-input" style="width: 100%; padding: 8px;" value="${currentName}" autocomplete="off" />
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
                    <button id="btn-cancel-edit-proj" class="btn-secondary" style="padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer;">Cancelar</button>
                    <button id="btn-save-edit-proj" class="btn-primary" style="padding: 8px 16px; background: #0B8E84; color: white; border: none; border-radius: 4px; cursor: pointer;">Actualizar Proyecto</button>
                </div>
            </div>
        `;

        modalContainer.innerHTML = html;
        modalContainer.classList.remove('hidden');
        modalOverlay.classList.remove('hidden');

        document.getElementById('btn-cancel-edit-proj').addEventListener('click', () => {
            modalContainer.classList.add('hidden');
            modalOverlay.classList.add('hidden');
        });

        document.getElementById('btn-save-edit-proj').addEventListener('click', async () => {
            const code = document.getElementById('edit-project-code').value.trim();
            const name = document.getElementById('edit-project-name').value.trim();

            if (!code || !name) {
                alert("Ambos campos son obligatorios.");
                return;
            }

            try {
                await ApiService.updateProject(projectId, { code, name });
                modalContainer.classList.add('hidden');
                modalOverlay.classList.add('hidden');
                renderProjects(container);
            } catch(err) {
                alert("Error al actualizar proyecto: " + err.message);
            }
        });
    };

    const openEditModal = (projectName) => {
        let modalContainer = document.getElementById('modal-container');
        let modalOverlay = document.getElementById('modal-overlay');

        if (!modalContainer || !modalOverlay) {
            // Create them dynamically if they don't exist in index.html
            modalOverlay = document.createElement('div');
            modalOverlay.id = 'modal-overlay';
            
            modalContainer = document.createElement('div');
            modalContainer.id = 'modal-container';
            
            document.body.appendChild(modalOverlay);
            document.body.appendChild(modalContainer);
        }

        modalOverlay.className = 'hidden';
        modalOverlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000;';
        
        modalContainer.className = 'hidden';
        modalContainer.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1001; background: transparent; width: 100%; display: flex; justify-content: center;';

        const projectEntries = entries.filter(e => e.project === projectName);

        if (projectEntries.length === 0) {
            alert('Este proyecto no tiene registros (Cierre de Mes) para editar.');
            return;
        }

        // Descendente (más reciente primero)
        projectEntries.sort((a, b) => b.month.localeCompare(a.month));

        const html = `
            <div class="modal-content" style="background: white; padding: 20px; border-radius: 8px; width: 90%; max-width: 600px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="margin-bottom: 20px; color: #4f46e5;">Editar Proyecto: ${projectName}</h3>
                <div class="form-group" style="margin-bottom: 15px;">
                    <label class="form-label" style="display:block; margin-bottom: 5px; font-weight: 500;">Seleccione Periodo a Editar:</label>
                    <select id="edit-period-select" class="form-input" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #ccc;">
                        ${projectEntries.map((e, index) => `<option value="${e.id}" ${index === 0 ? 'selected' : ''}>${e.month} ${e.tipoRegistro === 'PROYECCION' ? '(Proyección)' : '(Real)'}</option>`).join('')}
                    </select>
                </div>
                <div id="edit-form-content">
                    <!-- Formulario dinámico inyectado aquí -->
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
                    <button id="btn-cancel-edit" class="btn-secondary" style="padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer;">Cancelar</button>
                    <button id="btn-save-edit" class="btn-primary" style="padding: 8px 16px; background: #0B8E84; color: white; border: none; border-radius: 4px; cursor: pointer;">Guardar Cambios</button>
                </div>
            </div>
        `;

        modalContainer.innerHTML = html;
        modalContainer.classList.remove('hidden');
        modalOverlay.classList.remove('hidden');

        // Lógica de llenado del formulario interno
        const selectPeriod = document.getElementById('edit-period-select');
        const fillEditForm = (entryId) => {
            const entry = projectEntries.find(e => e.id === entryId);
            if (!entry) return;

            const isHistorical = entry.professionals && entry.professionals.length === 1 && 
                               (entry.professionals[0].resourceName === 'Carga Histórica' || entry.professionals[0].resourceName === 'Recurso Importado');

            let professionalsHtml = '';
            if (isHistorical) {
                const totalHours = entry.professionals.reduce((sum, p) => sum + Number(p.hours), 0);
                professionalsHtml = `
                    <div class="form-group">
                        <label class="form-label">Total Horas Registradas</label>
                        <input type="number" class="form-input" value="${totalHours}" disabled style="background:#f3f4f6;">
                        <small style="color:var(--text-secondary); display:block; margin-top:4px;">Registro histórico cerrado. Horas no editables.</small>
                    </div>
                `;
            } else {
                professionalsHtml = `
                    <div class="form-group" style="grid-column: 1 / -1;">
                        <label class="form-label">Horas de Profesionales</label>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 5px;">
                            ${entry.professionals.map((p, i) => `
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <span style="flex:1; font-size: 0.9em; color: #4b5563;">${p.resourceName || p.name}</span>
                                    <input type="number" class="form-input edit-prof-hour" data-index="${i}" value="${p.hours}" style="width: 80px;" min="0">
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            const formHtml = `
                <div class="form-row" style="margin-top: 15px;">
                    <div class="form-group">
                        <label class="form-label">Ingreso Mensual (CLP)</label>
                        <input type="number" id="edit-revenue" class="form-input" value="${entry.revenue}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Costos de Terceros</label>
                        <input type="number" id="edit-third-costs" class="form-input" value="${entry.thirdPartyCosts}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Tipo de Registro</label>
                        <select id="edit-type-record" class="form-input">
                            <option value="REAL" ${entry.tipoRegistro !== 'PROYECCION' ? 'selected' : ''}>Real</option>
                            <option value="PROYECCION" ${entry.tipoRegistro === 'PROYECCION' ? 'selected' : ''}>Proyección</option>
                        </select>
                    </div>
                </div>
                <div class="form-row" style="margin-top: 10px;">
                    ${professionalsHtml}
                </div>
            `;
            document.getElementById('edit-form-content').innerHTML = formHtml;
        };

        selectPeriod.addEventListener('change', (e) => fillEditForm(e.target.value));
        
        // Carga inicial
        fillEditForm(selectPeriod.value);

        // Acciones
        document.getElementById('btn-cancel-edit').addEventListener('click', () => {
            modalContainer.classList.add('hidden');
            modalOverlay.classList.add('hidden');
        });

        document.getElementById('btn-save-edit').addEventListener('click', () => {
            const entryId = selectPeriod.value;
            const entry = projectEntries.find(e => e.id === entryId);
            
            const isHistorical = entry.professionals && entry.professionals.length === 1 && 
                               (entry.professionals[0].resourceName === 'Carga Histórica' || entry.professionals[0].resourceName === 'Recurso Importado');
            
            let updatedPros = [...entry.professionals];
            
            if (!isHistorical) {
                const hourInputs = document.querySelectorAll('.edit-prof-hour');
                hourInputs.forEach(input => {
                    const idx = input.getAttribute('data-index');
                    updatedPros[idx].hours = Number(input.value);
                });
            }

            const updatedData = {
                revenue: Number(document.getElementById('edit-revenue').value),
                thirdPartyCosts: Number(document.getElementById('edit-third-costs').value),
                tipoRegistro: document.getElementById('edit-type-record').value,
                professionals: updatedPros
            };

            try {
                // Ensure we pass project and month so ApiService can upsert
                updatedData.projectCode = project.code;
                updatedData.month = entry.month;
                updatedData.project = projectName;

                // Ensure professionals have 'name' property as expected by ApiService.saveEntry logic if changed
                updatedData.professionals = updatedData.professionals.map(p => ({
                    name: p.resourceName || p.name,
                    hours: p.hours
                }));

                ApiService.updateEntry(entryId, updatedData).then(() => {
                    alert('Registro actualizado exitosamente.');
                    modalContainer.classList.add('hidden');
                    modalOverlay.classList.add('hidden');
                    
                    // Actualizar interfaz principal
                    renderProjects(container);
                });
            } catch (error) {
                alert(error.message);
            }
        });
    };

    const handleExcelUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                if (data.length === 0) {
                    alert('El archivo Excel está vacío.');
                    return;
                }

                // Check required columns
                const firstRow = data[0];
                const required = ['Codigo_Proyecto', 'Nombre_Proyecto', 'Periodo', 'Ingreso_CLP', 'Costo_Interno_CLP', 'Costo_Externo_CLP'];
                const missing = required.filter(col => !(col in firstRow));
                
                if (missing.length > 0) {
                    alert('Faltan columnas obligatorias: ' + missing.join(', '));
                    return;
                }

                let loadedReal = 0;
                let loadedProj = 0;
                let errorCount = 0;
                let overwrittenCount = 0;
                let errors = [];

                ApiService.getProjects().then(async (currentProjects) => {
                const allEntries = entries;
                const processedRows = new Set();

                for (let index = 0; index < data.length; index++) {
                    const row = data[index];
                    const rowCode = String(row['Codigo_Proyecto'] || '').trim();
                    const rowName = String(row['Nombre_Proyecto'] || '').trim();
                    const rowManager = String(row['Jefe_Proyecto'] || '').trim();
                    const rowStatus = 'Activo';
                    const rowPeriod = row['Periodo'];
                    const statusKey = Object.keys(row).find(k => String(k).trim().toLowerCase() === 'status');
                    const rawStatus = statusKey ? row[statusKey] : 'REAL';

                    // Normalize accents and uppercase (e.g., 'Proyección' -> 'PROYECCION')
                    let importStatus = String(rawStatus).trim().toUpperCase();
                    importStatus = importStatus.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

                    if (!rowCode || !rowName) {
                        errorCount++;
                        errors.push(`Fila ${index + 2}: Codigo_Proyecto y Nombre_Proyecto no pueden estar vacíos.`);
                        continue;
                    }
                    
                    if (importStatus !== 'REAL' && importStatus !== 'PROYECCION') {
                        errorCount++;
                        errors.push(`Fila ${index + 2}: Status inválido "${row[statusKey]}". Debe ser REAL o PROYECCION.`);
                        continue;
                    }

                    const parsedPeriod = parsePeriodToMmmYy(rowPeriod);
                    
                    if (!parsedPeriod) {
                        errorCount++;
                        errors.push(`Fila ${index + 2}: Periodo inválido o faltante (${rowPeriod || 'vacío'}). Debe ser formato mmm-yy.`);
                        continue;
                    }
                    
                    const rowRevenue = Number(row['Ingreso_CLP']);
                    const rowInternalCost = Number(row['Costo_Interno_CLP']);
                    const rowExternalCost = Number(row['Costo_Externo_CLP']);

                    if (isNaN(rowRevenue) || isNaN(rowInternalCost) || isNaN(rowExternalCost)) {
                        errorCount++;
                        errors.push(`Fila ${index + 2}: Ingreso_CLP, Costo_Interno_CLP y Costo_Externo_CLP deben ser numéricos.`);
                        continue;
                    }

                    if (rowRevenue < 0 || rowInternalCost < 0 || rowExternalCost < 0) {
                        errorCount++;
                        errors.push(`Fila ${index + 2}: No se permiten montos negativos.`);
                        continue;
                    }

                    const uniqueKey = `${rowCode}_${parsedPeriod}_${importStatus}`;
                    if (processedRows.has(uniqueKey)) {
                        errorCount++;
                        errors.push(`Fila ${index + 2}: Duplicado en el mismo archivo para Proyecto ${rowCode}, Periodo ${parsedPeriod} y Status ${importStatus}.`);
                        continue;
                    }
                    processedRows.add(uniqueKey);

                    // Check if project exists, if not, create it
                    let project = currentProjects.find(p => p.code === rowCode);
                    if (!project) {
                        project = {
                            code: rowCode,
                            name: rowName,
                            manager: rowManager,
                            status: rowStatus
                        };
                        await ApiService.saveProject(project).catch(e => {
                            errorCount++;
                            errors.push(`Error al guardar proyecto ${rowCode}: ` + e.message);
                        });
                        currentProjects.push(project); 
                    }

                    const existingEntryIndex = allEntries.findIndex(e => e.project === project.name && e.month === parsedPeriod && e.tipoRegistro === importStatus);
                    
                    if (existingEntryIndex > -1) {
                        const overwrite = window.confirm(`El registro ${importStatus} para el proyecto "${project.name}" (Código: ${rowCode}) en el periodo ${parsedPeriod} ya existe.\n\n¿Desea sobrescribirlo con los datos del Excel?\n\n¡Advertencia! Esto reemplazará las horas y tarifas de Cierre de Mes de este periodo.`);
                        if (!overwrite) {
                            continue;
                        }
                        overwrittenCount++;
                    }

                    if (importStatus === 'REAL') {
                        loadedReal++;
                    } else if (importStatus === 'PROYECCION') {
                        loadedProj++;
                    }

                    const mockProfessional = {
                        name: 'Carga Histórica',
                        hours: 1, 
                        rate: rowInternalCost 
                    };

                    const entryData = {
                        project: project.name,
                        month: parsedPeriod,
                        revenue: rowRevenue,
                        thirdPartyCosts: rowExternalCost,
                        tipoRegistro: importStatus,
                        professionals: [mockProfessional]
                    };

                    if (existingEntryIndex > -1) {
                         const existingEntryId = allEntries[existingEntryIndex].id;
                         try {
                             await ApiService.updateEntry(existingEntryId, entryData);
                             allEntries[existingEntryIndex] = { ...allEntries[existingEntryIndex], ...entryData };
                         } catch (err) {
                             errorCount++;
                             errors.push(`Fila ${index + 2}: Error al actualizar - ${err.message}`);
                         }
                    } else {
                         try {
                             const savedEntry = await ApiService.saveEntry(entryData);
                             allEntries.push(savedEntry || entryData);
                         } catch (err) {
                             errorCount++;
                             errors.push(`Fila ${index + 2}: Error al guardar - ${err.message}`);
                         }
                    }
                }

                // Reset file input
                e.target.value = '';

                let message = `✅ Carga Exitosa:\n✔️ Cargados: ${loadedReal} REAL | ${loadedProj} PROYECCION\n🔄 ${overwrittenCount} registros sobrescritos.\n❌ ${errorCount} errores.`;
                if (errors.length > 0) {
                    message += `\n\nDetalles de errores:\n` + errors.slice(0, 5).join('\n');
                    if (errors.length > 5) message += `\n...y ${errors.length - 5} más.`;
                }

                alert(message);
                
                // Refresh list sin recargar la página completa
                renderProjects(container);

                }).catch(err => {
                    console.error("Excepción en promesa de importación:", err);
                    alert("Ocurrió un error inesperado al importar datos: " + err.message);
                }); // end of ApiService.getProjects().then

            } catch (err) {
                console.error(err);
                alert('Ocurrió un error al procesar el archivo Excel: ' + err.message);
            }
        };
        reader.readAsBinaryString(file);
    };

    render();
}
