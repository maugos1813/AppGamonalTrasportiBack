import { prisma } from "../src/config/prisma.js";

// Filas 6391/6392/6393/6405 del sync AppSheet fallaban con "vehiculo no encontrado:
// F037" porque F037/DK013LS nunca se habia dado de alta en el sistema. Alta unica,
// pedida por el owner, para que esas filas sincronicen.
const TARGA = "DK013LS";

const existing = await prisma.vehiculo.findUnique({ where: { targa: TARGA } });
if (existing) {
  console.log(`Ya existe un vehiculo con targa ${TARGA} (id ${existing.id}), no se crea de nuevo.`);
} else {
  const vehicle = await prisma.vehiculo.create({
    data: {
      targa: TARGA,
      modelo: "Toyota Prius",
      area: "DHL",
    },
  });
  console.log(`Vehiculo creado: ${vehicle.id} (${vehicle.targa} - ${vehicle.modelo})`);
}

await prisma.$disconnect();
