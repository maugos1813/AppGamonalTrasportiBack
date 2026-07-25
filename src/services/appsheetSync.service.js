import { fetchSheetRowsByTabName } from "./googleSheets.service.js";
import { findSyncState, upsertSyncState } from "../models/syncState.model.js";
import { findAllUsers } from "../models/user.model.js";
import { findVehicles } from "../models/vehicle.model.js";
import { findClients, createClient } from "../models/client.model.js";
import { findAllCodigos, findRecordByOrigenExternoId, findRecordDedupSignatures } from "../models/record.model.js";
import { createRecord } from "./record.service.js";
import { ESTADO_MAP, ORIGEN_PREFIX, REGISTROS_TAB, SPEDIZZIONE_MAP, ZONA_MAP } from "../constants/appsheetMaps.js";

const SOURCE = "appsheet_registros";

// Desde donde se sincroniza por defecto (el historico mas viejo de la planilla no se
// toca - ver la conversacion con el owner: formato mas variado ahi, no vale el riesgo
// de un mapeo automatico sin revision).
const SYNC_FROM_DATE = new Date(process.env.APPSHEET_SYNC_FROM_DATE || "2026-03-01T00:00:00.000Z");

// Nombres exactos de pestana en "APP GT 1.0" (planilla de ~59 pestanas). "Id_Trabajador"
// e "ID_FURGON" tambien aparecen en otras pestanas de seguimiento (puntajes semanales,
// asignaciones), asi que se referencian por nombre en vez de buscar por columna.
const PERSONNEL_TAB = "Hoja 1";
const VEHICLES_TAB = "Hoja 2";

// Vehiculo generico (ya creado en el sistema) para filas sin TARGA cargada en la
// planilla, para no perder el km de ese viaje.
const GENERIC_VEHICLE_TARGA = "NOLEGGIO/OTRO";

// dd/mm/yyyy [h:mm[:ss]] -> Date. Acepta fecha sola o fecha+hora separadas (la
// planilla cruda a veces trae ETA como solo hora en una columna aparte).
const parseSheetDate = (dateRaw, timeRaw) => {
  if (!dateRaw) return null;
  const dateMatch = dateRaw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!dateMatch) return null;
  const [, d, mo, y] = dateMatch;

  let h = 0;
  let mi = 0;
  if (timeRaw) {
    const timeMatch = timeRaw.trim().match(/^(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      h = Number(timeMatch[1]);
      mi = Number(timeMatch[2]);
    }
  }

  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), h, mi));
  return Number.isNaN(date.getTime()) ? null : date;
};

const parseNumber = (raw) => {
  if (!raw) return null;
  const cleaned = String(raw).replace("€", "").replace(/,/g, "").trim();
  if (cleaned === "") return null;
  const value = Number(cleaned);
  return Number.isNaN(value) ? null : value;
};

const normalizeName = (value) => (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

// AUTISTA/TARGA en la planilla cruda a veces vienen como codigo interno de AppSheet
// (ej "G006", "F001", referenciando las pestanas de choferes/vehiculos) y a veces
// como texto directo ("JUAN CARLOS LAZARO", "ER643VY - FIAT DOBLO"). Se resuelven los
// dos casos probando primero el mapa de codigos, sin asumir un prefijo fijo (el
// ID_FURGON de Hoja 2 no siempre empieza con "F" - ver resolveVehicleId).
const stripTargaSuffix = (value) => (value ?? "").split(" - ")[0].trim();

const indexByHeader = (header) => {
  const map = {};
  header.forEach((name, i) => {
    if (name) map[name.trim()] = i;
  });
  return map;
};

const buildPersonnelCodeMap = async () => {
  const { header, rows } = await fetchSheetRowsByTabName(PERSONNEL_TAB);
  const idx = indexByHeader(header);
  const map = new Map();
  rows.forEach((row) => {
    const code = row[idx["Id_Trabajador"]]?.trim();
    const nombre = row[idx["NOMBRE"]]?.trim();
    if (code && nombre) map.set(code.toUpperCase(), nombre);
  });
  return map;
};

const buildVehicleCodeMap = async () => {
  const { header, rows } = await fetchSheetRowsByTabName(VEHICLES_TAB);
  const idx = indexByHeader(header);
  const map = new Map();
  rows.forEach((row) => {
    const code = row[idx["ID_FURGON"]]?.trim();
    const targa = row[idx["TARGA"]]?.trim();
    if (code && targa) map.set(code.toUpperCase(), targa);
  });
  return map;
};

// Conocidos de antemano por typos/apodos en la planilla que no matchean 1:1 con el
// nombre guardado en el sistema (ver mismo patron usado en los imports de CSV).
const DRIVER_NAME_OVERRIDES = {
  "mauro agostinelllli": "mauro fabian agostinelli",
  "mauro agostinellli": "mauro fabian agostinelli",
};

// dryRun: no crea nada (ni clientes ni registros) - solo devuelve que HARIA el sync.
// Pensado para validar el mapeo de la planilla antes de una corrida real.
// fromDate/toDate: acotan que rango de fechas de servicio se sincroniza (por defecto
// desde SYNC_FROM_DATE hasta ahora). Sirve para correr el historico grande de a
// pedazos (ej. un mes a la vez) en vez de todo junto - una corrida mas chica termina
// mas rapido y no satura el pool de conexiones a Neon con miles de geocodificaciones
// seguidas en un solo request.
export const runAppsheetRegistrosSync = async ({ dryRun = false, fromDate, toDate } = {}) => {
  const rangeStart = fromDate ?? SYNC_FROM_DATE;
  const rangeEnd = toDate ?? null;

  const [
    { header, rows },
    personnelCodeMap,
    vehicleCodeMap,
    existingUsers,
    existingVehicles,
    existingClients,
    dedupRows,
    existingCodigos,
  ] = await Promise.all([
    fetchSheetRowsByTabName(REGISTROS_TAB),
    buildPersonnelCodeMap(),
    buildVehicleCodeMap(),
    findAllUsers(),
    findVehicles(),
    findClients(),
    findRecordDedupSignatures(rangeStart),
    findAllCodigos(),
  ]);

  const idx = indexByHeader(header);
  const driversByName = new Map(existingUsers.map((u) => [normalizeName(`${u.nombre} ${u.apellido}`), u.id]));
  const vehiclesByTarga = new Map(existingVehicles.map((v) => [v.targa.trim().toUpperCase(), v.id]));
  const clientsByName = new Map(existingClients.map((c) => [c.nombre.trim().toLowerCase(), c.id]));
  const dedupSignatures = new Set(dedupRows.map((r) => `${r.driverId}|${r.dateKey}|${r.kilometros}`));

  const resolveDriverId = (autistaRaw) => {
    const trimmed = (autistaRaw ?? "").trim();
    const fromCode = personnelCodeMap.get(trimmed.toUpperCase());
    let nameKey = normalizeName(fromCode ?? trimmed);
    nameKey = DRIVER_NAME_OVERRIDES[nameKey] ?? nameKey;
    return driversByName.get(nameKey) ?? null;
  };

  // El codigo de furgon en la planilla no siempre empieza con "F" (ej "G100" tambien
  // aparece como ID_FURGON en Hoja 2) - se prueba el mapa de codigos primero sin asumir
  // un prefijo fijo, y si no matchea ahi se trata el valor como targa literal. Fila sin
  // TARGA cargada -> vehiculo generico (decision del owner, no perder el km del viaje).
  const resolveVehicleId = (targaRaw) => {
    const stripped = stripTargaSuffix(targaRaw).toUpperCase();
    if (!stripped) return vehiclesByTarga.get(GENERIC_VEHICLE_TARGA) ?? null;
    const targa = vehicleCodeMap.get(stripped) ?? stripped;
    return vehiclesByTarga.get(targa.trim().toUpperCase()) ?? null;
  };

  const resolveClientId = async (clienteRaw) => {
    const key = clienteRaw.trim().toLowerCase();
    const existing = clientsByName.get(key);
    if (existing) return existing;
    if (dryRun) return "DRY-RUN-CLIENT-ID";
    const created = await createClient({ nombre: clienteRaw.trim() });
    clientsByName.set(key, created.id);
    return created.id;
  };

  let created = 0;
  let skipped = 0;
  const errors = [];
  let latestRowDate = null;

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const rowNumber = i + 2; // +1 header, +1 base-1
    const originId = row[idx["ID"]]?.trim();
    if (!originId) continue;

    const fullOriginId = `${ORIGEN_PREFIX}${originId}`;

    try {
      const dataRaw = row[idx["DATA"]] ?? "";
      const fechaServicio = parseSheetDate(dataRaw);
      if (!fechaServicio) continue; // fila sin fecha valida: probablemente vacia/en blanco
      if (fechaServicio < rangeStart) continue; // fuera del rango que se sincroniza
      if (rangeEnd && fechaServicio >= rangeEnd) continue;

      if (!latestRowDate || fechaServicio > latestRowDate) latestRowDate = fechaServicio;

      const alreadySynced = await findRecordByOrigenExternoId(fullOriginId);
      if (alreadySynced) {
        skipped += 1;
        continue;
      }

      const estadoRaw = (row[idx["ESTADO"]] ?? "").trim().toUpperCase();
      const estado = ESTADO_MAP[estadoRaw];
      if (!estado) {
        errors.push({ row: rowNumber, id: originId, reason: `estado no reconocido: "${estadoRaw}"` });
        continue;
      }

      const autistaRaw = row[idx["AUTISTA"]] ?? "";
      const driverId = resolveDriverId(autistaRaw);
      if (!driverId) {
        errors.push({ row: rowNumber, id: originId, reason: `chofer no encontrado: "${autistaRaw}"` });
        continue;
      }

      const targaRaw = row[idx["TARGA"]] ?? "";
      const vehicleId = resolveVehicleId(targaRaw);
      if (!vehicleId) {
        errors.push({ row: rowNumber, id: originId, reason: `vehiculo no encontrado: "${targaRaw}"` });
        continue;
      }

      // Antes de existir el sync, ya se cargaron a mano (via CSV) los registros mas
      // recientes de Extras Piazza y DHL/AB Service - esos no tienen origenExternoId,
      // asi que el chequeo de arriba no los reconoce. Esta firma (chofer + dia + km)
      // evita duplicarlos.
      // dateKey en hora de Roma (no UTC crudo): el import manual viejo guardaba la fecha
      // como medianoche Roma convertida a UTC, mientras que este parseo guarda la fecha
      // de la planilla como medianoche UTC directo - un slice UTC crudo los desalineaba
      // por un dia y la firma nunca matcheaba, duplicando cientos de registros ya cargados.
      const kilometros = parseNumber(row[idx["KM DESTINO"]]);
      const dedupKey = `${driverId}|${fechaServicio.toLocaleDateString("en-CA", { timeZone: "Europe/Rome" })}|${kilometros}`;
      if (dedupSignatures.has(dedupKey)) {
        skipped += 1;
        continue;
      }

      const clienteRaw = row[idx["CLIENTE"]] ?? "";
      if (!clienteRaw.trim()) {
        errors.push({ row: rowNumber, id: originId, reason: "sin cliente" });
        continue;
      }
      const clientId = await resolveClientId(clienteRaw);

      const eta = parseSheetDate(dataRaw, row[idx["ETA"]]) ?? fechaServicio;

      const ciudad = (row[idx["CIUDAD"]] ?? "").trim();
      const calle = (row[idx["DESTINAZIONE"]] ?? "").trim();
      const stop = calle ? (ciudad ? `${calle}, ${ciudad}` : calle) : ciudad;
      if (!stop) {
        errors.push({ row: rowNumber, id: originId, reason: "sin direccion (CIUDAD/DESTINAZIONE vacios)" });
        continue;
      }

      // REGISTROS_TAB ("DHL CONSEGNAS") mezcla los 3 tipos de servicio (DHL, AB SERVICE,
      // EXTRA PIAZZA) en la misma columna SPEDIZZIONE - no asumir un default aca, un valor
      // que no matchea el mapa queda sin clasificar (revisar a mano) en vez de adivinar.
      const spedizzioneRaw = (row[idx["SPEDIZZIONE"]] ?? "").trim().toUpperCase();
      const spedizzione = SPEDIZZIONE_MAP[spedizzioneRaw];

      const zonaRaw = (row[idx["ZONA"]] ?? "").trim().toUpperCase();
      const extrasPiazzaZona = ZONA_MAP[zonaRaw];

      const descripcion = (row[idx["DATOS CONSEGNA"]] ?? "").trim() || `${clienteRaw.trim()} - ${ciudad}`;

      // El CODIGO de la planilla no es realmente unico (AppSheet reutiliza el mismo
      // texto en envios distintos) - si ya esta tomado por otro registro, se usa el
      // fallback en vez de perder la fila (el ID de la planilla si es unico por fila).
      const codigoRaw = (row[idx["CÓDIGO"]] ?? "").trim();
      const codigo = codigoRaw && !existingCodigos.has(codigoRaw) ? codigoRaw : `SYNC-${originId}`;
      existingCodigos.add(codigo);

      const extraNotes = [];
      const notas = (row[idx["NOTAS"]] ?? "").trim();
      if (notas) extraNotes.push(notas);
      const autostrada = (row[idx["AUTOSTRADA"]] ?? "").trim();
      if (autostrada) extraNotes.push(`Autostrada: ${autostrada}`);
      const nPart = (row[idx["N. PART"]] ?? "").trim();
      if (nPart) extraNotes.push(`N. part: ${nPart}`);

      const payload = {
        codigo,
        origenExternoId: fullOriginId,
        clientId,
        driverId,
        vehicleId,
        estado,
        fechaServicio,
        eta,
        descripcion,
        ciudad: ciudad || undefined,
        stops: [stop],
        spedizzione,
        extrasPiazzaZona,
        kilometros: kilometros ?? undefined,
        areaC: parseNumber(row[idx["AREA C"]]) ?? undefined,
        costoEspera: parseNumber(row[idx["PRECIO ATTESA"]]) ?? undefined,
        pagoRecibido: parseNumber(row[idx["MONTO"]]) ?? undefined,
        costoCombustible: parseNumber(row[idx["GASTO COMBUSTIBLE"]]) ?? undefined,
        peajes: parseNumber(row[idx["PEAJES €"]]) ?? undefined,
        vignetta: parseNumber(row[idx["VIGNETTA €"]]) ?? undefined,
        costoHotel: parseNumber(row[idx["PRECIO HOTEL"]]) ?? undefined,
        costoTraforoFrejusBrennero: parseNumber(row[idx["TRAFORO/FREJUS €"]]) ?? undefined,
        comentarios: extraNotes.length ? extraNotes.join(" | ") : undefined,
      };

      if (!dryRun) await createRecord(payload, { skipActiveCheck: true });
      created += 1;
    } catch (err) {
      errors.push({ row: rowNumber, id: originId, reason: err.message ?? "error desconocido" });
    }
  }

  if (dryRun) return { created, skipped, errors, dryRun: true };

  await upsertSyncState(SOURCE, {
    lastSyncedAt: new Date(),
    lastRowDate: latestRowDate,
    lastRunCreated: created,
    lastRunSkipped: skipped,
    lastRunErrors: errors.length,
    lastRunErrorLog: errors,
  });

  return { created, skipped, errors };
};

export const getLastAppsheetSyncState = () => findSyncState(SOURCE);
