import { Router, type IRouter } from "express";
import healthRouter from "./health";
import maternaRouter from "./materna";

const router: IRouter = Router();

router.use(healthRouter);
router.use(maternaRouter);

export default router;
