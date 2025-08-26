import { Request, Response, NextFunction } from "express";

export const validateBody = (req: Request, res: Response, next: NextFunction) => {
    const { to, userName, planName, expiryDate } = req.body;
    if (!to || !userName || !planName || !expiryDate) {
        return res.status(400).json({ message: "Missing required fields" });
    }
    next();
};