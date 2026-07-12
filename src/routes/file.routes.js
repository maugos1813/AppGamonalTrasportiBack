import { Router } from "express";
import { remove } from "../controllers/recordFile.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { validate } from "../middlewares/validate.js";
import { fileIdParamSchema } from "../validators/recordFile.validator.js";

const router = Router();

router.use(authenticate);

router.delete("/:id", authorize("OWNER", "ADMIN"), validate(fileIdParamSchema, "params"), remove);

export default router;
