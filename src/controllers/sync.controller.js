import { getLastAppsheetSyncState, runAppsheetRegistrosSync } from "../services/appsheetSync.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// from/to (query, ISO date, opcionales): acotan el rango de fecha de servicio a
// sincronizar - para correr el historico grande de a un mes por vez en vez de todo
// junto (ver runAppsheetRegistrosSync). El boton de "Sincronizar ahora" de Mi Perfil
// no manda estos params, asi que sigue sincronizando el rango completo por defecto.
export const syncAppsheetRegistros = asyncHandler(async (req, res) => {
  const fromDate = req.query.from ? new Date(req.query.from) : undefined;
  const toDate = req.query.to ? new Date(req.query.to) : undefined;
  const result = await runAppsheetRegistrosSync({ fromDate, toDate });
  res.status(200).json({ success: true, data: result });
});

export const getAppsheetSyncStatus = asyncHandler(async (req, res) => {
  const state = await getLastAppsheetSyncState();
  res.status(200).json({ success: true, data: { state } });
});
