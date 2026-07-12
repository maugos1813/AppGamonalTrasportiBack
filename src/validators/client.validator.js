import { z } from "zod";

export const createClientSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
});

export const updateClientSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
});

export const idParamSchema = z.object({
  id: z.string().uuid("Id invalido"),
});
