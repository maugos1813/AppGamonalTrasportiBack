import { Router } from "express";
import {
  create,
  getById,
  getLiveEta,
  list,
  listByDay,
  listByMonth,
  listPending,
  listSummaryByMonth,
  listByYear,
  remove,
  search,
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

// "pending"/"search" no matchean el constraint numerico de las rutas de abajo, pero
// igual deben registrarse antes de "/:id" (mas abajo) para no chocar con el UUID.
router.get("/pending", listPending);
router.get("/search", search);

// Rutas con constraint numerico: deben registrarse antes de "/:id" para no chocar con el UUID.
router.get(
  "/:year(\\d{4})/:month(\\d{1,2})/:day(\\d{1,2})",
  validate(yearMonthDayParamSchema, "params"),
  listByDay
);
// Resumen liviano (solo id/fechaServicio/estado) para armar el acordeon de dias sin
// traer stops/ruta/economico de cada registro. "summary" no matchea el regex de :day.
router.get(
  "/:year(\\d{4})/:month(\\d{1,2})/summary",
  validate(yearMonthParamSchema, "params"),
  listSummaryByMonth
);
router.get("/:year(\\d{4})/:month(\\d{1,2})", validate(yearMonthParamSchema, "params"), listByMonth);
router.get("/:year(\\d{4})", validate(yearParamSchema, "params"), listByYear);

router.post("/", authorize("OWNER", "ADMIN"), validate(createRecordSchema), create);

router.get("/:id", validate(idParamSchema, "params"), getById);

// A demanda desde el mapa (solo el servicio abierto/seleccionado, no todos en cada poll).
router.get(
  "/:id/eta-en-vivo",
  authorize("OWNER", "ADMIN"),
  validate(idParamSchema, "params"),
  getLiveEta
);

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
