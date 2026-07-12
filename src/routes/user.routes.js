import { Router } from "express";
import { create, getById, list, remove, update, uploadAvatar } from "../controllers/user.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize, authorizeSelfOrRoles } from "../middlewares/authorize.js";
import { userAvatarUpload } from "../middlewares/userAvatarUpload.js";
import { validate } from "../middlewares/validate.js";
import { createUserSchema, idParamSchema, updateUserSchema } from "../validators/user.validator.js";

const router = Router();

router.use(authenticate);

router.get("/", authorize("OWNER", "ADMIN"), list);

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
