// src/services/historial.service.js
const db = require("../config/database");

// Promedio general (re1..re18)
const PROM_EXPR = `
  ROUND((
    re1+re2+re3+re4+re5+re6+re7+re8+re9+
    re10+re11+re12+re13+re14+re15+re16+re17+re18
  ) / 18, 2)
`;

async function getHistorialByEvaluadorUser(evaluadorUser, limit = 5) {
  const sql = `
    SELECT
      r.id,
      r.fecha,
      r.tipo_eval,
      r.periodo,
      r.anio,
      r.evaluado,
      ${PROM_EXPR} AS promedio,
      ue.Nombre AS evaluado_nombre,
      ue.Puesto AS evaluado_puesto,
      uu.Nombre AS evaluador_nombre
    FROM resultadosdesempeno r
    LEFT JOIN users ue ON ue.Noemp = r.evaluado
    LEFT JOIN users uu ON uu.user = r.user
    WHERE r.user = ?
    ORDER BY r.id DESC
    LIMIT ?
  `;

  const [rows] = await db.query(sql, [evaluadorUser, Number(limit)]);
  return rows;
}

async function getHistorialByEvaluadoNoemp(evaluadoNoemp, limit = 5) {
  const sql = `
    SELECT
      r.id,
      r.fecha,
      r.tipo_eval,
      r.periodo,
      r.anio,
      r.user,
      ${PROM_EXPR} AS promedio,
      ue.Nombre AS evaluado_nombre,
      ue.Puesto AS evaluado_puesto,
      uu.Nombre AS evaluador_nombre
    FROM resultadosdesempeno r
    LEFT JOIN users ue ON ue.Noemp = r.evaluado
    LEFT JOIN users uu ON uu.user = r.user
    WHERE r.evaluado = ?
    ORDER BY r.id DESC
    LIMIT ?
  `;

  const [rows] = await db.query(sql, [Number(evaluadoNoemp), Number(limit)]);
  return rows;
}

function formatearFecha(fecha) {
  if (!fecha) return "Sin fecha";

  const d = new Date(fecha);

  if (isNaN(d.getTime())) return String(fecha);

  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const anio = d.getFullYear();

  return `${dia}/${mes}/${anio}`;
}

function formatHistorial(rows) {
  if (!rows || rows.length === 0) return "No hay evaluaciones para mostrar.";

  return rows.map((r, i) => {
    const evalName = r.evaluado_nombre ? `${r.evaluado_nombre}` : `Noemp ${r.evaluado}`;
    const evalPuesto = r.evaluado_puesto ? ` (${r.evaluado_puesto})` : "";
    const evrName = r.evaluador_nombre ? `${r.evaluador_nombre}` : `${r.user || ""}`.trim();

    return [
      `${i + 1}) ID ${r.id} | ${formatearFecha(r.fecha)} | ${r.tipo_eval} | ${r.periodo}-${r.anio}`,
      `   Evaluado: ${evalName}${evalPuesto}`,
      `   Evaluador: ${evrName}`,
      `   Promedio: ${r.promedio}`
    ].join("\n");
  }).join("\n\n");
}

async function getEvaluacionDetalleById(evaluadorUser, id) {
  const sql = `
    SELECT
      r.*,
      ue.Nombre AS evaluado_nombre,
      ue.Puesto AS evaluado_puesto,
      ue.Area   AS evaluado_area,
      uu.Nombre AS evaluador_nombre
    FROM resultadosdesempeno r
    LEFT JOIN users ue ON ue.Noemp = r.evaluado
    LEFT JOIN users uu ON uu.user = r.user
    WHERE r.user = ? AND r.id = ?
    LIMIT 1
  `;

  const [rows] = await db.query(sql, [evaluadorUser, Number(id)]);
  if (!rows.length) return null;

  const r = rows[0];

  const resp = [];
  for (let i = 1; i <= 18; i++) resp.push(Number(r[`re${i}`] || 0));

  // Bloques (3 reactivos por competencia)
  const responsabilidad = resp.slice(0, 3);
  const comunicacion    = resp.slice(3, 6);
  const vision          = resp.slice(6, 9);
  const lidera          = resp.slice(9, 12);
  const resultados      = resp.slice(12, 15);
  const puntualidad     = resp.slice(15, 18);

  const promedios = {
    responsabilidad: avg(responsabilidad),
    comunicacion: avg(comunicacion),
    vision: avg(vision),
    lidera: avg(lidera),
    resultados: avg(resultados),
    puntualidad: avg(puntualidad),
    general: avg(resp),
  };

  const conteo = {
    bajo: resp.filter((x) => x === 1).length,
    medio: resp.filter((x) => x === 2).length,
    alto: resp.filter((x) => x === 3).length,
  };

  return {
    id: r.id,
    fecha: r.fecha,
    tipo_eval: r.tipo_eval,
    periodo: r.periodo,
    anio: r.anio,
    evaluado: r.evaluado,
    evaluado_nombre: r.evaluado_nombre,
    evaluado_puesto: r.evaluado_puesto,
    evaluado_area: r.evaluado_area,
    evaluador_user: r.user,
    evaluador_nombre: r.evaluador_nombre,
    comentario: r.re19 || "",
    respuestas: resp,
    promedios,
    conteo,
  };
}

function formatDetalle(det) {
  if (!det) return "No encontrado.";

  const head =
`🧾 Detalle de Evaluación
ID: ${det.id}
Fecha: ${formatearFecha(det.fecha)}
Periodo: ${det.periodo}-${det.anio}
Tipo: ${det.tipo_eval}

Evaluado: ${det.evaluado} - ${det.evaluado_nombre || ""}
Puesto/Área: ${det.evaluado_puesto || ""} / ${det.evaluado_area || ""}

Promedios:
- Responsabilidad: ${fmt2(det.promedios.responsabilidad)}
- Comunicación e Influencia: ${fmt2(det.promedios.comunicacion)}
- Visión y Estrategia: ${fmt2(det.promedios.vision)}
- Lidera y Entrena: ${fmt2(det.promedios.lidera)}
- Orientación a Resultados: ${fmt2(det.promedios.resultados)}
- Asistencia y Puntualidad: ${fmt2(det.promedios.puntualidad)}
Promedio general: ${fmt2(det.promedios.general)}

Conteo -> Bajo:${det.conteo.bajo} Medio:${det.conteo.medio} Alto:${det.conteo.alto}`;

  const respuestasTxt = det.respuestas
    .map((v, i) => `${i + 1}) ${v}`)
    .join("\n");

  const com = det.comentario ? det.comentario : "(sin comentario)";

  return `${head}\n\nRespuestas (1-18):\n${respuestasTxt}\n\nComentario:\n${com}`;
}

function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function fmt2(n) {
  return Number(n || 0).toFixed(2);
}

module.exports = {
  getHistorialByEvaluadorUser,
  getHistorialByEvaluadoNoemp,
  formatHistorial,
  getEvaluacionDetalleById,
  formatDetalle,
};