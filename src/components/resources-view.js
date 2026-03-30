import { ApiService } from '../services/apiService.js';
import { formatCurrency, formatPeriod, parsePeriodToMmmYy } from '../utils/format.js';
import { AuthService } from '../services/auth.js';

export async function renderResources(container) {
    let professionals = await ApiService.getAllRates();

    const render = () => {
        const user = AuthService.getCurrentUser() || {};
        const isViewer = user.role === 'Visualizador';
        
        const html = `
            <div class="projects-container">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="margin: 0; color: #111827;">Maestro de Profesionales</h2>
                    <div style="display: flex; gap: 10px;">
                        ${!isViewer ? `
                        <input type="file" id="excel-upload" accept=".xlsx, .xls" style="display: none;" />
                        <button id="btn-import-excel" class="btn-secondary">📤 Importar Excel</button>
                        <button id="btn-new-pro" class="btn-primary">+ Nuevo Profesional</button>
                        ` : ''}
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
                            </tr>
                        </thead>
                        <tbody>
                            ${professionals.map(p => {
                                const beRate = Number(p.directRate) + Number(p.indirectRate);
                                return `
                                    <tr style="border-bottom: 1px solid #e5e7eb;">
                                        <td style="padding: 12px;">${p.name}</td>
                                        <td style="padding: 12px;">${formatPeriod(p.period)}</td>
                                        <td style="padding: 12px; text-align: right;">${formatCurrency(p.directRate)}</td>
                                        <td style="padding: 12px; text-align: right;">${formatCurrency(p.indirectRate)}</td>
                                        <td style="padding: 12px; text-align: right;"><strong>${formatCurrency(beRate)}</strong></td>
                                    </tr>
                                `;
                            }).join('')}
                            ${professionals.length === 0 ? '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #6b7280;">No hay profesionales registrados. Use "Nuevo Profesional" o "Importar Excel".</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        container.innerHTML = html;
        attachEvents();
    };

    const attachEvents = () => {
        // Manual Add
        const btnNew = document.getElementById('btn-new-pro');
        if (btnNew) {
            btnNew.addEventListener('click', () => {
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

                ApiService.saveProfessional({
                    name: name.trim(),
                    period: period.trim(),
                    directRate: Number(directRate),
                    indirectRate: Number(indirectRate)
                }).then(() => {
                    ApiService.getAllRates().then(p => {
                        professionals = p;
                        render();
                    });
                }).catch(err => alert("Error al crear tarifa: " + err.message));
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
                            // Skip header row (index 0)
                            for(let i = 1; i < json.length; i++) {
                                const row = json[i];
                                if (row && row.length >= 4 && row[0] && row[1]) {
                                    const rawPeriod = String(row[1]).trim();
                                    const parsedPeriod = parsePeriodToMmmYy(rawPeriod);
                                    if (parsedPeriod) {
                                        newPros.push({
                                            name: String(row[0]).trim(),
                                            period: parsedPeriod,
                                            directRate: Number(row[2]) || 0,
                                            indirectRate: Number(row[3]) || 0
                                        });
                                    }
                                }
                            }
                            
                            if (newPros.length > 0) {
                                ApiService.saveProfessionalsBulk(newPros).then(() => {
                                    alert(`Se cargaron/actualizaron ${newPros.length} profesionales exitosamente.`);
                                    ApiService.getAllRates().then(p => {
                                        professionals = p;
                                        render();
                                    });
                                }).catch(err => alert("Error en bulk: " + err.message));
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
    };

    render();
}
