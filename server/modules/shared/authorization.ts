import type { Request, Response, NextFunction } from "express";

export function requireRole(allowedRoles: string[]) {
  return async (req: Request & { user?: { role?: string } }, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!req.user.role || !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      next();
    } catch (error) {
      res.status(500).json({ message: "Authorization error" });
    }
  };
}
