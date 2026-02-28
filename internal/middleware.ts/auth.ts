import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { config } from "../../config/config";

export interface AuthenticatedRequest extends Request {
  user?: any;
}

export const requireAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid token" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Missing token" });
  }

  try {
    const secret = config.JWT_SECRET;
    
    if (!secret) {
      return res.status(500).json({ message: "Server misconfiguration: missing JWT secret" });
    }
    
    const decoded = jwt.verify(token, secret);
    
    if (typeof decoded === "string") {
      return res.status(403).json({ message: "Invalid token payload" });
    }
    
    const payload = decoded as JwtPayload;
    
    req.user = payload;
    next();
  } catch (error) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};


