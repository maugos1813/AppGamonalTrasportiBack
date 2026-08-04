import { prisma } from "../src/config/prisma.js";
import { fetchSheetRowsByTabName } from "../src/services/googleSheets.service.js";
import { REGISTROS_TAB, ORIGEN_PREFIX, SPEDIZZIONE_MAP } from "../src/constants/appsheetMaps.js";

// Compara, fila por fila, el km de EXTRAS_PIAZZA entre la planilla AppSheet y la app,
// para encontrar en que registro puntual esta la diferencia entre los dos totales.
// EXTRAS_PIAZZA = SPEDIZZIONE vacia o "EXTRA PIAZZA" (mismo criterio que
// AREA_SPEDIZZIONE_WHERE en record.service.js). Km = KM DESTINO, con fallback a
// KM REAL si DESTINO no vino cargado (mismo criterio que dashboardStats.js: kilometros
// ?? kilometrosReales).
const parseNumber = (raw) => {
  if (!raw) return null;
  const cleaned = String(raw).replace("€", "").replace(/,/g, "").trim();
  if (cleaned === "") return null;
  const value = Number(cleaned);
  return Number.isNaN(value) ? null : value;
};

const { header, rows } = await fetchSheetRowsByTabName(REGISTROS_TAB);
const idx = {};
header.forEach((h, i) => {
  if (h) idx[h.trim()] = i;
});

const sheetById = new Map();
let sheetTotal = 0;
for (const row of rows) {
  const id = row[idx["ID"]]?.trim();
  if (!id) continue;
  const spedizzioneRaw = (row[idx["SPEDIZZIONE"]] ?? "").trim().toUpperCase();
  const spedizzione = spedizzioneRaw ? SPEDIZZIONE_MAP[spedizzioneRaw] : null;
  const isExtrasPiazza = !spedizzioneRaw || spedizzione === "EXTRA_PIAZZA";
  if (!isExtrasPiazza) continue;

  const kmDestino = parseNumber(row[idx["KM DESTINO"]]);
  const kmReal = parseNumber(row[idx["KM REAL"]]);
  const km = kmDestino ?? kmReal ?? 0;
  sheetTotal += km;
  sheetById.set(id, {
    km,
    kmDestino,
    kmReal,
    estado: row[idx["ESTADO"]],
    cliente: row[idx["CLIENTE"]],
    autista: row[idx["AUTISTA"]],
    data: row[idx["DATA"]],
  });
}

const dbRecords = await prisma.record.findMany({
  where: { OR: [{ spedizzione: "EXTRA_PIAZZA" }, { spedizzione: null }] },
  select: {
    id: true,
    codigo: true,
    origenExternoId: true,
    kilometros: true,
    kilometrosReales: true,
    estado: true,
    fechaServicio: true,
    descripcion: true,
  },
});

const dbById = new Map();
let dbTotal = 0;
for (const r of dbRecords) {
  const km = r.kilometros ?? r.kilometrosReales ?? 0;
  dbTotal += km;
  const originId = r.origenExternoId?.startsWith(ORIGEN_PREFIX)
    ? r.origenExternoId.slice(ORIGEN_PREFIX.length)
    : null;
  dbById.set(originId ?? `__no-origin__:${r.id}`, { ...r, km, originId });
}

console.log(`Total planilla (EXTRAS_PIAZZA): ${sheetTotal} km (${sheetById.size} filas)`);
console.log(`Total app (EXTRAS_PIAZZA):      ${dbTotal} km (${dbRecords.length} registros)`);
console.log(`Diferencia: ${(dbTotal - sheetTotal).toFixed(2)} km`);
console.log("");

console.log("=== Diferencias fila por fila (planilla vs app, match por ID) ===");
for (const [id, sheetRow] of sheetById) {
  const dbRow = dbById.get(id);
  if (!dbRow) {
    console.log(`SOLO EN PLANILLA  id=${id} km=${sheetRow.km} estado=${sheetRow.estado} cliente=${sheetRow.cliente} autista=${sheetRow.autista} data=${sheetRow.data}`);
    continue;
  }
  if (Math.abs(dbRow.km - sheetRow.km) > 0.001) {
    console.log(
      `DIFERENCIA id=${id} planilla=${sheetRow.km}km app=${dbRow.km}km delta=${(dbRow.km - sheetRow.km).toFixed(2)}km ` +
        `codigo=${dbRow.codigo} estado=${sheetRow.estado} cliente=${sheetRow.cliente} autista=${sheetRow.autista} data=${sheetRow.data}`
    );
  }
}

console.log("");
console.log("=== Registros en la app sin origen en la planilla (creados manualmente / otro origen) ===");
for (const [id, dbRow] of dbById) {
  if (id.startsWith("__no-origin__") || !sheetById.has(id)) {
    console.log(
      `${id.startsWith("__no-origin__") ? "SIN origenExternoId" : "origen no encontrado en planilla actual"} ` +
        `codigo=${dbRow.codigo} km=${dbRow.km} estado=${dbRow.estado} fecha=${dbRow.fechaServicio?.toISOString?.().slice(0, 10)} desc=${dbRow.descripcion}`
    );
  }
}

await prisma.$disconnect();
