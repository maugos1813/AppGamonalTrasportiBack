import { Router } from "express";
import {
  create,
  getById,
  list,
  listByDay,
  listByMonth,
  listByYear,
  remove,
  update,
} from "../controllers/record.controller.js";
import { create as createFile, list as listFiles } from "../controllers/recordFile.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { upload } from "../middlewares/upload.js";
import { validate } from "../middlewares/validate.js";
import {
  createRecordSchema,
  idParamSchema,
  updateRecordSchema,
  yearMonthDayParamSchema,
  yearMonthParamSchema,
  yearParamSchema,
} from "../validators/record.validator.js";
import { createRecordFileSchema } from "../validators/recordFile.validator.js";

const router = Router();

router.use(authenticate);

router.get("/", list);

// Rutas con constraint numerico: deben registrarse antes de "/:id" para no chocar con el UUID.
router.get(
  "/:year(\\d{4})/:month(\\d{1,2})/:day(\\d{1,2})",
  validate(yearMonthDayParamSchema, "params"),
  listByDay
);
router.get("/:year(\\d{4})/:month(\\d{1,2})", validate(yearMonthParamSchema, "params"), listByMonth);
router.get("/:year(\\d{4})", validate(yearParamSchema, "params"), listByYear);

router.post("/", authorize("OWNER", "ADMIN"), validate(createRecordSchema), create);

router.get("/:id", validate(idParamSchema, "params"), getById);

router.patch("/:id", validate(idParamSchema, "params"), validate(updateRecordSchema), update);

router.delete("/:id", authorize("OWNER", "ADMIN"), validate(idParamSchema, "params"), remove);

// Archivos anidados del record.
router.post(
  "/:id/files",
  validate(idParamSchema, "params"),
  upload.single("archivo"),
  validate(createRecordFileSchema),
  createFile
);
router.get("/:id/files", validate(idParamSchema, "params"), listFiles);

export default router;
