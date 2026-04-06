import { StorageService } from '../services/storage.js';
import { ApiService } from '../services/apiService.js';
import { formatCurrency, formatPeriod, parsePeriodToMmmYy } from '../utils/format.js';

export async function renderResources(container) {
    container.innerHTML = '<div style="padding:20px; text-align:center;">Cargando datos desde el servidor...</div>';

    try {
        const ratesResult = await ApiService.getAllRates();
        const mappedPros = ratesResult.map(rr => ({
            id: String(rr.resource_id),
            name: rr.resource_name,
            period: rr.period,
            directRate: Number(rr.direct_rate) || 0,
            indirectRate: Number(rr.indirect_rate) || 0
        }));

        StorageService.saveProfessionalsBulk(mappedPros);
    } catch (err) {
        console.error('Error al sincronizar profesionales con el servidor:', err);
    }

    let professionals = StorageService.getProfessionals();

    let currentViewMode = 'plana';

    const MONTHS_ORDER = {
        'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
        'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11
    };

    const getPeriodValue = (period) => {
        if (!period) return 0;
        const parts = period.split('-');
        if (parts.length === 2 && MONTHS_ORDER[parts[0]] !== undefined) {
             return parseInt(parts[1]) * 12 + MONTHS_ORDER[parts[0]];
        }
        return 0;
    };

    const render = () => {
        const html = `
            <div class="projects-container">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <div style="display: flex; gap: 15px; align-items: center;">
                        <h2 style="margin: 0; color: #111827;">Maestro de Profesionales</h2>
                        <div style="display: flex; gap: 10px; align-items: center; margin-left: 20px; border-left: 1px solid #e5e7eb; padding-left: 20px;">
                            <label for="view-mode-select" style="font-weight: 500; font-size: 0.95em; color: #4b5563;">Agrupación:</label>
                            <select id="view-mode-select" class="form-input" style="width: auto; padding: 6px 12px;">
                                <option value="plana" ${currentViewMode === 'plana' ? 'selected' : ''}>Vista Plana</option>
                                <option value="mensual" ${currentViewMode === 'mensual' ? 'selected' : ''}>Agrupar por Periodo</option>
                            </select>
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <input type="file" id="excel-upload" accept=".xlsx, .xls" style="display: none;" />
                        <button id="btn-import-excel" class="btn-secondary">📤 Importar Excel</button>
                        <button id="btn-new-pro" class="btn-primary">+ Nuevo Profesional</button>
                    </div>
                </div>

                <div class="table-container" style="background: white; border-radius: 8px; padding: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <table class="data-table" style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="border-bottom: 2px solid #e5e7eb; text-align: left;">
                                <th style="padding: 12px; color: #6b7280;">Nombre</th>
                                <th style="padding: 12px; color: #6b7280;">Periodo</th>
                                <th style="padding: 12px; color: #6b7280; text-align: right;">Tarifa Directa</th>
                                <th style="padding: 12px; color: #6b7280; text-align: right;">Tarifa Indirecta</th>
                                <th style="padding: 12px; color: #6b7280; text-align: right;">Tarifa Break Even</th>
                                <th style="padding: 12px; color: #6b7280; text-align: center;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(() => {
                                if (professionals.length === 0) {
                                    return '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #6b7280;">No hay profesionales registrados. Use "Nuevo Profesional" o "Importar Excel".</td></tr>';
                                }

                                if (currentViewMode === 'plana') {
                                    return professionals.map(p => {
                                        const beRate = Number(p.directRate) + Number(p.indirectRate);
                                        return `
                                            <tr style="border-bottom: 1px solid #e5e7eb;">
                                                <td style="padding: 12px;">${p.name}</td>
                                                <td style="padding: 12px;">${formatPeriod(p.period)}</td>
                                                <td style="padding: 12px; text-align: right;">${formatCurrency(p.directRate)}</td>
                                                <td style="padding: 12px; text-align: right;">${formatCurrency(p.indirectRate)}</td>
                                                <td style="padding: 12px; text-align: right;"><strong>${formatCurrency(beRate)}</strong></td>
                                                <td style="padding: 12px; text-align: center;">
                                                    <button class="btn-edit-pro" data-id="${p.id}" style="background: none; border: none; cursor: pointer; font-size: 1.2rem;" title="Editar Profesional">✏️</button>
                                                    <button class="btn-delete-pro" data-id="${p.id}" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; color: #dc2626;" title="Eliminar Profesional">🗑️</button>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('');
                                }

                                if (currentViewMode === 'mensual') {
                                    const groups = {};
                                    professionals.forEach(p => {
                                        const key = p.period || 'Sin Periodo';
                                        if (!groups[key]) groups[key] = [];
                                        groups[key].push(p);
                                    });
                                    
                                    const sortedKeys = Object.keys(groups).sort((a,b) => getPeriodValue(b) - getPeriodValue(a)); // Descendente
                                    
                                    let html = '';
                                    sortedKeys.forEach(key => {
                                        const groupPros = groups[key];
                                        groupPros.sort((a, b) => String(a.name).localeCompare(String(b.name)));
                                        
                                        html += `
                                            <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                                                <td colspan="6" style="padding: 12px; color: #374151;">
                                                    <strong style="text-transform: uppercase;">${formatPeriod(key)}</strong>
                                                    <span style="margin-left: 10px; font-weight: normal; color: #6b7280; font-size: 0.9em;">- ${groupPros.length} Profesional${groupPros.length !== 1 ? 'es' : ''}</span>
                                                </td>
                                            </tr>
                                        `;
                                        
                                        html += groupPros.map(p => {
                                            const beRate = Number(p.directRate) + Number(p.indirectRate);
                                            return `
                                                <tr style="border-bottom: 1px solid #e5e7eb;">
                                                    <td style="padding: 12px; padding-left: 24px;">${p.name}</td>
                                                    <td style="padding: 12px;">${formatPeriod(p.period)}</td>
                                                    <td style="padding: 12px; text-align: right;">${formatCurrency(p.directRate)}</td>
                                                    <td style="padding: 12px; text-align: right;">${formatCurrency(p.indirectRate)}</td>
                                                    <td style="padding: 12px; text-align: right;"><strong>${formatCurrency(beRate)}</strong></td>
                                                    <td style="padding: 12px; text-align: center;">
                                                        <button class="btn-edit-pro" data-id="${p.id}" style="background: none; border: none; cursor: pointer; font-size: 1.2rem;" title="Editar Profesional">✏️</button>
                                                        <button class="btn-delete-pro" data-id="${p.id}" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; color: #dc2626;" title="Eliminar Profesional">🗑️</button>
                                                    </td>
                                                </tr>
                                            `;
                                        }).join('');
                                    });
                                    return html;
                                }
                            })()}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        container.innerHTML = html;
        attachEvents();
    };

    const attachEvents = () => {
        // View Mode Dropdown
        const viewModeSelect = document.getElementById('view-mode-select');
        if (viewModeSelect) {
            viewModeSelect.addEventListener('change', (e) => {
                currentViewMode = e.target.value;
                render();
            });
        }

        // Manual Add
        const btnNew = document.getElementById('btn-new-pro');
        if (btnNew) {
            btnNew.addEventListener('click', async () => {
                const name = prompt('Nombre del profesional:');
                if (!name) return;
                let period = prompt('Periodo (Ej: ene-25):');
                if (!period) return;
                const parsedPeriod = parsePeriodToMmmYy(period);
                if (!parsedPeriod) {
                    alert('Formato de periodo inválido. Debe ser mmm-yy (ej: ene-25).');
                    return;
                }
                period = parsedPeriod;
                const directRate = prompt('Tarifa Directa (CLP):');
                if (!directRate || isNaN(directRate)) return;
                const indirectRate = prompt('Tarifa Indirecta (CLP):');
                if (!indirectRate || isNaN(indirectRate)) return;

                const exists = professionals.some(p => String(p.name).trim() === name.trim() && String(p.period).trim() === period.trim());
                if (exists) {
                    alert('Registro duplicado: ya existe un profesional con el mismo Nombre en ese Periodo');
                    return;
                }

                try {
                    const dbResource = await ApiService.createResource({ resource_name: name.trim(), role: 'Profesional' });
                    
                    await ApiService.saveRates(period.trim(), [{
                        resourceName: dbResource.resource_name,
                        directRate: Number(directRate),
                        indirectRate: Number(indirectRate)
                    }]);

                    StorageService.saveProfessional({
                        id: String(dbResource.id),
                        name: dbResource.resource_name,
                        period: period.trim(),
                        directRate: Number(directRate),
                        indirectRate: Number(indirectRate)
                    });
                    
                    alert('Registro ingresado correctamente');
                    professionals = StorageService.getProfessionals();
                    render();
                } catch (err) {
                    alert('Error al guardar en el servidor: ' + err.message);
                }
            });
        }

        // Excel Import
        const btnImport = document.getElementById('btn-import-excel');
        const fileInput = document.getElementById('excel-upload');
        
        if (btnImport && fileInput) {
            btnImport.addEventListener('click', () => {
                fileInput.click();
            });

            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = function(evt) {
                    try {
                        const data = evt.target.result;
                        // Assuming XLSX is available in global scope (via index.html)
                        const workbook = XLSX.read(data, { type: 'binary' });
                        const firstSheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[firstSheetName];
                        
                        // Parse JSON
                        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                        
                        // Expecting header row to be: Nombre | Periodo | Tarifa Directa | Tarifa Indirecta
                        if (json.length > 1) {
                            const newPros = [];
                            let hasDuplicate = false;
                            // Skip header row (index 0)
                            for(let i = 1; i < json.length; i++) {
                                const row = json[i];
                                if (row && row.length >= 4 && row[0] && row[1]) {
                                    const rawName = String(row[0]).trim();
                                    const rawPeriod = String(row[1]).trim();
                                    const parsedPeriod = parsePeriodToMmmYy(rawPeriod);
                                    if (parsedPeriod) {
                                        const isDuplicateInFile = newPros.some(p => p.name === rawName && p.period === parsedPeriod);
                                        const isDuplicateInDB = professionals.some(p => p.name === rawName && p.period === parsedPeriod);
                                        
                                        if (isDuplicateInFile || isDuplicateInDB) {
                                            alert(`Fila ${i + 1}: Registro duplicado: ya existe un profesional con el mismo Nombre en ese Periodo`);
                                            hasDuplicate = true;
                                            break;
                                        }

                                        newPros.push({
                                            name: rawName,
                                            period: parsedPeriod,
                                            directRate: Number(row[2]) || 0,
                                            indirectRate: Number(row[3]) || 0
                                        });
                                    }
                                }
                            }
                            
                            if (hasDuplicate) {
                                fileInput.value = '';
                                return;
                            }
                            
                            if (newPros.length > 0) {
                                (async () => {
                                    try {
                                        const mappedPros = [];
                                        for (const pro of newPros) {
                                            const dbResource = await ApiService.createResource({ resource_name: pro.name, role: 'Profesional' });
                                            // Ideally we should have a bulk save rates or iterate over them
                                            await ApiService.saveRates(pro.period, [{
                                                resourceName: dbResource.resource_name,
                                                directRate: pro.directRate,
                                                indirectRate: pro.indirectRate
                                            }]);

                                            mappedPros.push({
                                                id: String(dbResource.id),
                                                name: dbResource.resource_name,
                                                period: pro.period,
                                                directRate: pro.directRate,
                                                indirectRate: pro.indirectRate
                                            });
                                        }
                                        StorageService.saveProfessionalsBulk(mappedPros);

                                        alert(`Registro ingresado correctamente.\nSe cargaron/actualizaron ${newPros.length} profesionales exitosamente.`);
                                        // Refresh from API ideally, but for now fallback to StorageService just in case UI expects it, or fetch from API if we refactored render
                                        professionals = StorageService.getProfessionals(); 
                                        render();
                                    } catch (apiErr) {
                                         alert('Error al guardar en base de datos: ' + apiErr.message);
                                    }
                                })();
                            } else {
                                alert('No se encontraron filas válidas en el Excel. Formato esperado: Nombre, Periodo, Tarifa Directa, Tarifa Indirecta.');
                            }
                        }
                    } catch (err) {
                        alert('Error al leer el archivo Excel: ' + err.message);
                    }
                    fileInput.value = ''; // reset file input
                };
                reader.readAsBinaryString(file);
            });
        }

        const editBtns = document.querySelectorAll('.btn-edit-pro');
        editBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('button').dataset.id;
                const pro = professionals.find(p => p.id === id);
                if(!pro) return;
                
                const newName = prompt('Nombre del profesional:', pro.name);
                if (newName === null) return;
                
                let newPeriod = prompt('Periodo (Ej: ene-25):', formatPeriod(pro.period));
                if (newPeriod === null) return;
                
                const parsedPeriod = parsePeriodToMmmYy(newPeriod);
                if (!parsedPeriod && newPeriod.trim() !== '') {
                    alert('Formato de periodo inválido. Debe ser mmm-yy (ej: ene-25).');
                    return;
                } else if (!parsedPeriod) {
                    return;
                }
                
                const newDirectRate = prompt('Tarifa Directa (CLP):', pro.directRate);
                if (newDirectRate === null || isNaN(newDirectRate) || newDirectRate.trim() === '') return;
                
                const newIndirectRate = prompt('Tarifa Indirecta (CLP):', pro.indirectRate);
                if (newIndirectRate === null || isNaN(newIndirectRate) || newIndirectRate.trim() === '') return;

                const exists = professionals.some(p => p.id !== pro.id && String(p.name).trim() === newName.trim() && p.period === parsedPeriod);
                if (exists) {
                    alert('Registro duplicado: ya existe un profesional con el mismo Nombre en ese Periodo');
                    return;
                }

                StorageService.saveProfessional({
                    ...pro,
                    name: newName.trim(),
                    period: parsedPeriod,
                    directRate: Number(newDirectRate),
                    indirectRate: Number(newIndirectRate)
                });
                
                professionals = StorageService.getProfessionals();
                render();
            });
        });

        const deleteBtns = document.querySelectorAll('.btn-delete-pro');
        deleteBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('button').dataset.id;
                if(confirm('¿Estás seguro de eliminar este profesional?')) {
                    try {
                        StorageService.deleteProfessional(id);
                        professionals = StorageService.getProfessionals();
                        render();
                    } catch(err) {
                        alert(err.message);
                    }
                }
            });
        });
    };

    render();
}
