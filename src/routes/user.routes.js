import { Router } from "express";
import {
  create,
  getById,
  list,
  listLocations,
  remove,
  update,
  updateMyLocationHandler,
  uploadAvatar,
} from "../controllers/user.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize, authorizeSelfOrRoles } from "../middlewares/authorize.js";
import { userAvatarUpload } from "../middlewares/userAvatarUpload.js";
import { validate } from "../middlewares/validate.js";
import {
  createUserSchema,
  idParamSchema,
  updateLocationSchema,
  updateUserSchema,
} from "../validators/user.validator.js";

const router = Router();

router.use(authenticate);

router.get("/", authorize("OWNER", "ADMIN"), list);

// Rutas especificas de ubicacion: deben ir antes de "/:id" para que Express no las
// confunda con el parametro dinamico (ej. GET /ubicaciones no debe matchear GET /:id).
router.patch("/me/ubicacion", validate(updateLocationSchema), updateMyLocationHandler);
router.get("/ubicaciones", authorize("OWNER", "ADMIN"), listLocations);

router.get(
  "/:id",
  validate(idParamSchema, "params"),
  authorizeSelfOrRoles("OWNER", "ADMIN"),
  getById
);

router.post("/", authorize("OWNER", "ADMIN"), validate(createUserSchema), create);

router.patch(
  "/:id",
  validate(idParamSchema, "params"),
  authorizeSelfOrRoles("OWNER", "ADMIN"),
  validate(updateUserSchema),
  update
);

router.delete(
  "/:id",
  validate(idParamSchema, "params"),
  authorize("OWNER", "ADMIN"),
  remove
);

router.post(
  "/:id/avatar",
  validate(idParamSchema, "params"),
  authorizeSelfOrRoles("OWNER", "ADMIN"),
  userAvatarUpload.single("imagen"),
  uploadAvatar
);

export default router;
