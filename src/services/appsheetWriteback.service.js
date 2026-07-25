import { appendSheetRow } from "./googleSheets.service.js";
import {
  ESTADO_REVERSE,
  REGISTROS_TAB,
  SPEDIZZIONE_REVERSE,
  ZONA_REVERSE,
} from "../constants/appsheetMaps.js";

// Inverso de parseSheetDate (appsheetSync.service.js): arma dd/mm/yyyy en UTC, mismo
// criterio que usa el sync para interpretar la fecha de la hoja (Date.UTC), asi que
// esto es simetrico - un valor que este servicio escribe, el sync lo vuelve a leer
// exactamente igual.
const toSheetDate = (value) => {
  const d = new Date(value);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
};

const toSheetTime = (value) => {
  const d = new Date(value);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mi}`;
};

// Escribe en "DHL CONSEGNAS" el registro recien creado desde la app (Extras Piazza o
// DHL/AB Service - la pestana ya mezcla los 3 tipos, ver SPEDIZZIONE_MAP). Mapeo
// inverso exacto del que lee appsheetSync.service.js. AUTOSTRADA/N. PART no tienen
// vuelta (se pliegan dentro de "comentarios" al leer, sin campo propio en Record),
// quedan vacios al escribir. record debe venir con driver/vehicle/client incluidos
// (ya los trae RECORD_INCLUDE, ver record.model.js).
export const appendRecordToAppsheet = async (record) => {
  const row = {
    ID: record.id,
    DATA: toSheetDate(record.fechaServicio),
    ESTADO: ESTADO_REVERSE[record.estado] ?? "",
    AUTISTA: record.driver ? `${record.driver.nombre} ${record.driver.apellido}` : "",
    TARGA: record.vehicle?.targa ?? "",
    "KM DESTINO": record.kilometros ?? "",
    CLIENTE: record.client?.nombre ?? "",
    ETA: toSheetTime(record.eta),
    CIUDAD: record.ciudad ?? "",
    DESTINAZIONE: record.destinazione ?? "",
    SPEDIZZIONE: record.spedizzione ? SPEDIZZIONE_REVERSE[record.spedizzione] ?? "" : "",
    "DATOS CONSEGNA": record.descripcion ?? "",
    "CÓDIGO": record.codigo ?? "",
    NOTAS: record.comentarios ?? "",
    "AREA C": record.areaC ?? "",
    "PRECIO ATTESA": record.costoEspera ?? "",
    MONTO: record.pagoRecibido ?? "",
    "GASTO COMBUSTIBLE": record.costoCombustible ?? "",
    "PEAJES €": record.peajes ?? "",
    "VIGNETTA €": record.vignetta ?? "",
    "PRECIO HOTEL": record.costoHotel ?? "",
    "TRAFORO/FREJUS €": record.costoTraforoFrejusBrennero ?? "",
    ZONA: record.extrasPiazzaZona ? ZONA_REVERSE[record.extrasPiazzaZona] ?? "" : "",
  };

  await appendSheetRow(REGISTROS_TAB, row);
};
