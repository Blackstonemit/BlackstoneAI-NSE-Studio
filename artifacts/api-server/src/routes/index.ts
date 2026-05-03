import { Router, type IRouter } from "express";
import healthRouter from "./health";
import marketRouter from "./market";
import analysisRouter from "./analysis";
import signalsRouter from "./signals";
import watchlistRouter from "./watchlist";
import agentRouter from "./agent";
import schedulerRouter from "./scheduler";

const router: IRouter = Router();

router.use(healthRouter);
router.use(marketRouter);
router.use(analysisRouter);
router.use(signalsRouter);
router.use(watchlistRouter);
router.use(agentRouter);
router.use(schedulerRouter);

export default router;
