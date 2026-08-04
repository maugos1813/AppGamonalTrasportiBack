import { prisma } from "../src/config/prisma.js";

const start = new Date(2026, 6, 1);
const end = new Date(2026, 7, 1);

const records = await prisma.record.findMany({
  where: {
    fechaServicio: { gte: start, lt: end },
    pagoRecibido: { not: null },
  },
  select: {
    codigo: true,
    estado: true,
    fechaServicio: true,
    spedizzione: true,
    kilometros: true,
    kilometrosReales: true,
    horasDia: true,
    horasNoche: true,
    pagoRecibido: true,
    costoCombustible: true,
    peajes: true,
    vignetta: true,
    costoHotel: true,
    costoTraforoFrejusBrennero: true,
    areaC: true,
    costoEspera: true,
    client: { select: { nombre: true } },
  },
});

const DRIVER_HOURLY_RATE = 10;
const ASSUMED_KM_PER_HOUR = 100;
const COST_FIELDS = [
  "costoCombustible",
  "peajes",
  "vignetta",
  "costoHotel",
  "costoTraforoFrejusBrennero",
  "areaC",
  "costoEspera",
];

const driverHours = (r) => {
  const logged = (r.horasDia ?? 0) + (r.horasNoche ?? 0);
  if (logged > 0) return logged;
  return (r.kilometros ?? 0) / ASSUMED_KM_PER_HOUR;
};
const driverPay = (r) => driverHours(r) * DRIVER_HOURLY_RATE;
const cost = (r) => driverPay(r) + COST_FIELDS.reduce((sum, f) => sum + (r[f] ?? 0), 0);
const revenue = (r) => r.pagoRecibido;
const profit = (r) => revenue(r) - cost(r);

const category = (r) => {
  if (r.spedizzione === "DHL") return "DHL";
  if (r.spedizzione === "AB_SERVICE") return "AB_SERVICE";
  if (r.spedizzione === "EXTRAS_STEFANIA") return "EXTRAS_STEFANIA";
  return "EXTRA_PIAZZA";
};

const groups = new Map();
for (const r of records) {
  const cat = category(r);
  const g = groups.get(cat) ?? {
    count: 0,
    revenue: 0,
    cost: 0,
    profit: 0,
    driverPay: 0,
    combustible: 0,
    peajes: 0,
    vignetta: 0,
    hotel: 0,
    traforo: 0,
    areaC: 0,
    espera: 0,
    negativos: 0,
  };
  g.count += 1;
  g.revenue += revenue(r);
  g.cost += cost(r);
  g.profit += profit(r);
  g.driverPay += driverPay(r);
  g.combustible += r.costoCombustible ?? 0;
  g.peajes += r.peajes ?? 0;
  g.vignetta += r.vignetta ?? 0;
  g.hotel += r.costoHotel ?? 0;
  g.traforo += r.costoTraforoFrejusBrennero ?? 0;
  g.areaC += r.areaC ?? 0;
  g.espera += r.costoEspera ?? 0;
  if (profit(r) < 0) g.negativos += 1;
  groups.set(cat, g);
}

const porCliente = new Map();
for (const r of records) {
  const p = profit(r);
  if (p >= 0) continue;
  const cliente = r.client?.nombre ?? "SIN CLIENTE";
  const c = porCliente.get(cliente) ?? { count: 0, perdida: 0, ingreso: 0, costo: 0, kmTotal: 0 };
  c.count += 1;
  c.perdida += p;
  c.ingreso += revenue(r);
  c.costo += cost(r);
  c.kmTotal += r.kilometros ?? r.kilometrosReales ?? 0;
  porCliente.set(cliente, c);
}

const detalle = records
  .filter((r) => profit(r) < 0)
  .sort((a, b) => profit(a) - profit(b))
  .map((r) => ({
    codigo: r.codigo,
    cliente: r.client?.nombre ?? "SIN CLIENTE",
    fecha: r.fechaServicio.toISOString().slice(0, 10),
    km: r.kilometros ?? r.kilometrosReales ?? 0,
    ingreso: revenue(r),
    chofer: driverPay(r),
    combustible: r.costoCombustible ?? 0,
    costoTotal: cost(r),
    perdida: profit(r),
  }));

const output = {
  totalServiciosPagados: records.length,
  porTipo: Object.fromEntries(groups),
  porCliente: Object.fromEntries(porCliente),
  detalleServiciosConPerdida: detalle,
};

console.log(JSON.stringify(output, null, 2));

await prisma.$disconnect();
