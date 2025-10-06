import { Request, Response, NextFunction } from "express";
import { JwtPayload } from "jsonwebtoken";
import { AuthenticatedRequest } from "./auth";

export const validateBody = (req: Request, res: Response, next: NextFunction) => {
    const { to, userName, planName, expiryDate } = req.body;
    if (!to || !userName || !planName || !expiryDate) {
        return res.status(400).json({ message: "Missing required fields" });
    }
    next();
};

export const requireMailServiceAccess = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const payload = req.user as JwtPayload | undefined;
    if (!payload) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    if (payload.hasAccessToSendMails !== true) {
      return res.status(403).json({ message: "User does not have necessary permissions" });
    }
    
    next();
  }