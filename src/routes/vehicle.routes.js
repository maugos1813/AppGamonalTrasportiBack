import { Router } from "express";
import { create, getById, list, remove, update } from "../controllers/vehicle.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { validate } from "../middlewares/validate.js";
import { vehicleUpload } from "../middlewares/vehicleUpload.js";
import { createVehicleSchema, idParamSchema, updateVehicleSchema } from "../validators/vehicle.validator.js";

const router = Router();

const uploadVehicleFiles = vehicleUpload.fields([
  { name: "imagen", maxCount: 1 },
  { name: "libreto", maxCount: 1 },
  { name: "assicurazione", maxCount: 1 },
]);

router.use(authenticate);

// Lectura: cualquier usuario autenticado (OWNER, ADMIN o CHOFER).
router.get("/", list);
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

export default router;
