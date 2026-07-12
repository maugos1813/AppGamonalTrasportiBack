import { prisma } from "../config/prisma.js";

// Campos seguros para devolver en respuestas HTTP - nunca incluir password ni tokens de reset.
export const SAFE_USER_SELECT = {
  id: true,
  nombre: true,
  apellido: true,
  imagenPerfilKey: true,
  area: true,
  cargo: true,
  estado: true,
  fechaNacimiento: true,
  numeroCelular: true,
  correoElectronico: true,
  createdAt: true,
  updatedAt: true,
};

const normalizeEmail = (email) => email.trim().toLowerCase();

export const findAllUsers = () =>
  prisma.user.findMany({
    select: SAFE_USER_SELECT,
    orderBy: { createdAt: "desc" },
  });

export const findUserById = (id) =>
  prisma.user.findUnique({ where: { id }, select: SAFE_USER_SELECT });

// Incluye password: solo para uso interno en auth.service (login).
export const findUserByEmailWithPassword = (correoElectronico) =>
  prisma.user.findUnique({ where: { correoElectronico: normalizeEmail(correoElectronico) } });

export const findUserByEmail = (correoElectronico) =>
  prisma.user.findUnique({
    where: { correoElectronico: normalizeEmail(correoElectronico) },
    select: SAFE_USER_SELECT,
  });

export const createUser = (data) =>
  prisma.user.create({
    data: { ...data, correoElectronico: normalizeEmail(data.correoElectronico) },
    select: SAFE_USER_SELECT,
  });

export const updateUserById = (id, data) => {
  const payload = { ...data };
  if (payload.correoElectronico) {
    payload.correoElectronico = normalizeEmail(payload.correoElectronico);
  }
  return prisma.user.update({
    where: { id },
    data: payload,
    select: SAFE_USER_SELECT,
  });
};

export const deleteUserById = (id) => prisma.user.delete({ where: { id } });

export const setResetToken = (id, hashedToken, expiresAt) =>
  prisma.user.update({
    where: { id },
    data: { resetPasswordToken: hashedToken, resetPasswordExpires: expiresAt },
  });

export const findUserByValidResetToken = (hashedToken) =>
  prisma.user.findFirst({
    where: {
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { gt: new Date() },
    },
  });

export const resetPasswordAndClearToken = (id, hashedPassword) =>
  prisma.user.update({
    where: { id },
    data: {
      password: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpires: null,
    },
    select: SAFE_USER_SELECT,
  });
