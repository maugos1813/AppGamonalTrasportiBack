import { prisma } from "../config/prisma.js";

// Campos seguros para devolver en respuestas HTTP - nunca incluir password ni tokens de reset.
export const SAFE_USER_SELECT = {
  id: true,
  nombre: true,
  apellido: true,
  imagenPerfilKey: true,
  area: true,
  grupo: true,
  cargo: true,
  estado: true,
  fechaNacimiento: true,
  numeroCelular: true,
  correoElectronico: true,
  compartirUbicacion: true,
  ubicacionPermisoDenegado: true,
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

export const updateUserLocation = (id, lat, lng) =>
  prisma.user.update({
    where: { id },
    data: {
      ubicacionLat: lat,
      ubicacionLng: lng,
      ubicacionActualizada: new Date(),
      // Si llega una ubicacion nueva es porque el permiso funciona: limpia cualquier
      // aviso previo de permiso denegado sin que el chofer tenga que hacer nada.
      ubicacionPermisoDenegado: false,
      ubicacionPermisoActualizada: new Date(),
    },
    select: { id: true },
  });

export const updateUserLocationPermission = (id, denegado) =>
  prisma.user.update({
    where: { id },
    data: { ubicacionPermisoDenegado: denegado, ubicacionPermisoActualizada: new Date() },
    select: { id: true },
  });

// Solo los campos de ubicacion (no SAFE_USER_SELECT, que no los incluye a proposito
// para no filtrar coordenadas GPS en cualquier fetch de usuario): usado a demanda para
// calcular el ETA en vivo de un servicio o el regreso de un chofer libre al deposito.
export const findUserLocationById = (id) =>
  prisma.user.findUnique({
    where: { id },
    select: { id: true, ubicacionLat: true, ubicacionLng: true, ubicacionActualizada: true },
  });

// Choferes activos con una ubicacion reciente (dentro de la ventana "fresca").
export const findUsersWithFreshLocation = (sinceDate) =>
  prisma.user.findMany({
    where: {
      cargo: "CHOFER",
      estado: "ACTIVO",
      ubicacionActualizada: { gte: sinceDate },
    },
    select: {
      id: true,
      nombre: true,
      apellido: true,
      ubicacionLat: true,
      ubicacionLng: true,
      ubicacionActualizada: true,
    },
  });

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
