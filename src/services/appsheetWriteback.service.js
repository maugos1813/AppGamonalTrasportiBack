import {
  appendSheetRow,
  deleteSheetRow,
  findRowNumberByColumnValue,
  updateSheetRow,
} from "./googleSheets.service.js";
import {
  ESTADO_REVERSE,
  getMesLabel,
  ORIGEN_PREFIX,
  REGISTROS_TAB,
  SPEDIZZIONE_REVERSE,
  toRomeParts,
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

// ETA puede caer en un dia distinto al de DATA (un servicio de hoy con entrega
// pactada para dentro de unos dias) - se escribe fecha+hora completa ("dd/mm/yyyy
// hh:mm:ss", el formato que ya usa la mayoria de las filas historicas de la
// planilla), nunca solo la hora: una celda con solo "hh:mm" pierde el dia y ademas
// Sheets la guarda como un serial de tiempo puro (epoch 30/12/1899), que AppSheet
// termina mostrando como "30/12/1899 hh:mm" si la columna espera fecha+hora.
// A diferencia de toSheetDate (fecha sola, UTC "a secas"), ETA si lleva hora real:
// se convierte a hora de pared de Italia (ver toRomeParts en appsheetMaps.js), sin
// eso la planilla mostraba la hora UTC cruda en vez de la que cargo el chofer/admin.
const toSheetDateTime = (value) => {
  const { year, month, day, hour, minute } = toRomeParts(value);
  const dd = String(day).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  const hh = String(hour).padStart(2, "0");
  const mi = String(minute).padStart(2, "0");
  return `${dd}/${mm}/${year} ${hh}:${mi}:00`;
};

// Mapeo inverso exacto del que lee appsheetSync.service.js, compartido entre alta
// (appendRecordToAppsheet) y edicion (updateRecordInAppsheet) - asi ambas escriben
// siempre las mismas columnas de la misma forma. AUTOSTRADA/N. PART no tienen vuelta
// (se pliegan dentro de "comentarios" al leer, sin campo propio en Record), quedan
// vacios al escribir. record debe venir con driver/vehicle/client incluidos (ya los
// trae RECORD_INCLUDE, ver record.model.js).
const buildAppsheetRow = (record) => ({
  ID: record.id,
  DATA: toSheetDate(record.fechaServicio),
  MES: getMesLabel(record.fechaServicio),
  ESTADO: ESTADO_REVERSE[record.estado] ?? "",
  AUTISTA: record.driver ? `${record.driver.nombre} ${record.driver.apellido}` : "",
  TARGA: record.vehicle?.targa ?? "",
  "KM DESTINO": record.kilometros ?? "",
  "KM REAL": record.kilometrosReales ?? "",
  CLIENTE: record.client?.nombre ?? "",
  ETA: toSheetDateTime(record.eta),
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
});

// Escribe en "DHL CONSEGNAS" el registro recien creado desde la app (Extras Piazza o
// DHL/AB Service - la pestana ya mezcla los 3 tipos, ver SPEDIZZIONE_MAP).
export const appendRecordToAppsheet = async (record) => {
  await appendSheetRow(REGISTROS_TAB, buildAppsheetRow(record));
};

// Corrige la fila de un registro ya sincronizado cuando se edita desde la app -
// mismas columnas que appendRecordToAppsheet, pero sobre la fila existente (ver
// updateSheetRow: no pisa columnas ajenas a este mapeo). Un registro que nunca se
// pudo escribir en la hoja (ver el catch en record.service.js) no tiene
// origenExternoId - no hay fila que corregir.
// ID se fuerza a sheetId (no record.id): buildAppsheetRow siempre pone record.id en
// ID porque appendRecordToAppsheet la necesita asi para una fila nueva, pero aca la
// fila ya existe con su propio ID de planilla - pisarlo con nuestro UUID interno
// descoordina esa columna del origenExternoId guardado y el proximo sync termina
// reimportando la fila como si fuera nueva (duplicando el registro).
export const updateRecordInAppsheet = async (record) => {
  if (!record.origenExternoId?.startsWith(ORIGEN_PREFIX)) return;
  const sheetId = record.origenExternoId.slice(ORIGEN_PREFIX.length);
  const rowNumber = await findRowNumberByColumnValue(REGISTROS_TAB, "ID", sheetId);
  if (rowNumber === null) return;
  await updateSheetRow(REGISTROS_TAB, rowNumber, { ...buildAppsheetRow(record), ID: sheetId });
};

// Borra de "DHL CONSEGNAS" la fila de un registro eliminado desde la app. origenExternoId
// es "appsheet:<ID de la columna ID en la hoja>" (ver ORIGEN_PREFIX) - para un registro
// creado desde la app es su propio id (appendRecordToAppsheet escribe ID: record.id),
// para uno que vino del sync es el id original de la fila en la hoja; en ambos casos
// sacarle el prefijo da el valor real de la columna ID a buscar. Un registro que nunca
// se pudo escribir en la hoja (ver el catch en record.service.js) no tiene
// origenExternoId - no hay nada que borrar ahi.
export const deleteRecordFromAppsheet = async (record) => {
  if (!record.origenExternoId?.startsWith(ORIGEN_PREFIX)) return;
  const sheetId = record.origenExternoId.slice(ORIGEN_PREFIX.length);
  const rowNumber = await findRowNumberByColumnValue(REGISTROS_TAB, "ID", sheetId);
  if (rowNumber === null) return;
  await deleteSheetRow(REGISTROS_TAB, rowNumber);
};
