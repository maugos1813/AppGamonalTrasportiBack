import { prisma } from "../src/config/prisma.js";

// SYNC-0f9d3a35 (543km, 2026-07) y SYNC-2d490d91 (480km, 2026-04) se importaron con
// spedizzione null porque la hoja tenia "EXTRAS STEFANIA" en la columna SPEDIZZIONE,
// un valor que SPEDIZZIONE_MAP no reconocia todavia - cayeron en el balde de Extras
// Piazza en silencio. Correccion unica, despues de agregar EXTRAS_STEFANIA al enum.
const CODIGOS = ["SYNC-0f9d3a35", "SYNC-2d490d91"];

const result = await prisma.record.updateMany({
  where: { codigo: { in: CODIGOS }, spedizzione: null },
  data: { spedizzione: "EXTRAS_STEFANIA" },
});
console.log(`Updated ${result.count} record(s)`);
await prisma.$disconnect();
