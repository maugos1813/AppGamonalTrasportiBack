import { prisma } from "../config/prisma.js";

// Evita una fila nueva cada 30-60s mientras el vehiculo sigue sobre el umbral - un
// exceso sostenido (o varios picos en pocos minutos) se agrupa como el mismo episodio.
export const findRecentEventForVehicle = (vehicleId, dedupMinutes) =>
  prisma.speedingEvent.findFirst({
    where: { vehicleId, occurredAt: { gte: new Date(Date.now() - dedupMinutes * 60 * 1000) } },
    select: { id: true },
  });

export const createSpeedingEvent = (vehicleId, targa, speedKmh) =>
  prisma.speedingEvent.create({ data: { vehicleId, targa, speedKmh } });

// Para la campanita de notificaciones - todos los eventos, la retencion (ver
// SPEEDING_EVENT_RETENTION_DAYS) se encarga de que la lista no crezca sin limite.
export const findRecentEvents = () =>
  prisma.speedingEvent.findMany({ orderBy: { occurredAt: "desc" }, take: 100 });

// Retencion: a diferencia de AreaCEntry, no hay "pagado" que exceptuar - se poda todo
// lo viejo, sin excepciones.
export const deleteSpeedingEventsOlderThan = (cutoffDate) =>
  prisma.speedingEvent.deleteMany({ where: { occurredAt: { lt: cutoffDate } } });
