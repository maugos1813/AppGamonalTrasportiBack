import { Router } from "express";
import { getAppsheetSyncStatus, syncAppsheetRegistros } from "../controllers/sync.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";

const router = Router();

router.use(authenticate);
router.use(authorize("OWNER", "ADMIN"));

router.get("/appsheet", getAppsheetSyncStatus);
router.post("/appsheet", syncAppsheetRegistros);

export default router;
