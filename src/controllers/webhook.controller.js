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

function buildEvaluadosList(evaluados, page = 0, pageSize = 8) {
  const total = evaluados.length;
  const start = page * pageSize;
  const end = start + pageSize;
  const slice = evaluados.slice(start, end);

  const rows = slice.map((e) => ({
    id: `emp_${e.evaluado}`,
    title: String(e.evaluado).slice(0, 24),
    description: String(e.nombre || "").slice(0, 72)
  }));

  if (end < total) {
    rows.push({
      id: "page_next",
      title: "Siguiente",
      description: "Ver más evaluados"
    });
  }

  if (page > 0) {
    rows.push({
      id: "page_prev",
      title: "Anterior",
      description: "Ver evaluados previos"
    });
  }

  return {
    type: "list",
    text: `Selecciona a quién vas a evaluar (página ${page + 1}):`,
    buttonText: "Ver evaluados",
    sections: [
      {
        title: "Evaluados",
        rows
      }
    ]
  };
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

    if (
      /^\d{3,10}$/.test(t) &&
      session.estado !== "LOGIN" &&
      session.evaluador_noemp &&
      Number(t) !== Number(session.evaluador_noemp)
    ) {
      return res.json(msg(
        `Ya tienes una sesión iniciada con el empleado ${session.evaluador_noemp}.\n\n` +
        `Escribe "salir" para cerrar sesión antes de entrar con otro usuario.`
      ));
    }

    // 🔹 1) Reset manual
    if (t.toLowerCase() === "salir" || t.toLowerCase() === "reset") {
    await resetSession(phone);
    return res.json(msg("Sesión reiniciada. Escribe tu *número de empleado* para iniciar."));
    }

    // Comando historial (funciona en cualquier momento)
    if (t.toLowerCase() === "historial") {
      console.log("Entró a comando historial. Session actual:", {
        estado: session.estado,
        evaluador_user: session.evaluador_user,
        evaluador_noemp: session.evaluador_noemp
      });

      if (!session.evaluador_user) {
        console.log("Historial sin login válido");
        return res.json(msg("Primero inicia sesión.\nEscribe tu número de empleado."));
      }

      await updateSession(phone, { estado: "HISTORIAL_MENU" });

      console.log("Historial cambió estado a HISTORIAL_MENU");

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

      const row = await getDetalleById(targetId);
      if (!row) return res.json(msg("No se encontró esa evaluación."));

      return res.json(msg(formatDetalle(row)));
    }

    // 2) Reset automático si escriben número en otro estado
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
      const noemp = String(t).trim().toLowerCase();

        if (!/^[a-zA-Z0-9]+$/.test(noemp)) {
          return res.json(msg("Por favor escribe tu *número de empleado o usuario*."));
        }

      const user = await loginByNoemp(noemp);
      if (!user) {
        return res.json(msg("No. empleado o usuario no encontrado. Intenta de nuevo."));
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
      console.log("Entró a HISTORIAL_MENU con:", t);

      if (t === "1") {
        const rows = await getHistorialByEvaluadorUser(session.evaluador_user, 5);
        const ids = rows.map(r => r.id);

        await updateSession(phone, {
          historial_ids_json: JSON.stringify(ids),
          estado: "TIPO"
        });

        const historialTexto = formatHistorial(rows).slice(0, 700);

        return res.json(msg(
          `Mis últimas 5 evaluaciones:\n\n${historialTexto}\n\n` +
          `Escribe: detalle 1, detalle 2, ... detalle 5.\n\n` +
          `También puedes escribir tu número de empleado para iniciar otra vez.`
        ));
      }

      if (t === "2") {
        const evaluados = await getEvaluadosByUser(session.evaluador_user);
        const page = 0;
        const pageSize = 8;

        const inicio = page * pageSize;
        const fin = inicio + pageSize;

        const lista = evaluados
          .slice(inicio, fin)
          .map((e, i) => `${i + 1}) ${e.evaluado} - ${e.nombre}`)
          .join("\n");

        await updateSession(phone, {
          estado: "HISTORIAL_EVALUADO",
          pagina_historial_evaluados: 0
        });

        let texto = `Selecciona el evaluado para ver sus últimas 5 evaluaciones:\n\n${lista}\n\n`;

        if (evaluados.length > pageSize) {
          texto += `Escribe "siguiente" para ver más evaluados.\n`;
        }

        texto += `Responde con un número del 1 al ${Math.min(pageSize, evaluados.length)}.`;

        return res.json(msg(texto));
      }

      return res.json(msg("Responde 1 o 2:\n1) Mis evaluaciones\n2) De un evaluado"));
    }

    if (session.estado === "HISTORIAL_EVALUADO") {
      console.log("Entró a HISTORIAL_EVALUADO con:", t);

      const evaluados = await getEvaluadosByUser(session.evaluador_user);
      const pageSize = 8;
      let page = Number(session.pagina_historial_evaluados || 0);

      if (t.toLowerCase() === "siguiente") {
        page++;
      }

      if (t.toLowerCase() === "anterior") {
        page = Math.max(0, page - 1);
      }

      if (t.toLowerCase() === "siguiente" || t.toLowerCase() === "anterior") {
        const inicio = page * pageSize;
        const fin = inicio + pageSize;

        const lista = evaluados
          .slice(inicio, fin)
          .map((e, i) => `${i + 1}) ${e.evaluado} - ${e.nombre}`)
          .join("\n");

        await updateSession(phone, {
          pagina_historial_evaluados: page
        });

        let texto = `Selecciona el evaluado para ver sus últimas 5 evaluaciones:\n\n${lista}\n\n`;

        if (page > 0) {
          texto += `Escribe "anterior" para regresar.\n`;
        }

        if (fin < evaluados.length) {
          texto += `Escribe "siguiente" para ver más evaluados.\n`;
        }

        texto += `Responde con un número del 1 al ${Math.min(pageSize, evaluados.slice(inicio, fin).length)}.`;

        return res.json(msg(texto));
      }

      const inicio = page * pageSize;
      const fin = inicio + pageSize;
      const listaReducida = evaluados.slice(inicio, fin);
      const idx = Number(t) - 1;

      if (Number.isNaN(idx) || idx < 0 || idx >= listaReducida.length) {
        return res.json(msg("Selecciona un número válido, o escribe siguiente/anterior."));
      }

      const elegido = listaReducida[idx];
      const rows = await getHistorialByEvaluadoNoemp(elegido.evaluado, 5);
      const ids = rows.map(r => r.id);

      await updateSession(phone, {
        historial_ids_json: JSON.stringify(ids),
        estado: "TIPO",
        pagina_historial_evaluados: 0
      });

      const historialTexto = formatHistorial(rows).slice(0, 700);

      return res.json(msg(
        `Últimas 5 evaluaciones de:\n${elegido.evaluado} - ${elegido.nombre}\n\n` +
        `${historialTexto}\n\n` +
        `Escribe: detalle 1, detalle 2, ... detalle 5.\n\n` +
        `También puedes escribir tu número de empleado para iniciar otra vez.`
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

      const rows = evaluados.slice(0, 8).map((e) => ({
        id: `emp_${e.evaluado}`,
        title: String(e.evaluado).slice(0, 24),
        description: String(e.nombre || "").slice(0, 72)
      }));

      const sections = [
        {
          title: "Evaluados",
          rows
        }
      ];

      if (evaluados.length > 9) {
        rows.push({
          id: "page_next",
          title: "Siguiente",
          description: "Ver más evaluados"
        });
      }

      await updateSession(phone, {
        estado: "EVALUADO",
        tipo_eval,
        pagina_evaluados: 0
      });

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
      const page = Number(session.pagina_evaluados || 0);
      const pageSize = 8;

      // navegación
      if (t === "page_next") {
        const nextPage = page + 1;
        const start = nextPage * pageSize;
        const end = start + pageSize;

        const rows = evaluados.slice(start, end).map((e) => ({
          id: `emp_${e.evaluado}`,
          title: String(e.evaluado).slice(0, 24),
          description: String(e.nombre || "").slice(0, 72)
        }));

        if (end < evaluados.length) {
          rows.push({
            id: "page_next",
            title: "Siguiente",
            description: "Ver más evaluados"
          });
        }

        if (nextPage > 0) {
          rows.push({
            id: "page_prev",
            title: "Anterior",
            description: "Ver evaluados previos"
          });
        }

        const sections = [
          {
            title: "Evaluados",
            rows
          }
        ];

        await updateSession(phone, { pagina_evaluados: nextPage });

        const reply = {
          type: "list",
          text: `Selecciona a quién vas a evaluar (página ${nextPage + 1}):`,
          buttonText: "Ver evaluados",
          sections
        };

        if ((process.env.WHATSAPP_MODE || "sim") === "sim") {
          return res.json(reply);
        }

        await replyToUser(phone, reply);
        return res.sendStatus(200);
      }

      if (t === "page_prev") {
        const prevPage = Math.max(0, page - 1);
        const start = prevPage * pageSize;
        const end = start + pageSize;

        const rows = evaluados.slice(start, end).map((e) => ({
          id: `emp_${e.evaluado}`,
          title: String(e.evaluado).slice(0, 24),
          description: String(e.nombre || "").slice(0, 72)
        }));

        if (end < evaluados.length) {
          rows.push({
            id: "page_next",
            title: "Siguiente",
            description: "Ver más evaluados"
          });
        }

        if (prevPage > 0) {
          rows.push({
            id: "page_prev",
            title: "Anterior",
            description: "Ver evaluados previos"
          });
        }

        const sections = [
          {
            title: "Evaluados",
            rows
          }
        ];

        await updateSession(phone, { pagina_evaluados: prevPage });

        const reply = {
          type: "list",
          text: `Selecciona a quién vas a evaluar (página ${prevPage + 1}):`,
          buttonText: "Ver evaluados",
          sections
        };

        if ((process.env.WHATSAPP_MODE || "sim") === "sim") {
          return res.json(reply);
        }

        await replyToUser(phone, reply);
        return res.sendStatus(200);
      }

      // selección real del evaluado
      let elegido = null;

      if (/^emp_\d+$/.test(t)) {
        const noemp = t.replace("emp_", "");
        elegido = evaluados.find(e => String(e.evaluado) === String(noemp));
      } else if (/^\d+$/.test(t)) {
        elegido = evaluados.find(e => String(e.evaluado) === String(t));
      }

      if (!elegido) {
        const start = page * pageSize;
        const end = start + pageSize;

        const rows = evaluados.slice(start, end).map((e) => ({
          id: `emp_${e.evaluado}`,
          title: String(e.evaluado).slice(0, 24),
          description: String(e.nombre || "").slice(0, 72)
        }));

        if (end < evaluados.length) {
          rows.push({
            id: "page_next",
            title: "Siguiente",
            description: "Ver más evaluados"
          });
        }

        if (page > 0) {
          rows.push({
            id: "page_prev",
            title: "Anterior",
            description: "Ver evaluados previos"
          });
        }

        const sections = [
          {
            title: "Evaluados",
            rows
          }
        ];

        const reply = {
          type: "list",
          text: `Selecciona un evaluado válido (página ${page + 1}):`,
          buttonText: "Ver evaluados",
          sections
        };

        if ((process.env.WHATSAPP_MODE || "sim") === "sim") {
          return res.json(reply);
        }

        await replyToUser(phone, reply);
        return res.sendStatus(200);
      }

      await updateSession(phone, {
        estado: "PREGUNTA",
        evaluado_noemp: elegido.evaluado,
        evaluado_nombre: elegido.nombre,
        evaluado_puesto: elegido.puesto || "",
        tipo: elegido.tipo,
        pregunta_actual: 1,
        respuestas_json: {},
        comentario: null
      });

      const reply = {
        type: "buttons",
        text: `Evaluando a: ${elegido.nombre}\n\nPregunta 1/18:\n${PREGUNTAS[0]}`,
        buttons: [
          { id: "resp_1_1", title: "Bajo" },
          { id: "resp_1_2", title: "Medio" },
          { id: "resp_1_3", title: "Alto" }
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
        let preguntaRespondida = null;

        if (/^resp_\d+_[123]$/.test(t)) {
          const partes = t.split("_");
          preguntaRespondida = Number(partes[1]);
          val = Number(partes[2]);
        } else if (t === "1" || t === "2" || t === "3") {
          // opcional: permitir texto/manual
          preguntaRespondida = q;
          val = Number(t);
        }

        if (preguntaRespondida !== q) {
          return res.json(msg(
            `Esa respuesta ya no corresponde a la pregunta actual.\n\nPregunta ${q}/18:\n${PREGUNTAS[q - 1]}\n\nResponde: 1=Bajo, 2=Medio, 3=Alto`
          ));
        }

      if (![1, 2, 3].includes(val)) {
        const reply = {
          type: "buttons",
          text: `Pregunta ${q}/18:\n${PREGUNTAS[q - 1]}`,
          buttons: [
            { id: `resp_${q}_1`, title: "Bajo" },
            { id: `resp_${q}_2`, title: "Medio" },
            { id: `resp_${q}_3`, title: "Alto" }
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
            { id: `resp_${nextQ}_1`, title: "Bajo" },
            { id: `resp_${nextQ}_2`, title: "Medio" },
            { id: `resp_${nextQ}_3`, title: "Alto" }
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
          text: `Listo ✅\nEscribe tu comentario para "${session.evaluado_nombre}" o escribe 0 para omitir.`
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
          `Resumen de evaluación para: ${session.evaluado_nombre}:\n${resumen}\n\n¿Guardar evaluación?`,
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

      const respuestasGuard =
        typeof session.respuestas_json === "string"
          ? JSON.parse(session.respuestas_json || "{}")
          : (session.respuestas_json || {});

      const totalRespondidas = Object.keys(respuestasGuard).length;

      if (totalRespondidas < 18) {
        return res.json(msg(
          `Aún faltan preguntas por responder.\n\n` +
          `Respondidas: ${totalRespondidas}/18`
        ));
      }

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
    console.error("ERORR en handleWebhookSim:", err);
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

const processedMessageIds = new Map();

function cleanupProcessedMessages() {
  const now = Date.now();
  const ttl = 10 * 60 * 1000; // 10 minutos

  for (const [id, ts] of processedMessageIds.entries()) {
    if (now - ts > ttl) {
      processedMessageIds.delete(id);
    }
  }
}

exports.receiveWebhook = async (req, res) => {
  try {
    cleanupProcessedMessages();

    const body = req.body;

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value || {};

    // Ignorar cualquier cosa que no sea evento de mensajes
    if (changes?.field !== "messages") {
      return res.sendStatus(200);
    }

    // Ignorar estados de enviado, entregado, leído, etc.
    if (value.statuses?.length && !value.messages?.length) {
      return res.sendStatus(200);
    }

    if (!value.messages || !Array.isArray(value.messages) || value.messages.length === 0) {
      return res.sendStatus(200);
    }

    const msgData = value.messages[0];
    const from = msgData.from;
    const messageId = msgData.id;

    // Evitar procesar dos veces el mismo mensaje
    if (messageId && processedMessageIds.has(messageId)) {
      return res.sendStatus(200);
    }

    let text = "";

    if (msgData.type === "text") {
      text = msgData.text?.body?.trim() || "";
    } else if (msgData.type === "interactive") {
      if (msgData.interactive?.button_reply?.id) {
        text = msgData.interactive.button_reply.id;
      } else if (msgData.interactive?.list_reply?.id) {
        text = msgData.interactive.list_reply.id;
      } else if (msgData.interactive?.button_reply?.title) {
        text = msgData.interactive.button_reply.title;
      } else if (msgData.interactive?.list_reply?.title) {
        text = msgData.interactive.list_reply.title;
      }
    } else {
      // Ignorar otros tipos de mensaje
      return res.sendStatus(200);
    }

    if (!from || !text) {
      return res.sendStatus(200);
    }

    // Marcar este mensaje como procesado
    if (messageId) {
      processedMessageIds.set(messageId, Date.now());
    }

    const fakeReq = {
      body: {
        phone: from,
        text
      }
    };

    let botReply = null;

    const fakeRes = {
      json(payload) {
        console.log("fakeRes.json payload:", payload);
        botReply = payload?.reply || null;
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

    console.log("botReply final:", botReply);

    if (botReply) {
      await sendWhatsAppText(from, String(botReply));
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error("Error en receiveWebhook:", error);
    try {
      if (req?.body) {
        console.error("BODY RECIBIDO:", JSON.stringify(req.body, null, 2));
      }
    } catch (_) {}
    return res.sendStatus(500);
  }
};