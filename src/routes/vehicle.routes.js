import { Router } from "express";
import {
  create,
  getById,
  getVelocityFleetUsage,
  list,
  listLivePositions,
  listMantenimientos,
  registerKm,
  remove,
  removeMantenimiento,
  update,
} from "../controllers/vehicle.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { validate } from "../middlewares/validate.js";
import { vehicleUpload } from "../middlewares/vehicleUpload.js";
import {
  createVehicleSchema,
  idParamSchema,
  mantenimientoIdParamSchema,
  registerKmSchema,
  updateVehicleSchema,
} from "../validators/vehicle.validator.js";

const router = Router();

const uploadVehicleFiles = vehicleUpload.fields([
  { name: "imagen", maxCount: 1 },
  { name: "libreto", maxCount: 1 },
  { name: "assicurazione", maxCount: 1 },
]);

router.use(authenticate);

// Lectura: cualquier usuario autenticado (OWNER, ADMIN o CHOFER).
router.get("/", list);
// "live-positions" no matchea el UUID de "/:id" de abajo, pero igual va antes por
// las dudas (mismo criterio que "/pending"/"/search" en record.routes.js).
router.get("/live-positions", listLivePositions);
// Monitoreo de uso/costos de Velocity Fleet: solo OWNER/ADMIN (info interna, no un
// dato operativo que necesite ver un chofer).
router.get("/velocity-fleet-usage", authorize("OWNER", "ADMIN"), getVelocityFleetUsage);
router.get("/:id", validate(idParamSchema, "params"), getById);

// Escritura: solo OWNER/ADMIN.
router.post("/", authorize("OWNER", "ADMIN"), uploadVehicleFiles, validate(createVehicleSchema), create);

router.patch(
  "/:id",
  authorize("OWNER", "ADMIN"),
  validate(idParamSchema, "params"),
  uploadVehicleFiles,
  validate(updateVehicleSchema),
  update
);

router.delete("/:id", authorize("OWNER", "ADMIN"), validate(idParamSchema, "params"), remove);

// Seccion Mecanica: registro de KM (deja historial) y su consulta.
router.get("/:id/mantenimiento", validate(idParamSchema, "params"), listMantenimientos);
router.post(
  "/:id/mantenimiento",
  authorize("OWNER", "ADMIN"),
  validate(idParamSchema, "params"),
  validate(registerKmSchema),
  registerKm
);
router.delete(
  "/:id/mantenimiento/:mantenimientoId",
  authorize("OWNER", "ADMIN"),
  validate(mantenimientoIdParamSchema, "params"),
  removeMantenimiento
);

export default router;
