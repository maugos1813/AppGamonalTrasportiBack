import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import { AppError } from "../utils/AppError.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_KEY_PATH = path.join(__dirname, "../../config/google-service-account.json");
const KEY_PATH = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || DEFAULT_KEY_PATH;

// "APP GT 1.0", la planilla que respalda la app de AppSheet que se esta reemplazando.
// Tiene ~59 pestanas (registros, choferes, vehiculos, sueldos, agenda, etc.), asi que
// se referencian por nombre exacto en vez de buscarlas dinamicamente - recorrer las 59
// pestanas en cada sync es lento y ademas varias comparten nombres de columna (ej.
// "Id_Trabajador" aparece en la tabla de choferes Y en una de seguimiento semanal).
export const APPSHEET_SPREADSHEET_ID =
  process.env.APPSHEET_SPREADSHEET_ID || "1ZSNMIT69FJbkV9rsMjFJte8nddqDpSzPS0WG1FXG3hQ";

let sheetsClientPromise = null;

const getSheetsClient = () => {
  if (!sheetsClientPromise) {
    if (!fs.existsSync(KEY_PATH)) {
      throw new AppError(
        `No se encontro la credencial de Google Sheets en ${KEY_PATH}. Falta configurar el Service Account.`,
        500
      );
    }
    const auth = new google.auth.GoogleAuth({
      keyFile: KEY_PATH,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    sheetsClientPromise = auth.getClient().then((authClient) => google.sheets({ version: "v4", auth: authClient }));
  }
  return sheetsClientPromise;
};

// Devuelve { header, rows } de una pestana por su nombre exacto. Algunas pestanas
// (ej. "Hoja 1", "Hoja 2") tienen una primera fila en blanco antes del header real -
// se salta cualquier fila vacia inicial en vez de asumir que el header esta en la fila 1.
export const fetchSheetRowsByTabName = async (tabName, lastColumn = "AZ") => {
  const sheets = await getSheetsClient();
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: APPSHEET_SPREADSHEET_ID,
    range: `'${tabName}'!A:${lastColumn}`,
  });
  const values = data.values ?? [];
  const headerIndex = values.findIndex((row) => row.length > 0);
  if (headerIndex === -1) {
    throw new AppError(`La pestana "${tabName}" esta vacia en la planilla de AppSheet.`, 500);
  }
  const [header, ...rows] = values.slice(headerIndex);
  return { header, rows };
};
