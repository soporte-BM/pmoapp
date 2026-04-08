// Servicio de autenticación simple (Mock)

const AUTH_KEY = 'pmo_auth_user_v1';
const USERS_KEY = 'pmo_users_v1';

const MOCK_USERS = [
    {
        email: 'admin@pmo.com',
        password: 'admin',
        name: 'Admin',
        role: 'Administrador'
    },
    {
        email: 'user@pmo.com',
        password: 'user',
        name: 'Analista PMO',
        role: 'Analista'
    }
];

export const AuthService = {
    init: () => {
        if (!sessionStorage.getItem(USERS_KEY)) {
            sessionStorage.setItem(USERS_KEY, JSON.stringify(MOCK_USERS));
        }
    },

    login: (email, password) => {
        const users = JSON.parse(sessionStorage.getItem(USERS_KEY)) || [];
        const user = users.find(u => u.email === email && u.password === password);
        
        if (user) {
            // Guardamos todo menos la contraseña
            const { password: _, ...userWithoutPass } = user;
            sessionStorage.setItem(AUTH_KEY, JSON.stringify(userWithoutPass));
            return userWithoutPass;
        }
        throw new Error('Credenciales incorrectas');
    },

    logout: () => {
        sessionStorage.removeItem(AUTH_KEY);
    },

    getCurrentUser: () => {
        const userStr = sessionStorage.getItem(AUTH_KEY);
        return userStr ? JSON.parse(userStr) : null;
    },

    recoverPassword: (email) => {
        const users = JSON.parse(sessionStorage.getItem(USERS_KEY)) || [];
        const exists = users.some(u => u.email === email);
        
        if (exists) {
            // Simulación de envío de correo
            return Promise.resolve(true);
        }
        return Promise.reject(new Error('El correo ingresado no está registrado'));
    }
};
