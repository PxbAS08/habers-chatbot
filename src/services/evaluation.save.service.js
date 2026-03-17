// src/services/evaluation.save.service.js
const db = require("../config/database");
const { getPeriodoFromDate } = require("../utils/periodo"); // <-- ajusta si tu función se llama diferente

async function saveEvaluacionDesempeno(payload) {
  const {
    evaluador_user,
    evaluado_noemp,
    tipo,
    tipo_eval,      // <-- NUEVO
    respuestas,
    comentario,
  } = payload;

  if (!evaluador_user || !evaluado_noemp || typeof tipo === "undefined") {
    throw new Error("Faltan datos obligatorios: evaluador_user, evaluado_noemp, tipo");
  }

  if (!Array.isArray(respuestas) || respuestas.length !== 18) {
    throw new Error("respuestas debe ser un arreglo de 18 valores (1..3)");
  }

  const r = respuestas.map((x) => Number(x) || 0);

  // periodo y año
  const hoy = new Date();
  const periodo = getPeriodoFromDate(hoy); // debe devolver 'Q1' | 'Q2' | 'Q3'
  const anio = hoy.getFullYear();

  // columnas re1..re18
  const reCols = Array.from({ length: 18 }, (_, i) => `re${i + 1}`).join(",");
  const rePlaceholders = Array.from({ length: 18 }, () => "?").join(",");

  const sql = `
    INSERT INTO resultadosdesempeno
    (user, evaluado, tipo_eval, tipo, ${reCols}, re19, fecha, periodo, anio)
    VALUES
    (?, ?, ?, ?, ${rePlaceholders}, ?, CURDATE(), ?, ?)
  `;

  const params = [
    evaluador_user,
    evaluado_noemp,
    (tipo_eval || "NORMAL"), // <-- guarda NORMAL/EXTRA
    tipo,
    ...r,
    comentario || "",
    periodo,
    anio,
  ];

  const [result] = await db.query(sql, params);
  return { id: result.insertId };
}

module.exports = { saveEvaluacionDesempeno };