import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { findClients } from "../models/client.model.js";
import { deleteDraft, findDraftByChat, upsertDraft } from "../models/telegramDraft.model.js";
import { findAllUsers } from "../models/user.model.js";
import { findVehicles } from "../models/vehicle.model.js";
import { createRecord } from "./record.service.js";
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
const nullableArray = (items) => ({ anyOf: [{ type: "array", items }, { type: "null" }] });

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
      fecha: nullableString({ description: "YYYY-MM-DD, hora local Europe/Rome" }),
      hora: nullableString({ description: "HH:mm 24hs, hora local Europe/Rome" }),
      descripcion: nullableString(),
      codigo: nullableString({ description: "Solo si el usuario menciona uno explicito" }),
      ciudad: nullableString(),
      aplicativo: nullableString({ enum: APLICATIVO_VALUES }),
      spedizzione: nullableString({ enum: SPEDIZZIONE_VALUES }),
      extrasPiazzaZona: nullableString({ enum: EXTRAS_PIAZZA_ZONA_VALUES }),
      stops: nullableArray({ type: "string" }),
    },
    required: [
      "status",
      "reply",
      "driverId",
      "vehicleId",
      "clientId",
      "fecha",
      "hora",
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

Campos OBLIGATORIOS para poder cargar el servicio: chofer, vehiculo, cliente, fecha, hora, descripcion, y al menos una parada (direccion de destino). "codigo" es OPCIONAL, se genera solo si no lo dan.

Choferes activos (elegi el id exacto, nunca inventes uno):
${drivers.map((d) => `- id=${d.id} | ${d.nombre} ${d.apellido}`).join("\n") || "(ninguno)"}

Vehiculos:
${vehicles.map((v) => `- id=${v.id} | targa ${v.targa} | ${v.modelo ?? ""}`).join("\n") || "(ninguno)"}

Clientes:
${clients.map((c) => `- id=${c.id} | ${c.nombre}`).join("\n") || "(ninguno)"}

Reglas importantes:
- Para chofer/vehiculo/cliente: buscá una coincidencia contra las listas de arriba TOLERANDO errores de tipeo chicos (1-2 letras de diferencia, orden de nombre/apellido invertido, mayusculas/tildes, etc.) - si el nombre que escribieron se parece claramente a UNA sola persona/vehiculo de la lista, usa ESE id directamente (no hace falta preguntar por una diferencia de tipeo obvia) y despues, en el resumen de status "confirm", mostrá el nombre real tal cual esta en la lista (asi el usuario ve que se corrigio solo). Solo preguntá (status "need_more_info") cuando: (a) hay dos o mas coincidencias igual de razonables y no se puede saber cual quiso decir, o (b) no hay ninguna coincidencia razonable en absoluto.
- Nunca canceles ni abandones el servicio por un dato que falta o no se entiende (fecha, hora, direccion, chofer, vehiculo, cliente, etc.) - siempre usa status "need_more_info" y seguí preguntando en "reply" hasta que estén completos y validos TODOS los campos obligatorios. Solo se cancela (status "cancelled") si el usuario lo pide explicitamente.
- Direcciones: si una direccion mencionada es ambigua, incompleta, o no alcanza para ubicarla en un mapa (ej. "cerca del centro", "el de siempre"), NO la uses como esta - pedí (status "need_more_info") que la escriban mas precisa (calle y numero, ciudad).
- aplicativo/spedizzione/extrasPiazzaZona son opcionales: completalos solo si el mensaje los menciona claramente (valores validos en el schema de la tool), si no dejalos en null - nunca son un motivo para pedir mas info.
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

// Punto de entrada del webhook (ver telegram.controller.js) - procesa un mensaje
// entrante de texto plano del chat autorizado, mantiene el hilo de la conversacion en
// TelegramDraft, y crea el Record real cuando el usuario confirma.
export const handleIncomingTelegramMessage = async (chatId, text) => {
  if (!getAnthropicClient()) {
    await sendTelegramMessage(chatId, "El asistente no esta configurado todavia (falta ANTHROPIC_API_KEY).");
    return;
  }

  const [drivers, vehicles, clients, draft] = await Promise.all([
    findAllUsers().then((users) => users.filter((u) => u.cargo === "CHOFER" && u.estado === "ACTIVO")),
    findVehicles(),
    findClients(),
    findDraftByChat(chatId),
  ]);

  const history = draft?.messages ?? [];
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
    const when = romeLocalToDate(year, month, day, hour, minute);

    const record = await createRecord(
      {
        driverId: draftUpdate.driverId,
        vehicleId: draftUpdate.vehicleId,
        clientId: draftUpdate.clientId,
        fechaServicio: when,
        eta: when,
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

    await deleteDraft(chatId);
    await sendTelegramMessage(
      chatId,
      `Servicio cargado (codigo ${record.codigo}). ${draftUpdate.reply ?? ""}`.trim()
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
