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
