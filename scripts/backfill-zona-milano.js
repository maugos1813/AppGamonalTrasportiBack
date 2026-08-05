import { prisma } from "../src/config/prisma.js";

// Hasta que arranco DHL en Roma, todo lo cargado (Extras Piazza, DHL, AB Service) era
// de Milano - la Zona simplemente nunca se cargaba porque no habia necesidad de
// distinguir. Alta unica pedida por el owner: completa MILANO en todo lo que quedo sin
// zona, para que el switch Milano/Roma que se agrega en Registros arranque mostrando
// el historico completo en vez de dejarlo escondido en "sin zona".
const targets = [
  { label: "Extras Piazza", where: { OR: [{ spedizzione: "EXTRA_PIAZZA" }, { spedizzione: null }], extrasPiazzaZona: null } },
  { label: "DHL", where: { spedizzione: "DHL", extrasPiazzaZona: null } },
  { label: "AB Service", where: { spedizzione: "AB_SERVICE", extrasPiazzaZona: null } },
];

for (const { label, where } of targets) {
  const result = await prisma.record.updateMany({ where, data: { extrasPiazzaZona: "MILANO" } });
  console.log(`${label}: ${result.count} registro(s) actualizados a MILANO`);
}

await prisma.$disconnect();
