import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth";

const ALLOWED_MAIL_ROLES = ["MANAGER", "SUPERADMIN"] as const;

export const requireMailServiceAccess = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const role = user.role;
  if (
    !role ||
    !ALLOWED_MAIL_ROLES.includes(role as (typeof ALLOWED_MAIL_ROLES)[number])
  ) {
    return res
      .status(403)
      .json({ message: "User does not have necessary permissions" });
  }

  next();
};

export const requireSuperadmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (req.user.role !== "SUPERADMIN") {
    return res
      .status(403)
      .json({ message: "User does not have necessary permissions" });
  }

  next();
};
