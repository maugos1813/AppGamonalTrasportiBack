// Nombre de pestana y prefijo de origenExternoId de la planilla "APP GT 1.0" (ver
// googleSheets.service.js), mas los mapas de valores hoja <-> enum Prisma. Vive en un
// modulo sin dependencias (ni de record.service.js ni de appsheetSync.service.js) para
// que tanto la lectura (appsheetSync.service.js) como la escritura
// (appsheetWriteback.service.js, usada desde record.service.js) puedan importarlo sin
// generar un ciclo entre esos dos.
export const REGISTROS_TAB = "DHL CONSEGNAS";
export const ORIGEN_PREFIX = "appsheet:";

export const ESTADO_MAP = {
  CONSEGNATO: "CONSEGNATO",
  ENTREGADO: "CONSEGNATO",
  "IN CONSEGNA": "IN_CONSEGNA",
  "IN SOSPESO": "IN_SOSPESO",
  PENDIENTE: "IN_SOSPESO",
  RITIRATO: "RITIRATO",
  RETIRADO: "RITIRATO",
  ANNULLATO: "ANNULLATO",
  ANULADO: "ANNULLATO",
  RISCHEDULATO: "RISCHEDULATO",
  REPROGRAMADO: "RISCHEDULATO",
};

export const SPEDIZZIONE_MAP = {
  DHL: "DHL",
  "AB SERVICE": "AB_SERVICE",
  AB_SERVICE: "AB_SERVICE",
  "EXTRA PIAZZA": "EXTRA_PIAZZA",
  EXTRA_PIAZZA: "EXTRA_PIAZZA",
};

// Columna "ZONA" (a agregar en la planilla, hoy no existe) - solo aplica a filas
// EXTRA_PIAZZA.
export const ZONA_MAP = {
  MILANO: "MILANO",
  MILAN: "MILANO",
  ROMA: "ROMA",
  ROME: "ROMA",
};

// Primer match por valor de cada mapa, para tener una forma canonica al escribir de
// vuelta a la hoja (ej. IN_CONSEGNA -> "IN CONSEGNA", no "PENDIENTE" para IN_SOSPESO).
const reverseFirstMatch = (map) => {
  const out = {};
  for (const [key, value] of Object.entries(map)) {
    if (!(value in out)) out[value] = key;
  }
  return out;
};

export const ESTADO_REVERSE = reverseFirstMatch(ESTADO_MAP);
export const SPEDIZZIONE_REVERSE = reverseFirstMatch(SPEDIZZIONE_MAP);
export const ZONA_REVERSE = reverseFirstMatch(ZONA_MAP);
