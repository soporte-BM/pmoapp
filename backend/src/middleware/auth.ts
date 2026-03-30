import { Request, Response, NextFunction } from "express";

export type UserRole = "Admin" | "PMO" | "Director" | "Consulta";

export interface AuthRequest extends Request {
    user?: {
        name?: string;
        role?: UserRole;
    };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
    // Simulación por headers (para desarrollo)
    const simulatedRole = req.headers["x-user-role"] as string | undefined;
    const simulatedUser = req.headers["x-user-name"] as string | undefined;

    req.user = {
        name: simulatedUser ?? "dev-user",
        role: (simulatedRole as UserRole) ?? "Admin",
    };

    next();
}


/**
 * Middleware para exigir rol (o alguno de varios roles).
 * Uso: requireRole("Admin") o requireRole("PMO","Admin")
 */
export function requireRole(...allowed: UserRole[]) {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        const role = req.user?.role;

        if (!role) {
            return res.status(401).json({ error: "Unauthorized: missing role" });
        }

        if (!allowed.includes(role)) {
            return res.status(403).json({ error: "Forbidden: insufficient role", role, allowed });
        }

        next();
    };
}
