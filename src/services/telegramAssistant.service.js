import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { DEPOT_ORIGIN } from "../constants/depot.js";
import { findClients } from "../models/client.model.js";
import { updateRecordById } from "../models/record.model.js";
import {
  deleteDraft,
  findDraftByChat,
  setPendingPrice,
  upsertDraft,
} from "../models/telegramDraft.model.js";
import { findAllUsers } from "../models/user.model.js";
import { findVehicles } from "../models/vehicle.model.js";
import { createRecord } from "./record.service.js";
import { calculateRoute } from "./routing.service.js";
import { getTimezoneOffsetMinutes } from "../utils/dateRange.js";
import { sendTelegramMessage } from "./telegram.service.js";

const MODEL = "claude-opus-5";
const TIME_ZONE = "Europe/Rome";

const APLICATIVO_VALUES = [
  ...Array.from({ length: 18 }, (_, i) => `MILANO_${i + 1}`),
  ...Array.from({ length: 10 }, (_, i) => `ROMA_${i + 1}`),
];
const SPEDIZZIONE_VALUES = ["DHL", "AB_SERVICE", "EXTRA_PIAZZA", "EXTRAS_STEFANIA"];
const EXTRAS_PIAZZA_ZONA_VALUES = ["MILANO", "ROMA"];

let anthropicClient = null;
const getAnthropicClient = () => {
  if (!env.ANTHROPIC_API_KEY) return null;
  anthropicClient ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return anthropicClient;
};

// Misma logica que buildLocalDateRange (dateRange.js), pero para armar un instante
// puntual en vez de un rango: convierte una fecha/hora que Claude devuelve como hora
// local de Europe/Rome (la app opera ahi, ver el resto del backend) a un Date real en UTC.
const romeLocalToDate = (year, month, day, hour, minute) => {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const offsetMinutes = getTimezoneOffsetMinutes(new Date(guess), TIME_ZONE);
  return new Date(guess - offsetMinutes * 60000);
};

const nowInRome = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(new Date())
    .reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return `${parts.weekday} ${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
};

// El validador de schema "strict" de Claude no acepta type:["string","null"] (lo
// rechaza con 400, "Enum value ... does not match declared type") - hay que expresar
// "string o null" con anyOf en vez del array de tipos.
const nullableString = (extra = {}) => ({ anyOf: [{ type: "string", ...extra }, { type: "null" }] });

const UPDATE_DRAFT_TOOL = {
  name: "update_service_draft",
  description:
    "Actualiza el borrador del servicio a partir del ultimo mensaje del chat y decide que contestar.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      status: {
        type: "string",
        enum: ["need_more_info", "confirm", "ready", "cancelled"],
        description:
          "need_more_info: todavia falta un campo obligatorio, 'reply' pregunta por el. " +
          "confirm: ya estan todos los campos obligatorios, 'reply' es un resumen legible " +
          "pidiendo que confirme con si/no ANTES de cargarlo. ready: el usuario ya confirmo " +
          "el resumen en un mensaje anterior (nunca uses 'ready' sin una confirmacion previa " +
          "explicita del usuario). cancelled: el usuario pidio cancelar/no seguir.",
      },
      reply: { type: "string", description: "Lo que se le contesta al chat." },
      driverId: nullableString({ description: "id exacto de la lista de choferes, o null" }),
      vehicleId: nullableString({ description: "id exacto de la lista de vehiculos, o null" }),
      clientId: nullableString({ description: "id exacto de la lista de clientes, o null" }),
      fecha: nullableString({ description: "YYYY-MM-DD del servicio, hora local Europe/Rome" }),
      hora: nullableString({ description: "HH:mm 24hs de inicio del servicio, hora local Europe/Rome" }),
      etaHora: nullableString({
        description:
          "HH:mm 24hs de la ETA (hora estimada de llegada/entrega) para seguimiento, hora local " +
          "Europe/Rome, mismo dia que 'fecha'. Es un dato DISTINTO de 'hora' aunque a veces coincidan.",
      }),
      descripcion: nullableString(),
      codigo: nullableString({ description: "Solo si el usuario menciona uno explicito" }),
      ciudad: nullableString(),
      aplicativo: nullableString({ enum: APLICATIVO_VALUES }),
      spedizzione: nullableString({ enum: SPEDIZZIONE_VALUES }),
      extrasPiazzaZona: nullableString({ enum: EXTRAS_PIAZZA_ZONA_VALUES }),
      stops: {
        anyOf: [{ type: "array", items: { type: "string" } }, { type: "null" }],
        description: "Ciudades del servicio en orden (no direcciones de calle), al menos 1, sin incluir Peschiera Borromeo si es la primera",
      },
    },
    required: [
      "status",
      "reply",
      "driverId",
      "vehicleId",
      "clientId",
      "fecha",
      "hora",
      "etaHora",
      "descripcion",
      "codigo",
      "ciudad",
      "aplicativo",
      "spedizzione",
      "extrasPiazzaZona",
      "stops",
    ],
  },
};

const buildSystemPrompt = ({ drivers, vehicles, clients }) => `Sos el asistente que carga "servicios" (entregas/viajes) en la app de Gamonal Trasporti a partir de mensajes de Telegram en lenguaje natural, escritos por el dueño de la empresa.

Ahora mismo (hora local Europe/Rome): ${nowInRome()}. Usala para interpretar "hoy", "mañana", "el viernes", etc.

Campos OBLIGATORIOS para poder cargar el servicio: chofer, vehiculo, cliente, fecha, hora de inicio, ETA (hora estimada de llegada/entrega - es un dato aparte de la hora de inicio, se usa para hacer seguimiento del servicio, preguntala siempre aunque coincida con la hora de inicio), descripcion, al menos una ciudad de destino, y el TIPO DE SERVICIO. "codigo" es OPCIONAL, se genera solo si no lo dan.

Direcciones ("stops"): el usuario NO da direcciones exactas de calle, da una secuencia de CIUDADES por donde pasa el servicio, ej: "PESCHIERA BORROMEO - MILANO - SEGRATE - MALPENSA" (separadas por guion, coma, flecha, o como sea). La base/deposito fijo de la empresa es Peschiera Borromeo - el sistema YA arranca y termina ahi solo (ida y vuelta), no hace falta pedirlo ni confirmarlo. En "stops" poné SOLO las ciudades intermedias/de destino EN ORDEN, sacando "Peschiera Borromeo" si aparece como la primera de la lista (es redundante, ya es la base). Si el nombre de una ciudad no se reconoce o es demasiado vago (ej. "por ahi cerca"), pedí (status "need_more_info") que aclaren que ciudad es - no hace falta calle ni numero, con el nombre de la ciudad alcanza.

El tipo de servicio SIEMPRE tiene que quedar definido como uno de estos 5, nunca lo dejes sin decidir - si no es claro por el mensaje, PREGUNTALO (status "need_more_info") antes de pasar a "confirm", es tan obligatorio como el chofer o el cliente (si queda mal clasificado el servicio despues no aparece donde el usuario lo busca en la app):
- "DHL" -> spedizzione=DHL, extrasPiazzaZona=null
- "AB Service" -> spedizzione=AB_SERVICE, extrasPiazzaZona=null
- "Extras Piazza Milano" -> spedizzione=null, extrasPiazzaZona=MILANO
- "Extras Piazza Roma" -> spedizzione=null, extrasPiazzaZona=ROMA
- "Extras Stefania" -> spedizzione=EXTRAS_STEFANIA, extrasPiazzaZona=null

Choferes activos (elegi el id exacto, nunca inventes uno):
${drivers.map((d) => `- id=${d.id} | ${d.nombre} ${d.apellido}`).join("\n") || "(ninguno)"}

Vehiculos:
${vehicles.map((v) => `- id=${v.id} | targa ${v.targa} | ${v.modelo ?? ""}`).join("\n") || "(ninguno)"}

Clientes:
${clients.map((c) => `- id=${c.id} | ${c.nombre}`).join("\n") || "(ninguno)"}

Reglas importantes:
- Para chofer/vehiculo/cliente: buscá una coincidencia contra las listas de arriba TOLERANDO errores de tipeo chicos (1-2 letras de diferencia, orden de nombre/apellido invertido, mayusculas/tildes, etc.) - si el nombre que escribieron se parece claramente a UNA sola persona/vehiculo de la lista, usa ESE id directamente (no hace falta preguntar por una diferencia de tipeo obvia) y despues, en el resumen de status "confirm", mostrá el nombre real tal cual esta en la lista (asi el usuario ve que se corrigio solo). Solo preguntá (status "need_more_info") cuando: (a) hay dos o mas coincidencias igual de razonables y no se puede saber cual quiso decir, o (b) no hay ninguna coincidencia razonable en absoluto.
- Nunca canceles ni abandones el servicio por un dato que falta o no se entiende (fecha, hora, direccion, chofer, vehiculo, cliente, etc.) - siempre usa status "need_more_info" y seguí preguntando en "reply" hasta que estén completos y validos TODOS los campos obligatorios. Solo se cancela (status "cancelled") si el usuario lo pide explicitamente.
- aplicativo es opcional: completalo solo si el mensaje lo menciona claramente, si no dejalo en null - no es motivo para pedir mas info. spedizzione y extrasPiazzaZona en cambio se derivan del tipo de servicio (ver arriba), que SI es obligatorio.
- Antes de cargar de verdad el servicio (status "ready"), primero tenés que pasar por status "confirm": armá un resumen breve y legible de todos los datos juntados (chofer, vehiculo, cliente, fecha/hora, direcciones, etc.) en "reply" y pedile que confirme con si/no. Recien cuando el usuario conteste que si en un mensaje siguiente, usá status "ready" (con un "reply" corto tipo "Cargando el servicio...").
- Si el usuario dice que no, que cancele, o se arrepiente, usá status "cancelled" y confirmalo en "reply".
- Nunca uses "ready" como primera respuesta de una conversacion nueva, siempre tiene que haber pasado por "confirm" antes.
- Si en el chat aparece un mensaje "(sistema: ...)" es un error tecnico (ej. no se pudo ubicar una direccion en el mapa) que le llegó al usuario tal cual - segui la conversacion pidiendo el dato corregido (status "need_more_info"), nunca lo trates como un mensaje del usuario ni lo repitas.
- Tono: directo y breve, como un mensaje de texto real, no un formulario.`;

// Historial simple (texto plano, lo mismo que ve el usuario en el chat) en vez de
// reconstruir los bloques tool_use/tool_result reales de la conversacion anterior -
// no hace falta que Claude "recuerde" la llamada a la tool en si, solo lo que ya se
// dijo en el chat (incluida su propia respuesta de confirmacion con los datos
// juntados hasta ahora), suficiente para retomar el hilo en el mensaje siguiente.
const callClaude = async (messages, referenceData) => {
  const client = getAnthropicClient();
  if (!client) throw new Error("ANTHROPIC_API_KEY no configurada");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: [
      { type: "text", text: buildSystemPrompt(referenceData), cache_control: { type: "ephemeral" } },
    ],
    tools: [{ ...UPDATE_DRAFT_TOOL, strict: true }],
    tool_choice: { type: "tool", name: UPDATE_DRAFT_TOOL.name },
    messages,
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse) throw new Error("Claude no devolvio una respuesta estructurada");
  return toolUse.input;
};

const formatMissingFieldsError = (err) => `No pude cargar el servicio: ${err.message}`;

// Acepta "1.5", "1,5", "1.5 euros", "€1,5", etc. - solo el primer numero que encuentre.
// null si no hay ningun numero valido en el texto.
const parsePriceFromText = (text) => {
  const match = text.replace(",", ".").match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) && value > 0 ? value : null;
};

// Kilometros planificados = ida y vuelta completa a Peschiera Borromeo (DEPOT_ORIGIN),
// pedido explicito: no es el trayecto real que muestra el mapa (ese es un viaje, no
// una vuelta), es la base para el calculo de costo (kilometros x precioKm). La ruta
// depot->paradas ya la calculo createRecord (record.ruta.distanciaKm) - solo hace
// falta el tramo de vuelta (ultima parada -> depot) para completar el circuito.
const calculateRoundTripKm = async (record) => {
  const lastStop = record.stops?.at(-1);
  if (!lastStop || record.ruta?.distanciaKm == null) return null;
  const returnLeg = await calculateRoute([{ lat: lastStop.lat, lng: lastStop.lng }, DEPOT_ORIGIN]);
  if (!returnLeg) return null;
  return Math.round((record.ruta.distanciaKm + returnLeg.distanciaKm) * 10) / 10;
};

// Cuando el chat esta esperando UNICAMENTE el precio por km de un servicio ya cargado
// (ver el final de handleIncomingTelegramMessage) - no pasa por Claude, se parsea el
// numero directo del mensaje.
const handlePendingPrice = async (chatId, recordId, text) => {
  const precioKm = parsePriceFromText(text);
  if (precioKm == null) {
    await sendTelegramMessage(chatId, "No entendi el precio - mandame solo el numero, ej: 1.50");
    return;
  }

  const updated = await updateRecordById(recordId, { precioKm });
  await deleteDraft(chatId);

  const total = updated.kilometros != null ? (updated.kilometros * precioKm).toFixed(2) : null;
  await sendTelegramMessage(
    chatId,
    `Listo, precio por km: ${precioKm}.` +
      (total ? ` Total estimado (${updated.kilometros} km x ${precioKm}): €${total}.` : "")
  );
};

// Punto de entrada del webhook (ver telegram.controller.js) - procesa un mensaje
// entrante de texto plano del chat autorizado, mantiene el hilo de la conversacion en
// TelegramDraft, y crea el Record real cuando el usuario confirma.
export const handleIncomingTelegramMessage = async (chatId, text) => {
  if (!getAnthropicClient()) {
    await sendTelegramMessage(chatId, "El asistente no esta configurado todavia (falta ANTHROPIC_API_KEY).");
    return;
  }

  const pendingDraft = await findDraftByChat(chatId);
  if (pendingDraft?.pendingPriceRecordId) {
    await handlePendingPrice(chatId, pendingDraft.pendingPriceRecordId, text);
    return;
  }

  const [drivers, vehicles, clients] = await Promise.all([
    findAllUsers().then((users) => users.filter((u) => u.cargo === "CHOFER" && u.estado === "ACTIVO")),
    findVehicles(),
    findClients(),
  ]);

  const history = pendingDraft?.messages ?? [];
  const messages = [...history, { role: "user", content: text }];

  let draftUpdate;
  try {
    draftUpdate = await callClaude(messages, { drivers, vehicles, clients });
  } catch (err) {
    console.error("Error consultando a Claude para el asistente de Telegram:", err.message);
    await sendTelegramMessage(chatId, "Tuve un problema entendiendo el mensaje, intenta de nuevo.");
    return;
  }

  const assistantMessages = [...messages, { role: "assistant", content: draftUpdate.reply }];

  if (draftUpdate.status === "cancelled") {
    await deleteDraft(chatId);
    await sendTelegramMessage(chatId, draftUpdate.reply);
    return;
  }

  if (draftUpdate.status !== "ready") {
    await upsertDraft(chatId, assistantMessages);
    await sendTelegramMessage(chatId, draftUpdate.reply);
    return;
  }

  // status === "ready": crear el Record real.
  try {
    const [year, month, day] = draftUpdate.fecha.split("-").map(Number);
    const [hour, minute] = draftUpdate.hora.split(":").map(Number);
    const [etaHour, etaMinute] = draftUpdate.etaHora.split(":").map(Number);
    const fechaServicio = romeLocalToDate(year, month, day, hour, minute);
    const eta = romeLocalToDate(year, month, day, etaHour, etaMinute);

    const record = await createRecord(
      {
        driverId: draftUpdate.driverId,
        vehicleId: draftUpdate.vehicleId,
        clientId: draftUpdate.clientId,
        fechaServicio,
        eta,
        descripcion: draftUpdate.descripcion,
        codigo: draftUpdate.codigo?.trim() || `TG-${randomUUID().slice(0, 8).toUpperCase()}`,
        ciudad: draftUpdate.ciudad ?? undefined,
        aplicativo: draftUpdate.aplicativo ?? undefined,
        spedizzione: draftUpdate.spedizzione ?? undefined,
        extrasPiazzaZona: draftUpdate.extrasPiazzaZona ?? undefined,
        stops: draftUpdate.stops,
      },
      { actor: null }
    );

    const kilometros = await calculateRoundTripKm(record);
    if (kilometros != null) {
      await updateRecordById(record.id, { kilometros });
    }

    // No se borra el draft: queda esperando el precio por km como proximo mensaje
    // (ver handlePendingPrice), no pasa por Claude.
    await setPendingPrice(chatId, record.id);
    await sendTelegramMessage(
      chatId,
      `Servicio cargado (codigo ${record.codigo}).` +
        (kilometros != null
          ? ` Kilometros planificados (ida y vuelta a Peschiera Borromeo): ${kilometros} km. ¿Cual es el precio por km?`
          : " No pude calcular los kilometros planificados solo, cargalo a mano despues en la app.")
    );
  } catch (err) {
    console.error("No se pudo crear el Record desde Telegram:", err.message);
    // No se borra el draft: se guarda la conversacion hasta aca (incluido el error)
    // para que el usuario pueda corregir el dato que fallo (ej. una direccion mal
    // escrita) en el mensaje siguiente sin tener que repetir todo de cero.
    const errorReply = formatMissingFieldsError(err);
    await upsertDraft(chatId, [...assistantMessages, { role: "user", content: `(sistema: ${errorReply})` }]);
    await sendTelegramMessage(chatId, errorReply);
  }
};
