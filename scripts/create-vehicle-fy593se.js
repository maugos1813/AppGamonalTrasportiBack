import { prisma } from "../src/config/prisma.js";

// Fila 6327 del sync AppSheet (origen "07d45fb3") fallaba con "vehiculo no encontrado:
// F016" porque F016/FY593SE nunca se habia dado de alta en el sistema. Alta unica,
// pedida por el owner, para que esa fila (y las que vengan con F016/FY593SE) sincronicen.
const TARGA = "FY593SE";

const existing = await prisma.vehiculo.findUnique({ where: { targa: TARGA } });
if (existing) {
  console.log(`Ya existe un vehiculo con targa ${TARGA} (id ${existing.id}), no se crea de nuevo.`);
} else {
  const vehicle = await prisma.vehiculo.create({
    data: {
      targa: TARGA,
      modelo: "Renault Traffic",
      area: "FARMACIA",
    },
  });
  console.log(`Vehiculo creado: ${vehicle.id} (${vehicle.targa} - ${vehicle.modelo})`);
}

await prisma.$disconnect();
