import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

const NOMINATIM_MIN_INTERVAL_MS = 1000; // politica de Nominatim: max 1 req/seg

const buildQueryKey = (direccion) => direccion.trim().toLowerCase();

// Cola simple en memoria para espaciar las llamadas a Nominatim a 1/seg. Alcanza para
// el volumen esperado (10-25 servicios/dia, un solo proceso); si en el futuro hay
// multiples instancias del backend, esto necesitaria un lock distribuido.
let queueTail = Promise.resolve();
const scheduleNominatimCall = (fn) => {
  const run = queueTail.then(async () => {
    const result = await fn();
    await new Promise((resolve) => setTimeout(resolve, NOMINATIM_MIN_INTERVAL_MS));
    return result;
  });
  queueTail = run.catch(() => {});
  return run;
};

const fetchFromNominatim = async (direccion) => {
  const url = new URL("/search", env.NOMINATIM_BASE_URL);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", direccion);

  const response = await fetch(url, {
    headers: { "User-Agent": env.NOMINATIM_USER_AGENT },
  });

  if (!response.ok) {
    throw new AppError(`No se pudo geocodificar la direccion: "${direccion}"`, 422);
  }

  const results = await response.json();
  if (!results.length) {
    throw new AppError(`No se pudo geocodificar la direccion: "${direccion}"`, 422);
  }

  const [first] = results;
  return { lat: Number(first.lat), lng: Number(first.lon), raw: first };
};

export const geocodeAddress = async (direccion) => {
  const queryKey = buildQueryKey(direccion);

  const cached = await prisma.geocodeCache.findUnique({ where: { queryKey } });
  if (cached) return { lat: cached.lat, lng: cached.lng };

  const { lat, lng, raw } = await scheduleNominatimCall(() => fetchFromNominatim(direccion));

  await prisma.geocodeCache.upsert({
    where: { queryKey },
    update: { lat, lng, raw, direccion },
    create: { queryKey, direccion, lat, lng, raw },
  });

  return { lat, lng };
};

// Geocodifica en orden secuencial (respeta el orden de las paradas). Un fallo en
// cualquier direccion interrumpe y propaga el error: es un dato mal cargado por el OWNER.
export const geocodeStops = async (direcciones) => {
  const stops = [];
  for (const direccion of direcciones) {
    const { lat, lng } = await geocodeAddress(direccion);
    stops.push({ direccion, lat, lng });
  }
  return stops;
};
