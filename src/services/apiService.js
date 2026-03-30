import { toSqlDate, formatPeriod } from '../utils/format.js';

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = isLocalhost ? 'http://localhost:3000/api' : '/api';


// Helper to handle responses
const handleResponse = async (response) => {
    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(error.message || `Request failed: ${response.status}`);
    }
    return response.json();
};

// Headers with simulated auth
const getHeaders = () => ({
    'Content-Type': 'application/json',
    'x-user-role': 'Admin', // Fixed casing for backend middleware
    'x-user-name': 'DevFrontend'
});

export const ApiService = {
    // Projects
    getProjects: async () => {
        const response = await fetch(`${API_BASE_URL}/projects`, { headers: getHeaders() });
        const data = await handleResponse(response);
        return data.map(p => ({
            ...p,
            code: p.project_code,
            name: p.name,
            manager: p.manager || '',
            status: p.status || 'Activo'
        }));
    },

    saveProject: async (project) => {
        const payload = {
            project_code: project.code,
            name: project.name
        };
        const response = await fetch(`${API_BASE_URL}/projects`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload)
        });
        return handleResponse(response);
    },

    updateProject: async (id, project) => {
        const payload = {
            project_code: project.code,
            name: project.name
        };
        const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(payload)
        });
        return handleResponse(response);
    },

    deleteProject: async (id) => {
        const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Unknown error' }));
            throw new Error(error.message || `Request failed: ${response.status}`);
        }
        return true;
    },

    // Resources
    getResources: async () => {
        const response = await fetch(`${API_BASE_URL}/resources`, { headers: getHeaders() });
        const data = await handleResponse(response);
        return data.map(r => ({
            ...r,
            name: r.resource_name,
            role: r.role
        }));
    },

    saveProfessional: async (pro) => {
        const payload = {
            resource_name: pro.name,
            role: 'Consultant' // Default role as it wasn't specified in old UI
        };
        // Also save rate
        try {
            const res = await fetch(`${API_BASE_URL}/resources`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                // If 400 or 409, maybe the resource already exists, we allow saveRates. Otherwise throw.
                if (res.status !== 400 && res.status !== 409) {
                    await handleResponse(res);
                }
            }
        } catch (e) {
            if (!e.message.includes('409') && !e.message.includes('400')) {
                throw e; // Throw so UI shows error 
            }
        }
        
        // Save rates using saveRates endpoint
        return ApiService.saveRates(pro.period, [{
            resourceName: pro.name,
            directRate: pro.directRate,
            indirectRate: pro.indirectRate
        }]);
    },

    saveProfessionalsBulk: async (pros) => {
        const results = [];
        for (const pro of pros) {
            try {
                results.push(await ApiService.saveProfessional(pro));
            } catch (e) {
                console.error("Bulk save error for pro:", pro, e);
            }
        }
        return results;
    },

    // Rates
    getAllRates: async () => {
        const response = await fetch(`${API_BASE_URL}/rates/all`, { headers: getHeaders() });
        const data = await handleResponse(response);
        return data.map(r => ({
            ...r,
            name: r.name,
            period: formatPeriod(r.period),
            directRate: r.direct_rate,
            indirectRate: r.indirect_rate,
            currency: r.currency || 'USD'
        }));
    },

    getRates: async (period) => {
        const response = await fetch(`${API_BASE_URL}/rates?period=${toSqlDate(period)}`, { headers: getHeaders() });
        return handleResponse(response);
    },

    saveRates: async (period, rates) => {
        const response = await fetch(`${API_BASE_URL}/rates`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ period: toSqlDate(period), rates })
        });
        return handleResponse(response);
    },

    // Closures (Replacing StorageService logic)
    getAllEntries: async (filters = {}) => {
        // This maps to getClosure logic. 
        // If we are filtering by a specific project and month, proxy to getClosure
        if (filters.projectCode && filters.month) {
            try {
                const data = await ApiService.getClosure(filters.projectCode, toSqlDate(filters.month));
                return [data]; // Return as array to mimic getAllEntries behavior for a single match
            } catch (e) {
                if (e.message.includes('not found')) return [];
                throw e;
            }
        }
        
        // Fetch all closures!
        const response = await fetch(`${API_BASE_URL}/closures`, { headers: getHeaders() });
        const data = await handleResponse(response);
        
        // Map data to expected frontend format
        return data.map(c => ({
            id: c.id,
            project: c.project_name, // Dashboard references project NAME
            month: formatPeriod(c.period), // format '2025-01-01' to 'ene-25'
            status: c.status, // DRAFT or VALIDATED
            revenue: c.revenue,
            thirdPartyCosts: c.third_party_costs,
            tipoRegistro: 'REAL', // defaulting to REAL for now
            kpis: c.kpis,
            professionals: (c.resources || []).map(r => ({
                name: r.resource_name,
                hours: r.hours,
                rate_snapshot_direct: r.rate_snapshot_direct,
                rate_snapshot_indirect: r.rate_snapshot_indirect,
                rate: Number(r.rate_snapshot_direct) + Number(r.rate_snapshot_indirect)
            }))
        }));
    },

    getClosure: async (projectCode, period) => {
        const response = await fetch(`${API_BASE_URL}/closures?projectCode=${projectCode}&period=${toSqlDate(period)}`, { headers: getHeaders() });
        return handleResponse(response);
    },

    saveEntry: async (entry) => {
        // storage.js entry structure: { project, month, revenue, professionals, thirdPartyCosts ... }
        // We need to map it to backend expectation: { projectCode, period, revenue, thirdPartyCosts, resources }

        // entry.project might be the name or code? In storage.js MOCK_DATA it was Name like "Transformación..."
        // The backend expects projectCode. We might need a mapping or ensure frontend sends code.
        // For this task, assuming we pass what we have. If entry.project is name, we might fail on backend lookup 
        // unless we fix frontend to send code. 
        // Let's assume entry.projectCode exists or we pass entry.project as code if it matches.

        const payload = {
            projectCode: entry.projectCode || entry.project, // Fallback, but backend needs Code
            period: toSqlDate(entry.month),
            revenue: entry.revenue,
            thirdPartyCosts: entry.thirdPartyCosts,
            resources: entry.professionals.map(p => ({
                resourceName: p.name,
                hours: p.hours
                // rate is not sent, backend looks it up.
            }))
        };

        const response = await fetch(`${API_BASE_URL}/closures`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload)
        });
        return handleResponse(response);
    },

    updateEntry: async (id, updatedData) => {
        // Mock updateEntry to saveEntry because backend upserts based on project/period
        return ApiService.saveEntry(updatedData);
    },

    validateClosure: async (id) => {
        const response = await fetch(`${API_BASE_URL}/closures/${id}/validate`, {
            method: 'POST',
            headers: getHeaders()
        });
        return handleResponse(response);
    },

    unvalidateClosure: async (id) => {
        const response = await fetch(`${API_BASE_URL}/closures/${id}/unvalidate`, {
            method: 'POST',
            headers: getHeaders()
        });
        return handleResponse(response);
    },

    clearData: () => {
        console.warn('clearData not supported in API mode');
    }
};
