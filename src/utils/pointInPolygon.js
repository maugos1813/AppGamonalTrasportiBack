// Ray casting estandar: cuenta cuantas veces un rayo horizontal desde el punto hacia
// la derecha cruza los lados del poligono - si cruza una cantidad impar de veces, el
// punto esta adentro. polygon es un array de {lat, lng} (un solo anillo, sin agujeros -
// alcanza para Area C, ver AREA_C_PATH en milanoZones.json).
export const pointInPolygon = ({ lat, lng }, polygon) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersects = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
};
