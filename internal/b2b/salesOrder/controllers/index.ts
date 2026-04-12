import { Router } from "express";
import salesOrderFactoryRouter from "./salesOrderFactory";

const router = Router();

router.use(salesOrderFactoryRouter);

export default router;
