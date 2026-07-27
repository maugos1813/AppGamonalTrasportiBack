// Arma un rango [gte, lt) en UTC para filtrar fechaServicio por year/month/day.
// month y day son 1-indexados (month: 1-12, day: 1-31), como en la URL.
export const buildDateRange = (year, month, day) => {
  if (day) {
    return {
      gte: new Date(Date.UTC(year, month - 1, day)),
      lt: new Date(Date.UTC(year, month - 1, day + 1)),
    };
  }

  if (month) {
    return {
      gte: new Date(Date.UTC(year, month - 1, 1)),
      lt: new Date(Date.UTC(year, month, 1)),
    };
  }

  return {
    gte: new Date(Date.UTC(year, 0, 1)),
    lt: new Date(Date.UTC(year + 1, 0, 1)),
  };
};

// Cuantos minutos hay que sumarle a un instante UTC para obtener su hora de reloj en
// timeZone (offset real de esa fecha, ya resuelto el DST).
const getTimezoneOffsetMinutes = (date, timeZone) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(date)
    .reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});

  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    parts.hour === "24" ? 0 : Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  return (asUTC - date.getTime()) / 60000;
};

// Igual que buildDateRange, pero el rango [gte, lt) queda anclado a la medianoche de
// timeZone (ej: Europe/Rome) en vez de la medianoche UTC. En verano (CEST, UTC+2)
// buildDateRange dejaba afuera los servicios agendados entre las 00:00 y 02:00 hora
// local, porque esa franja todavia cae en el dia UTC anterior.
export const buildLocalDateRange = (year, month, day, timeZone) => {
  // Ancla el calculo del offset al mediodia UTC de ese dia para no pisar un cambio de
  // horario que ocurra justo a la medianoche.
  const offsetMinutes = getTimezoneOffsetMinutes(new Date(Date.UTC(year, month - 1, day, 12)), timeZone);

  return {
    gte: new Date(Date.UTC(year, month - 1, day) - offsetMinutes * 60000),
    lt: new Date(Date.UTC(year, month - 1, day + 1) - offsetMinutes * 60000),
  };
};
