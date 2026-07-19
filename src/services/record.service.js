import {
  createRecord as createRecordModel,
  deleteRecordById,
  findRecordById,
  findRecords,
  findRecordsSummary,
  updateRecordById,
} from "../models/record.model.js";
import { findUserById, findUserLocationById } from "../models/user.model.js";
import { purgeFilesForRecord } from "./recordFile.service.js";
import { geocodeStops } from "./geocoding.service.js";
import { calculateRoute } from "./routing.service.js";
import { LOCATION_FRESH_MINUTES } from "./user.service.js";
import { DEPOT_ORIGIN } from "../constants/depot.js";
import { AppError } from "../utils/AppError.js";

const isPrivileged = (actor) => actor.cargo === "OWNER" || actor.cargo === "ADMIN";

const assertAccess = (actor, record) => {
  if (isPrivileged(actor) || record.driverId === actor.id) return;
  throw new AppError("No tienes permisos para realizar esta accion", 403);
};

const assertDriverActivo = async (driverId) => {
  const driver = await findUserById(driverId);
  if (!driver || driver.estado !== "ACTIVO") {
    throw new AppError("El conductor indicado no existe o esta inactivo", 400);
  }
};

// Campos operativos que un CHOFER puede editar en su propio record; el resto (economico,
// relaciones, etc.) se ignora si viene de un CHOFER, igual que SELF_EDITABLE_FIELDS en user.service.js.
const SELF_EDITABLE_FIELDS = [
  "horasDia",
  "horasNoche",
  "tiempoEspera",
  "estado",
  "comentarios",
  "kilometrosReales",
];

// Geocodifica las paradas (en orden) y calcula la ruta deposito -> paradas. Devuelve
// el payload listo para mezclar en la data que se manda a Prisma.
const buildStopsPipeline = async (direcciones) => {
  const stopsGeocoded = await geocodeStops(direcciones);
  const ruta = await calculateRoute([DEPOT_ORIGIN, ...stopsGeocoded]);

  return {
    stopsCreate: stopsGeocoded.map((s, i) => ({
      orden: i,
      direccion: s.direccion,
      lat: s.lat,
      lng: s.lng,
      geocodedAt: new Date(),
    })),
    destinazione: stopsGeocoded[stopsGeocoded.length - 1].direccion,
    rutaDistanciaKm: ruta?.distanciaKm ?? null,
    rutaDuracionMin: ruta?.duracionMin ?? null,
    rutaGeometria: ruta?.geometria ?? null,
    rutaCalculadaAt: ruta ? new Date() : null,
  };
};

const stopsUnchanged = (existingStops, direcciones) =>
  existingStops.length === direcciones.length &&
  existingStops.every(
    (stop, i) => stop.direccion.trim().toLowerCase() === direcciones[i].trim().toLowerCase()
  );

const computeTotals = (record) => {
  const kilometros = record.kilometros ?? 0;
  const precioKm = record.precioKm ?? 0;
  const totalKm = kilometros * precioKm;

  // costoCombustible y pagoRecibido quedan fuera del total a proposito.
  const total =
    totalKm +
    (record.areaC ?? 0) +
    (record.costoEspera ?? 0) +
    (record.costoTraforoFrejusBrennero ?? 0) +
    (record.peajes ?? 0) +
    (record.vignetta ?? 0) +
    (record.costoHotel ?? 0);

  return { totalKm, total };
};

// Diferencia entre lo que reporto el chofer y lo que se planifico, para que
// OWNER/ADMIN puedan detectar desvios. null si todavia no hay dato real cargado.
const computeKmDiff = (record) =>
  record.kilometrosReales != null && record.kilometros != null
    ? record.kilometrosReales - record.kilometros
    : null;

const toFullResponse = (record) => {
  const { totalKm, total } = computeTotals(record);
  return {
    id: record.id,
    estado: record.estado,
    driver: record.driver,
    vehicle: record.vehicle,
    client: record.client,
    fechaServicio: record.fechaServicio,
    eta: record.eta,
    descripcion: record.descripcion,
    codigo: record.codigo,
    destinazione: record.destinazione,
    ciudad: record.ciudad,
    aplicativo: record.aplicativo,
    spedizzione: record.spedizzione,
    extrasPiazzaZona: record.extrasPiazzaZona,
    origen: DEPOT_ORIGIN,
    stops: record.stops.map(({ id, orden, direccion, lat, lng }) => ({ id, orden, direccion, lat, lng })),
    ruta: {
      distanciaKm: record.rutaDistanciaKm,
      duracionMin: record.rutaDuracionMin,
      geometria: record.rutaGeometria,
    },
    horasDia: record.horasDia,
    horasNoche: record.horasNoche,
    tiempoEspera: record.tiempoEspera,
    comentarios: record.comentarios,
    kilometros: record.kilometros,
    kilometrosReales: record.kilometrosReales,
    diferenciaKm: computeKmDiff(record),
    precioKm: record.precioKm,
    totalKm,
    areaC: record.areaC,
    costoEspera: record.costoEspera,
    costoTraforoFrejusBrennero: record.costoTraforoFrejusBrennero,
    peajes: record.peajes,
    vignetta: record.vignetta,
    costoHotel: record.costoHotel,
    pagoRecibido: record.pagoRecibido,
    costoCombustible: record.costoCombustible,
    clienteConfirmado: record.clienteConfirmado,
    total,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
};

// Vista para CHOFER: sin campos economicos, salvo "kilometros" (solo lectura, lo que se
// planifico) y "kilometrosReales" (lo que el propio chofer carga) para que pueda compararlos.
const toChoferResponse = (record) => ({
  id: record.id,
  estado: record.estado,
  driver: record.driver,
  vehicle: record.vehicle,
  client: record.client,
  fechaServicio: record.fechaServicio,
  eta: record.eta,
  descripcion: record.descripcion,
  codigo: record.codigo,
  destinazione: record.destinazione,
  ciudad: record.ciudad,
  aplicativo: record.aplicativo,
  spedizzione: record.spedizzione,
  extrasPiazzaZona: record.extrasPiazzaZona,
  origen: DEPOT_ORIGIN,
  stops: record.stops.map(({ id, orden, direccion, lat, lng }) => ({ id, orden, direccion, lat, lng })),
  ruta: {
    distanciaKm: record.rutaDistanciaKm,
    duracionMin: record.rutaDuracionMin,
    geometria: record.rutaGeometria,
  },
  horasDia: record.horasDia,
  horasNoche: record.horasNoche,
  tiempoEspera: record.tiempoEspera,
  comentarios: record.comentarios,
  kilometros: record.kilometros,
  kilometrosReales: record.kilometrosReales,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

const toResponse = (record, actor) => (isPrivileged(actor) ? toFullResponse(record) : toChoferResponse(record));

export const createRecord = async (data) => {
  await assertDriverActivo(data.driverId);

  const { stops: direcciones, ...rest } = data;
  const { stopsCreate, destinazione, rutaDistanciaKm, rutaDuracionMin, rutaGeometria, rutaCalculadaAt } =
    await buildStopsPipeline(direcciones);

  const record = await createRecordModel({
    ...rest,
    destinazione,
    rutaDistanciaKm,
    rutaDuracionMin,
    rutaGeometria,
    rutaCalculadaAt,
    stops: { create: stopsCreate },
    estado: data.estado ?? "IN_SOSPESO",
    clienteConfirmado: data.clienteConfirmado ?? false,
  });

  return toFullResponse(record);
};

export const listRecordsForActor = async (actor, dateRange) => {
  const driverId = isPrivileged(actor) ? undefined : actor.id;
  const records = await findRecords({ driverId, dateRange });
  return records.map((record) => toResponse(record, actor));
};

// Version liviana (id/fechaServicio/estado) para armar el acordeon de dias del
// mes sin traer stops/ruta/economico de cada registro. No hay datos sensibles
// aca, asi que no hace falta distinguir toFullResponse/toChoferResponse.
export const listRecordsSummaryForActor = async (actor, dateRange) => {
  const driverId = isPrivileged(actor) ? undefined : actor.id;
  return findRecordsSummary({ driverId, dateRange });
};

export const getRecordByIdForActor = async (actor, id) => {
  const record = await findRecordById(id);
  if (!record) {
    throw new AppError("Registro no encontrado", 404);
  }
  assertAccess(actor, record);
  return toResponse(record, actor);
};

export const updateRecordForActor = async (actor, id, data) => {
  const record = await findRecordById(id);
  if (!record) {
    throw new AppError("Registro no encontrado", 404);
  }
  assertAccess(actor, record);

  let payload = data;

  if (isPrivileged(actor)) {
    if (payload.driverId) {
      await assertDriverActivo(payload.driverId);
    }

    if (payload.stops) {
      const { stops: direcciones, ...rest } = payload;
      if (stopsUnchanged(record.stops, direcciones)) {
        payload = rest;
      } else {
        const { stopsCreate, destinazione, rutaDistanciaKm, rutaDuracionMin, rutaGeometria, rutaCalculadaAt } =
          await buildStopsPipeline(direcciones);
        payload = {
          ...rest,
          destinazione,
          rutaDistanciaKm,
          rutaDuracionMin,
          rutaGeometria,
          rutaCalculadaAt,
          stops: { deleteMany: {}, create: stopsCreate },
        };
      }
    }
  } else {
    payload = Object.fromEntries(
      Object.entries(data).filter(([key]) => SELF_EDITABLE_FIELDS.includes(key))
    );
  }

  const updated = await updateRecordById(id, payload);
  return toResponse(updated, actor);
};

// Ruta en vivo desde la posicion GPS actual del chofer hasta la parada final del
// servicio (no desde el deposito), a demanda: solo se llama cuando el OWNER/ADMIN
// tiene este servicio abierto/seleccionado en el mapa, no en cada refresco de posiciones
// para todos los servicios activos (eso saldria caro corriendolo cada 20s de mas).
// Best-effort: si el servicio ya no esta en camino, la ubicacion del chofer no esta
// fresca, o no hay parada geocodificada, se devuelve null y el mapa muestra "no disponible".
export const getLiveEtaForRecord = async (id) => {
  const record = await findRecordById(id);
  if (!record) {
    throw new AppError("Registro no encontrado", 404);
  }
  if (record.estado !== "IN_CONSEGNA") return null;

  const driver = await findUserLocationById(record.driverId);
  if (!driver || driver.ubicacionLat == null || driver.ubicacionLng == null) return null;

  const staleSince = new Date(Date.now() - LOCATION_FRESH_MINUTES * 60 * 1000);
  if (!driver.ubicacionActualizada || driver.ubicacionActualizada < staleSince) return null;

  const finalStop = record.stops[record.stops.length - 1];
  if (!finalStop || finalStop.lat == null || finalStop.lng == null) return null;

  const ruta = await calculateRoute([
    { lat: driver.ubicacionLat, lng: driver.ubicacionLng },
    { lat: finalStop.lat, lng: finalStop.lng },
  ]);
  if (!ruta) return null;

  return { distanciaKm: ruta.distanciaKm, duracionMin: ruta.duracionMin, geometria: ruta.geometria };
};

export const deleteRecord = async (id) => {
  const record = await findRecordById(id);
  if (!record) {
    throw new AppError("Registro no encontrado", 404);
  }

  await purgeFilesForRecord(id);
  await deleteRecordById(id);
};
