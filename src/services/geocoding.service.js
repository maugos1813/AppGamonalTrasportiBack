import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

const buildQueryKey = (direccion) => direccion.trim().toLowerCase();

// Estados de Google Geocoding API que no son un resultado valido. OVER_QUERY_LIMIT/
// UNKNOWN_ERROR pueden ser transitorios (cuota momentanea o hiccup del lado de
// Google); el resto son definitivos para esta direccion.
const NO_RESULT_STATUSES = new Set(["ZERO_RESULTS", "INVALID_REQUEST"]);

const fetchFromGoogle = async (direccion) => {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", direccion);
  // Sesga (no filtra de forma estricta) resultados ambiguos hacia Italia, donde
  // opera la empresa; una direccion claramente en otro pais igual resuelve bien.
  url.searchParams.set("region", "it");
  url.searchParams.set("key", env.GOOGLE_MAPS_API_KEY);

  const response = await fetch(url);

  if (!response.ok) {
    console.error(`[geocoding] Google respondio HTTP ${response.status} para "${direccion}"`);
    throw new AppError(`No se pudo geocodificar la direccion: "${direccion}"`, 422);
  }

  const data = await response.json();

  if (data.status === "OK" && data.results?.length) {
    const [first] = data.results;
    return { lat: first.geometry.location.lat, lng: first.geometry.location.lng, raw: first };
  }

  // Se loguea el status/error_message real (cuota excedida, api key invalida, etc.)
  // para poder diagnosticar en los logs de Render sin adivinar la causa.
  console.error(
    `[geocoding] Google status=${data.status} para "${direccion}"${
      data.error_message ? ` - ${data.error_message}` : ""
    }`
  );

  if (NO_RESULT_STATUSES.has(data.status)) {
    throw new AppError(`No se pudo geocodificar la direccion: "${direccion}"`, 422);
  }

  // OVER_QUERY_LIMIT, REQUEST_DENIED, UNKNOWN_ERROR: problema del lado de Google
  // (cuota, api key, etc.), no de la direccion en si.
  throw new AppError(
    "No se pudo geocodificar la direccion en este momento. Intenta de nuevo en unos minutos.",
    422
  );
};

export const geocodeAddress = async (direccion) => {
  const queryKey = buildQueryKey(direccion);

  const cached = await prisma.geocodeCache.findUnique({ where: { queryKey } });
  if (cached) return { lat: cached.lat, lng: cached.lng };

  const { lat, lng, raw } = await fetchFromGoogle(direccion);

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
