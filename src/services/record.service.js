import {
  createRecord as createRecordModel,
  deleteRecordById,
  findRecordById,
  findRecords,
  findRecordsPending,
  findRecordsSummary,
  searchRecords,
  updateRecordById,
} from "../models/record.model.js";
import { findUserById, findUserLocationById } from "../models/user.model.js";
import { purgeFilesForRecord } from "./recordFile.service.js";
import { geocodeStops } from "./geocoding.service.js";
import { calculateRoute } from "./routing.service.js";
import { LOCATION_FRESH_MINUTES } from "./user.service.js";
import {
  appendRecordToAppsheet,
  deleteRecordFromAppsheet,
  updateRecordInAppsheet,
} from "./appsheetWriteback.service.js";
import { DEPOT_ORIGIN } from "../constants/depot.js";
import { ORIGEN_PREFIX } from "../constants/appsheetMaps.js";
import { AppError } from "../utils/AppError.js";
import { buildDateRange } from "../utils/dateRange.js";

const isPrivileged = (actor) => actor.cargo === "OWNER" || actor.cargo === "ADMIN";

// Un ADMIN "de area" (User.area) solo ve/gestiona Registros y Control economico de su
// propia area - OWNER no tiene restriccion. Los registros historicos sin spedizzione
// cargada se tratan como EXTRA_PIAZZA (mismo criterio que SECTIONS.matchesSpedizzione
// en el frontend), por eso el OR con null. Un area sin mapeo (ej. FARMACIA, que hoy no
// tiene registros propios) no matchea nada: deny-by-default en vez de ver todo.
const AREA_SPEDIZZIONE_WHERE = {
  EXTRAS_PIAZZA: { OR: [{ spedizzione: "EXTRA_PIAZZA" }, { spedizzione: null }] },
  DHL: { spedizzione: { in: ["DHL", "AB_SERVICE"] } },
};
const AREA_SPEDIZZIONES = {
  EXTRAS_PIAZZA: ["EXTRA_PIAZZA", null],
  DHL: ["DHL", "AB_SERVICE"],
};

const spedizzioneFilterForActor = (actor) =>
  actor.cargo === "ADMIN" ? (AREA_SPEDIZZIONE_WHERE[actor.area] ?? { spedizzione: { in: [] } }) : undefined;

const canAccessSpedizzione = (actor, spedizzione) =>
  actor.cargo !== "ADMIN" || (AREA_SPEDIZZIONES[actor.area] ?? []).includes(spedizzione ?? null);

const assertAccess = (actor, record) => {
  if (actor.cargo === "OWNER" || record.driverId === actor.id) return;
  if (isPrivileged(actor) && canAccessSpedizzione(actor, record.spedizzione)) return;
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
    // record.stops es undefined en los resultados de listado (findRecords no trae
    // la relacion, ver RECORD_SELECT_LIST) - solo esta presente en un fetch de un
    // registro puntual (findRecordById).
    stops: record.stops?.map(({ id, orden, direccion, lat, lng }) => ({ id, orden, direccion, lat, lng })),
    ruta: {
      distanciaKm: record.rutaDistanciaKm,
      duracionMin: record.rutaDuracionMin,
      geometria: record.rutaGeometria ?? null,
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
  stops: record.stops?.map(({ id, orden, direccion, lat, lng }) => ({ id, orden, direccion, lat, lng })),
  ruta: {
    distanciaKm: record.rutaDistanciaKm,
    duracionMin: record.rutaDuracionMin,
    geometria: record.rutaGeometria ?? null,
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

// skipActiveCheck: solo para el sync de AppSheet (ver appsheetSync.service.js) - esos
// registros son historicos (servicios que ya pasaron), no una asignacion nueva, asi
// que no tiene sentido bloquear la carga porque el chofer hoy este INACTIVO. La API
// normal de creacion de registros sigue exigiendo chofer activo.
export const createRecord = async (data, { skipActiveCheck = false, actor = null } = {}) => {
  if (!skipActiveCheck) await assertDriverActivo(data.driverId);

  // actor=null (sync de AppSheet) no valida area: es un proceso de confianza que
  // importa historico de todas las areas, no una creacion manual desde la UI.
  if (actor && !canAccessSpedizzione(actor, data.spedizzione ?? null)) {
    throw new AppError("No tienes permisos para crear un registro fuera de tu area", 403);
  }

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

  // Solo para registros nuevos creados desde la app (el sync ya manda origenExternoId
  // seteado, escribirlo de vuelta a la hoja seria redundante - ver appsheetSync.service.js).
  // Best-effort: si falla la escritura en Sheets (permisos, red, cuota), el registro en
  // la app ya quedo creado igual, no se corta el flujo del usuario por eso.
  if (!data.origenExternoId) {
    try {
      await appendRecordToAppsheet(record);
      await updateRecordById(record.id, { origenExternoId: `${ORIGEN_PREFIX}${record.id}` });
    } catch (err) {
      console.error("No se pudo escribir el registro en la hoja de AppSheet:", err.message);
    }
  }

  return toFullResponse(record);
};

export const listRecordsForActor = async (actor, dateRange) => {
  const driverId = isPrivileged(actor) ? undefined : actor.id;
  const spedizzioneFilter = spedizzioneFilterForActor(actor);
  const records = await findRecords({ driverId, dateRange, spedizzioneFilter });
  return records.map((record) => toResponse(record, actor));
};

// Panel de "Pendientes" de Registros: servicios en curso de HOY (hora local Europe/
// Rome, no la del servidor) - no tiene sentido traer el historico completo (miles de
// registros con la sincronizacion de AppSheet) solo para mostrar los pocos que estan
// en curso.
export const listPendingRecordsForActor = async (actor) => {
  const driverId = isPrivileged(actor) ? undefined : actor.id;
  const [year, month, day] = new Date()
    .toLocaleDateString("en-CA", { timeZone: "Europe/Rome" })
    .split("-")
    .map(Number);
  const { gte, lt } = buildDateRange(year, month, day);
  const spedizzioneFilter = spedizzioneFilterForActor(actor);
  const records = await findRecordsPending({ driverId, gte, lt, spedizzioneFilter });
  return records.map((record) => toResponse(record, actor));
};

const SEARCH_MIN_LENGTH = 2;

// Buscador de Registros (codigo/cliente/chofer/destino). Con menos de 2 caracteres
// devuelve vacio en vez de traer resultados poco utiles.
export const searchRecordsForActor = async (actor, q) => {
  const query = (q ?? "").trim();
  if (query.length < SEARCH_MIN_LENGTH) return [];
  const driverId = isPrivileged(actor) ? undefined : actor.id;
  const spedizzioneFilter = spedizzioneFilterForActor(actor);
  const records = await searchRecords({ q: query, driverId, spedizzioneFilter });
  return records.map((record) => toResponse(record, actor));
};

// Version liviana (id/fechaServicio/estado) para armar el acordeon de dias del
// mes sin traer stops/ruta/economico de cada registro. No hay datos sensibles
// aca, asi que no hace falta distinguir toFullResponse/toChoferResponse.
export const listRecordsSummaryForActor = async (actor, dateRange) => {
  const driverId = isPrivileged(actor) ? undefined : actor.id;
  const spedizzioneFilter = spedizzioneFilterForActor(actor);
  return findRecordsSummary({ driverId, dateRange, spedizzioneFilter });
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

  if (actor.cargo === "ADMIN" && "spedizzione" in data && !canAccessSpedizzione(actor, data.spedizzione)) {
    throw new AppError("No tienes permisos para mover este registro fuera de tu area", 403);
  }

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

  // Best-effort, igual que appendRecordToAppsheet/deleteRecordFromAppsheet: si falla
  // (permisos, red, cuota), el registro ya se actualizo en la app igual, no se corta
  // el flujo por esto.
  try {
    await updateRecordInAppsheet(updated);
  } catch (err) {
    console.error("No se pudo actualizar el registro en la hoja de AppSheet:", err.message);
  }

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

export const deleteRecord = async (actor, id) => {
  const record = await findRecordById(id);
  if (!record) {
    throw new AppError("Registro no encontrado", 404);
  }
  assertAccess(actor, record);

  await purgeFilesForRecord(id);
  await deleteRecordById(id);

  // Best-effort, igual que la escritura al crear (ver createRecord): si falla (permisos,
  // red, cuota), el registro ya se borro de la app igual, no se corta el flujo por esto.
  try {
    await deleteRecordFromAppsheet(record);
  } catch (err) {
    console.error("No se pudo borrar el registro de la hoja de AppSheet:", err.message);
  }
};
