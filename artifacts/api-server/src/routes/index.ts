import { Router, type IRouter } from "express";
import healthRouter from "./health";
import marketRouter from "./market";
import analysisRouter from "./analysis";
import signalsRouter from "./signals";
import watchlistRouter from "./watchlist";
import alertsRouter from "./alerts";
import screenerRouter from "./screener";
import agentRouter from "./agent";
import schedulerRouter from "./scheduler";
import aiProvidersRouter from "./ai-providers";

const router: IRouter = Router();

router.use(healthRouter);
router.use(marketRouter);
router.use(analysisRouter);
router.use(signalsRouter);
router.use(watchlistRouter);
router.use(alertsRouter);
router.use(screenerRouter);
router.use(agentRouter);
router.use(schedulerRouter);
router.use(aiProvidersRouter);

export default router;
