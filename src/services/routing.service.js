import { env } from "../config/env.js";

// Calcula distancia/duracion/geometria de la ruta que pasa por "points" en orden
// (points[0] es siempre el deposito). Best-effort: el servidor demo publico de OSRM
// puede fallar o estar caido, y eso NO debe bloquear la creacion/edicion del servicio -
// en ese caso se devuelve null y el registro se guarda igual, sin ruta calculada.
export const calculateRoute = async (points) => {
  try {
    const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
    const url = new URL(`/route/v1/driving/${coords}`, env.OSRM_BASE_URL);
    url.searchParams.set("overview", "full");
    url.searchParams.set("geometries", "geojson");

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (data.code !== "Ok" || !data.routes?.length) return null;

    const [route] = data.routes;
    return {
      distanciaKm: route.distance / 1000,
      duracionMin: route.duration / 60,
      geometria: route.geometry,
    };
  } catch {
    return null;
  }
};
