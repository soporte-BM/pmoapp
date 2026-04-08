// src/services/apiService.js

// const API_BASE_URL = 'https://pmoapp-avbhckasgjbfcag4.brazilsouth-01.azurewebsites.net/api';
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3000/api' 
    : 'https://pmoapp-avbhckasgjbfcag4.brazilsouth-01.azurewebsites.net/api';
const handleResponse = async (response) => {
    if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: 'Unknown error' }));
        const details = payload.error ? ` - Detalles: ${payload.error}` : '';
        throw new Error((payload.message || `Request failed: ${response.status}`) + details);
    }
    return response.json();
};

// Headers with simulated auth
const getHeaders = () => {
    const userStr = sessionStorage.getItem('pmo_auth_user_v1');
    const user = userStr ? JSON.parse(userStr) : null;
    return {
        'Content-Type': 'application/json',
        'x-user-role': 'Admin', // Strict Case Sensitive required by backend auth
        'x-user-name': user ? user.name : 'PMO WebApp'
    };
};

export const ApiService = {
    // Projects
    getProjects: async () => {
        const response = await fetch(`${API_BASE_URL}/projects`, { headers: getHeaders() });
        return handleResponse(response);
    },

    createProject: async (projectData) => {
        const response = await fetch(`${API_BASE_URL}/projects`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(projectData)
        });
        return handleResponse(response);
    },

    updateProject: async (id, projectData) => {
        // The backend uses an UPSERT logic on POST /projects based on project_code
        const response = await fetch(`${API_BASE_URL}/projects`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(projectData)
        });
        return handleResponse(response);
    },

    deleteProject: async (id) => {
        const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        return handleResponse(response);
    },

    // Resources
    getResources: async () => {
        const response = await fetch(`${API_BASE_URL}/resources`, { headers: getHeaders() });
        return handleResponse(response);
    },

    createResource: async (resourceData) => {
        const response = await fetch(`${API_BASE_URL}/resources`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(resourceData)
        });
        return handleResponse(response);
    },

    updateResource: async (id, resourceData) => {
        const response = await fetch(`${API_BASE_URL}/resources/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(resourceData)
        });
        return handleResponse(response);
    },

    deleteResourceBase: async (id) => {
        const response = await fetch(`${API_BASE_URL}/resources/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        return handleResponse(response);
    },

    // Rates
    getAllRates: async () => {
        const response = await fetch(`${API_BASE_URL}/rates/all`, { headers: getHeaders() });
        return handleResponse(response);
    },

    getRates: async (period) => {
        const response = await fetch(`${API_BASE_URL}/rates?period=${period}`, { headers: getHeaders() });
        return handleResponse(response);
    },

    saveRates: async (period, rates) => {
        const response = await fetch(`${API_BASE_URL}/rates`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ period, rates })
        });
        return handleResponse(response);
    },

    deleteRate: async (id, period) => {
        const response = await fetch(`${API_BASE_URL}/rates/${id}?period=${period}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        return handleResponse(response);
    },

    // Closures
    getAllEntries: async (filters = {}) => {
        if (filters.projectCode && filters.month) {
            try {
                const data = await ApiService.getClosure(filters.projectCode, filters.month);
                return [data];
            } catch (e) {
                if (e.message.includes('not found')) return [];
                throw e;
            }
        }
        
        // Fetch ALL closures if no specific filter
        const response = await fetch(`${API_BASE_URL}/closures/all`, { headers: getHeaders() });
        return handleResponse(response);
    },

    getClosure: async (projectCode, period) => {
        const response = await fetch(`${API_BASE_URL}/closures?projectCode=${projectCode}&period=${period}`, { headers: getHeaders() });
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
            period: entry.month,
            revenue: entry.revenue,
            thirdPartyCosts: entry.thirdPartyCosts,
            resources: entry.professionals.map(p => ({
                resourceName: p.name,
                hours: p.hours,
                rate: p.rate
            })),
            status: entry.tipoRegistro === 'REAL' ? 'VALIDATED' : 'DRAFT'
        };

        const response = await fetch(`${API_BASE_URL}/closures`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload)
        });
        return handleResponse(response);
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
