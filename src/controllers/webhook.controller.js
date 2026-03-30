const {
  getOrCreateSession,
  updateSession,
  resetSession,
} = require("../services/botSession.service");

const { loginByNoemp } = require("../services/auth.service");
const { getEvaluadosByUser } = require("../services/evaluados.service");
const { saveEvaluacionDesempeno } = require("../services/evaluation.save.service");
const { buildResumen } = require("../services/resumen.service");
const {
  getHistorialByEvaluadorUser,
  getHistorialByEvaluadoNoemp,
  formatHistorial
} = require("../services/historial.service");
const { getDetalleById } = require("../services/detalle.service");
const { formatDetalle } = require("../services/detalle.format");
const {
  sendWhatsAppText,
  sendWhatsAppButtons,
  sendWhatsAppList,
} = require("../services/whatsapp.service");

// Texto de tus 18 preguntas (en orden)
const PREGUNTAS = [
  // RESPONSABILIDAD (1-3)
  "Respeta las normas, reglamentos, instrucciones y disposiciones para lograr el impacto requerido en el puesto.",
  "Cumple con las funciones y obligaciones asignadas en el puesto.",
  "Obtiene resultados de acuerdo con los objetivos del puesto.",
  // COMUNICACIÓN E INFLUENCIA (4-6)
  "Se comunica de manera simple, concisa y consistente.",
  "Usa hechos y argumentos racionales para influenciar y convencer.",
  "Usa su conocimiento del medio ambiente interno y externo para anticiparse a la reacción de su audiencia y adapta su comunicación de acuerdo con la situación.",
  // VISIÓN Y ESTRATEGIA (7-9)
  "Piensa más allá de su propia función y entiende interacciones complejas del negocio.",
  "Desarrolla y comunica una clara visión y estrategias.",
  "Actualiza las estrategias y se anticipa a los cambios que impactan al negocio.",
  // LIDERA Y ENTRENA (10-12)
  "Evalúa fortalezas y áreas de desarrollo de su gente y ejecuta con ellas un plan de acción.",
  "Reconoce y recompensa el buen desempeño, así como confronta sus áreas de oportunidad y carencia de resultados.",
  "Crea oportunidades de aprendizaje continuamente y estimula a su gente a que también las creen para desarrollar a otros compañeros.",
  // ORIENTACIÓN A RESULTADOS (13-15)
  "Siempre establece objetivos personales y de equipo alineados con los de la compañía.",
  "Toma la iniciativa para eliminar procesos que no agregan valor en su puesto y en la organización.",
  "Hace lo que tiene que hacer aún cuando se enfrenta con decisiones difíciles y toma las acciones necesarias para cumplir objetivos establecidos.",
  // ASISTENCIA Y PUNTUALIDAD (16-18)
  "Actitud positiva de presentarse a trabajar a la hora establecida y al cumplimiento de las actividades de su puesto.",
  "Es puntual a la hora de entrada, solo excepcionalmente llega tarde y sus retardos tienen una causa justificada.",
  "Acude con puntualidad a la hora de entrada y a sus compromisos de trabajo."
];

const SESSION_TIMEOUT_MINUTES = 24 * 60; // 24 horas

function msg(text, data = {}) {
  return { reply: text, ...data };
}

function safeJsonParse(value) {
  if (value == null) return {};
  if (typeof value === "object") return value;

  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return {};
    const parsed = JSON.parse(s);

    // Si MySQL guardó un JSON-string con un JSON dentro, parsea 2 veces
    if (typeof parsed === "string" && (parsed.trim().startsWith("{") || parsed.trim().startsWith("["))) {
      return JSON.parse(parsed);
    }
    return parsed;
  }

  return {};
}

function sendBotReply(res, text) {
  return res.json(msg(text));
}

async function replyToUser(phone, reply) {
  const mode = process.env.WHATSAPP_MODE || "sim";

  if (mode === "sim") {
    return { reply };
  }

  if (reply.type === "text") {
    await sendWhatsAppText(phone, reply.text);
    return null;
  }

  if (reply.type === "buttons") {
    await sendWhatsAppButtons(phone, reply.text, reply.buttons);
    return null;
  }

  if (reply.type === "list") {
    await sendWhatsAppList(phone, reply.text, reply.buttonText, reply.sections);
    return null;
  }

  await sendWhatsAppText(phone, "Ocurrió un error al responder.");
  return null;
}

exports.handleWebhookSim = async (req, res) => {
  try {
    // Simulación simple: phone y text
    const { phone, text } = req.body;
    if (!phone || !text) {
      return res.status(400).json({ ok: false, error: "Enviar { phone, text }" });
    }

    const session = await getOrCreateSession(phone);
    // ✅ Expiración por inactividad (ej. 24 horas)
    if (session.estado !== "LOGIN" && session.updated_at) {
      const last = new Date(session.updated_at);
      const now = new Date();
      const diffMinutes = (now - last) / (1000 * 60);

      if (diffMinutes > SESSION_TIMEOUT_MINUTES) {
        await resetSession(phone);
        return res.json(msg(
          "Tu sesión anterior expiró por inactividad ✅\nEscribe tu *número de empleado* para iniciar de nuevo."
        ));
      }
    }

    // Comandos útiles
    const t = String(text).trim();
    // 🔹 1) Reset manual
    if (t.toLowerCase() === "salir" || t.toLowerCase() === "reset") {
    await resetSession(phone);
    return res.json(msg("Sesión reiniciada. Escribe tu *número de empleado* para iniciar."));
    }

    // Comando historial (funciona en cualquier momento)
    if (t.toLowerCase() === "historial") {
    // si no ha hecho login todavía, pedimos noemp
    if (!session.evaluador_user) {
        return res.json(msg("Primero inicia sesión.\nEscribe tu *número de empleado*."));
    }

    await updateSession(phone, { estado: "HISTORIAL_MENU" });
    return res.json(msg(
        "Historial (últimas 5):\n1) Mis evaluaciones (como evaluador)\n2) De un evaluado (seleccionar)\n\nResponde 1 o 2."
    ));
    }

    // ✅ Comando: detalle N (usa el último historial mostrado)
    if (t.toLowerCase().startsWith("detalle")) {
      // ejemplo: "detalle 3"
      const parts = t.trim().split(/\s+/);
      const n = Number(parts[1]);

      if (!n || Number.isNaN(n) || n < 1 || n > 5) {
        return res.json(msg('Usa: "detalle 1" ... "detalle 5"'));
      }

      // --- leer ids guardados en sesión (puede venir string JSON o array) ---
      let ids = session.historial_ids_json;

      if (typeof ids === "string") {
        try { ids = JSON.parse(ids); } catch { ids = []; }
      }
      if (!Array.isArray(ids)) ids = [];

      if (ids.length === 0) {
        return res.json(msg('Primero ejecuta "historial" para generar la lista.'));
      }

      const targetId = ids[n - 1];
      if (!targetId) {
        return res.json(msg("Ese detalle no existe. Intenta con 1 a 5."));
      }

      // ⚠️ Aquí llamas a tu servicio que trae el detalle por ID
      // (si aún no lo tienes, dímelo y te lo doy)
      const row = await getDetalleById(targetId);
      if (!row) return res.json(msg("No se encontró esa evaluación."));

      return res.json(msg(formatDetalle(row)));
    }

    // 🔹 2) Reset automático si escriben número en otro estado
    if (/^\d{3,10}$/.test(t) && session.estado !== "LOGIN") {
    await resetSession(phone);
    return res.json(msg("Sesión reiniciada. Escribe tu *número de empleado* para iniciar."));
    }

    if (t.toLowerCase() === "continuar") {
      if (session.estado === "PREGUNTA" && session.pregunta_actual >= 1 && session.pregunta_actual <= 18) {
        const q = session.pregunta_actual;
        return res.json(msg(
          `Sigues en la evaluación ✅\nPregunta ${q}/18:\n${PREGUNTAS[q - 1]}\n\nResponde: 1=Bajo, 2=Medio, 3=Alto`
        ));
      }

      if (session.estado === "COMENTARIO") {
        return res.json(msg('Sigues en comentarios ✅\nEscribe tu comentario o escribe 0 para omitir.'));
      }

      if (session.estado === "RESUMEN") {
        return res.json(msg("Sigues en confirmación ✅\n¿Guardar evaluación?\n1) Guardar\n2) Cancelar"));
      }

      return res.json(msg("No tienes una evaluación en curso. Escribe tu *número de empleado* para iniciar."));
    }
    
    // Flujo por estados
    if (session.estado === "LOGIN") {
      const noemp = Number(t);
      if (!noemp || Number.isNaN(noemp)) {
        return res.json(msg("Por favor escribe tu *número de empleado* (solo números)."));
      }

      const user = await loginByNoemp(noemp);
      if (!user) {
        return res.json(msg("No. empleado no encontrado. Intenta de nuevo."));
      }

      // (mínimo de seguridad) validar que tenga evaluados asignados
      const evaluados = await getEvaluadosByUser(user.user);
      if (!evaluados || evaluados.length === 0) {
        return res.json(msg("No tienes evaluados asignados. Contacta a RH."));
      }

      await updateSession(phone, {
        estado: "TIPO",
        evaluador_user: user.user,
        evaluador_noemp: user.Noemp,
      });

      const reply = {
        type: "buttons",
        text: `Hola ${user.Nombre} 👋\nSelecciona tipo de evaluación:`,
        buttons: [
          { id: "tipo_normal", title: "NORMAL" },
          { id: "tipo_extra", title: "EXTRA" }
        ]
      };

      if ((process.env.WHATSAPP_MODE || "sim") === "sim") {
        return res.json(reply);
      }

      await replyToUser(phone, reply);
      return res.sendStatus(200);
    }

    if (session.estado === "HISTORIAL_MENU") {
      if (t === "1") {
        const rows = await getHistorialByEvaluadorUser(session.evaluador_user, 5);
        const ids = rows.map(r => r.id);

        await updateSession(phone, {
          historial_ids_json: JSON.stringify(ids),
          estado: "TIPO"
        });

        return res.json(msg(
          `📌 Mis últimas 5 evaluaciones:\n\n${formatHistorial(rows)}\n\n` +
          `Escribe: *detalle 1* (o *detalle 2*, etc.)\n\n` +
          `Puedes escribir "historial" otra vez o continuar.\n` +
          `Tipo evaluación:\n1) NORMAL\n2) EXTRA`
        ));
      }

      if (t === "2") {
        const evaluados = await getEvaluadosByUser(session.evaluador_user);
        const lista = evaluados
          .map((e, i) => `${i + 1}) ${e.evaluado} - ${e.nombre} (${e.puesto})`)
          .join("\n");

        await updateSession(phone, { estado: "HISTORIAL_EVALUADO" });

        return res.json(msg(
          `Selecciona el evaluado para ver sus últimas 5 evaluaciones:\n${lista}\n\nResponde con el número.`
        ));
      }

      return res.json(msg("Responde 1 o 2:\n1) Mis evaluaciones\n2) De un evaluado"));
    }

    if (session.estado === "HISTORIAL_EVALUADO") {
      const evaluados = await getEvaluadosByUser(session.evaluador_user);
      const idx = Number(t) - 1;

      if (Number.isNaN(idx) || idx < 0 || idx >= evaluados.length) {
        return res.json(msg("Selecciona un número válido de la lista."));
      }

      const elegido = evaluados[idx];
      const rows = await getHistorialByEvaluadoNoemp(elegido.evaluado, 5);
      const ids = rows.map(r => r.id);

      await updateSession(phone, {
        historial_ids_json: JSON.stringify(ids),
        estado: "TIPO"
      });

      return res.json(msg(
        `📌 Últimas 5 evaluaciones de:\n${elegido.evaluado} - ${elegido.nombre}\n\n` +
        `${formatHistorial(rows)}\n\n` +
        `Escribe: *detalle 1* (o *detalle 2*, etc.)\n\n` +
        `Puedes escribir "historial" otra vez o continuar.\n` +
        `Tipo evaluación:\n1) NORMAL\n2) EXTRA`
      ));
    }

    if (session.estado === "TIPO") {
      let tipo_eval = null;

      if (t === "1" || t === "tipo_normal") tipo_eval = "NORMAL";
      if (t === "2" || t === "tipo_extra") tipo_eval = "EXTRA";

      if (!tipo_eval) {
        const reply = {
          type: "buttons",
          text: "Selecciona tipo de evaluación:",
          buttons: [
            { id: "tipo_normal", title: "NORMAL" },
            { id: "tipo_extra", title: "EXTRA" }
          ]
        };

        if ((process.env.WHATSAPP_MODE || "sim") === "sim") {
          return res.json(reply);
        }

        await replyToUser(phone, reply);
        return res.sendStatus(200);
      }

      const evaluados = await getEvaluadosByUser(session.evaluador_user);

      const rows = evaluados.slice(0, 10).map((e, i) => ({
        id: `eval_${i + 1}`,
        title: String(e.evaluado).slice(0, 24),
        description: String(e.nombre || "").slice(0, 72)
      }));

      const sections = [
        {
          title: "Evaluados",
          rows
        }
      ];

      await updateSession(phone, { estado: "EVALUADO", tipo_eval });

      const reply = {
        type: "list",
        text: "Selecciona a quién vas a evaluar (Primeros 10):",
        buttonText: "Ver evaluados",
        sections
      };

      if ((process.env.WHATSAPP_MODE || "sim") === "sim") {
        return res.json(reply);
      }

      await replyToUser(phone, reply);
      return res.sendStatus(200);
    }

    if (session.estado === "EVALUADO") {
      const evaluados = await getEvaluadosByUser(session.evaluador_user);

      let idx = -1;

      if (/^eval_\d+$/.test(t)) {
        idx = Number(t.split("_")[1]) - 1;
      } else {
        idx = Number(t) - 1;
      }

      if (Number.isNaN(idx) || idx < 0 || idx >= evaluados.length) {
        const rows = evaluados.slice(0, 10).map((e, i) => ({
        id: `eval_${i + 1}`,
        title: String(e.evaluado).slice(0, 24),
        description: String(e.nombre || "").slice(0, 72)
      }));

      const sections = [
        {
          title: "Evaluados",
          rows
        }
      ];

        const reply = {
          type: "list",
          text: "Selecciona un evaluado válido (Primeros 10):",
          buttonText: "Ver evaluados",
          sections
        };

        if ((process.env.WHATSAPP_MODE || "sim") === "sim") {
          return res.json(reply);
        }

        await replyToUser(phone, reply);
        return res.sendStatus(200);
      }

      const elegido = evaluados[idx];

      await updateSession(phone, {
        estado: "PREGUNTA",
        evaluado_noemp: elegido.evaluado,
        tipo: elegido.tipo,
        pregunta_actual: 1,
        respuestas_json: {},
        comentario: null
      });

      const reply = {
        type: "buttons",
        text: `Evaluando a: ${elegido.nombre}\n\nPregunta 1/18:\n${PREGUNTAS[0]}`,
        buttons: [
          { id: "resp_1", title: "Bajo" },
          { id: "resp_2", title: "Medio" },
          { id: "resp_3", title: "Alto" }
        ]
      };

      if ((process.env.WHATSAPP_MODE || "sim") === "sim") {
        return res.json(reply);
      }

      await replyToUser(phone, reply);
      return res.sendStatus(200);
    }

    if (session.estado === "PREGUNTA") {
      const q = Number(session.pregunta_actual);

      let val = null;
      if (t === "1" || t === "resp_1") val = 1;
      if (t === "2" || t === "resp_2") val = 2;
      if (t === "3" || t === "resp_3") val = 3;

      if (![1, 2, 3].includes(val)) {
        const reply = {
          type: "buttons",
          text: `Pregunta ${q}/18:\n${PREGUNTAS[q - 1]}`,
          buttons: [
            { id: "resp_1", title: "Bajo" },
            { id: "resp_2", title: "Medio" },
            { id: "resp_3", title: "Alto" }
          ]
        };

        if ((process.env.WHATSAPP_MODE || "sim") === "sim") {
          return res.json(reply);
        }

        await replyToUser(phone, reply);
        return res.sendStatus(200);
      }

      let respuestas = safeJsonParse(session.respuestas_json);
      if (typeof respuestas !== "object" || respuestas === null || Array.isArray(respuestas)) {
        respuestas = {};
      }

      respuestas[String(q)] = val;

      if (q < 18) {
        const nextQ = q + 1;

        await updateSession(phone, {
          respuestas_json: respuestas,
          pregunta_actual: nextQ
        });

        const reply = {
          type: "buttons",
          text: `Pregunta ${nextQ}/18:\n${PREGUNTAS[nextQ - 1]}`,
          buttons: [
            { id: "resp_1", title: "Bajo" },
            { id: "resp_2", title: "Medio" },
            { id: "resp_3", title: "Alto" }
          ]
        };

        if ((process.env.WHATSAPP_MODE || "sim") === "sim") {
          return res.json(reply);
        }

        await replyToUser(phone, reply);
        return res.sendStatus(200);
      } else {
        await updateSession(phone, {
          respuestas_json: respuestas,
          estado: "COMENTARIO"
        });

        const reply = {
          type: "text",
          text: "Listo ✅\nEscribe tu comentario o escribe 0 para omitir."
        };

        if ((process.env.WHATSAPP_MODE || "sim") === "sim") {
          return res.json(reply);
        }

        await replyToUser(phone, reply);
        return res.sendStatus(200);
      }
    }

    if (session.estado === "COMENTARIO") {
      const comentario = t === "0" ? "" : t;

      // construir arreglo de 18 respuestas en orden
      const respuestasObj = safeJsonParse(session.respuestas_json);
      const respuestasArr = Array.from({ length: 18 }, (_, i) =>
        Number(respuestasObj[String(i + 1)] || 0)
      );

      const resumen = buildResumen(respuestasArr);

      await updateSession(phone, {
        comentario,
        estado: "RESUMEN"
      });

      const reply = {
        type: "buttons",
        text:
          `Resumen:\n${resumen}\n\n¿Guardar evaluación?`,
        buttons: [
          { id: "guardar_eval", title: "Guardar" },
          { id: "cancelar_eval", title: "Cancelar" }
        ]
      };

      if ((process.env.WHATSAPP_MODE || "sim") === "sim") {
        return res.json(reply);
      }

      await replyToUser(phone, reply);
      return res.sendStatus(200);
    }

    if (session.estado === "RESUMEN") {
      const guardar = (t === "1" || t === "guardar_eval");
      const cancelar = (t === "2" || t === "cancelar_eval");

      if (cancelar) {
        await resetSession(phone);

        const reply = {
          type: "text",
          text: "Evaluación cancelada. Escribe tu *número de empleado* para iniciar otra."
        };

        if ((process.env.WHATSAPP_MODE || "sim") === "sim") {
          return res.json(reply);
        }

        await replyToUser(phone, reply);
        return res.sendStatus(200);
      }

      if (!guardar) {
        const reply = {
          type: "buttons",
          text: "¿Guardar evaluación?",
          buttons: [
            { id: "guardar_eval", title: "Guardar" },
            { id: "cancelar_eval", title: "Cancelar" }
          ]
        };

        if ((process.env.WHATSAPP_MODE || "sim") === "sim") {
          return res.json(reply);
        }

        await replyToUser(phone, reply);
        return res.sendStatus(200);
      }

      const respuestasObj = safeJsonParse(session.respuestas_json);
      const respuestasArr = Array.from({ length: 18 }, (_, i) =>
        Number(respuestasObj[String(i + 1)] || 0)
      );

      const saved = await saveEvaluacionDesempeno({
        evaluador_user: session.evaluador_user,
        evaluado_noemp: session.evaluado_noemp,
        tipo: session.tipo,
        tipo_eval: session.tipo_eval,
        respuestas: respuestasArr,
        comentario: session.comentario || ""
      });

      await resetSession(phone);

      const reply = {
        type: "text",
        text: `✅ Evaluación guardada con ID: ${saved.id}\nEscribe tu *número de empleado* para iniciar otra.`
      };

      if ((process.env.WHATSAPP_MODE || "sim") === "sim") {
        return res.json(reply);
      }

      await replyToUser(phone, reply);
      return res.sendStatus(200);
    }

    // fallback
    await resetSession(phone);
    return res.json(msg("Sesión reiniciada. Escribe tu *número de empleado* para iniciar."));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};

exports.verifyWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    console.log("✅ Webhook verificado con Meta");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
};

exports.receiveWebhook = async (req, res) => {
  try {
    const body = req.body;

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value || !value.messages || !Array.isArray(value.messages)) {
      return res.sendStatus(200);
    }

    const msgData = value.messages[0];
    const from = msgData.from;
    let text = "";

    if (msgData.type === "text") {
      text = msgData.text?.body || "";
    }

    if (msgData.type === "interactive") {
      if (msgData.interactive?.button_reply?.id) {
        text = msgData.interactive.button_reply.id;
      } else if (msgData.interactive?.list_reply?.id) {
        text = msgData.interactive.list_reply.id;
      }
    }

    if (!from || !text) {
      return res.sendStatus(200);
    }

    // Reutilizamos la lógica del bot simulando request interno
    const fakeReq = {
      body: {
        phone: from,
        text: text
      }
    };

    let botReply = null;

    const fakeRes = {
      json(payload) {
        botReply = payload;
        return payload;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      sendStatus(code) {
        this.statusCode = code;
        return this;
      }
    };

    await exports.handleWebhookSim(fakeReq, fakeRes);

    if (botReply) {
      await replyToUser(from, botReply);
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error("Error en receiveWebhook:", error);
    return res.sendStatus(500);
  }
};