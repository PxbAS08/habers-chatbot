// src/services/detalle.format.js

function safeNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function avg(arr) {
  const a = arr.map(safeNum);
  const s = a.reduce((acc, v) => acc + v, 0);
  return a.length ? Math.round((s / a.length) * 100) / 100 : 0;
}

function countBMA(respuestas) {
  let bajo = 0, medio = 0, alto = 0;
  for (const r of respuestas) {
    if (r === 1) bajo++;
    else if (r === 2) medio++;
    else if (r === 3) alto++;
  }
  return { bajo, medio, alto };
}

function formatDetalle(row) {
  // respuestas 1..18
  const res = Array.from({ length: 18 }, (_, i) => safeNum(row[`re${i + 1}`]));

  // Bloques (3 preguntas c/u)
  const responsabilidad = avg(res.slice(0, 3));
  const comunicacion    = avg(res.slice(3, 6));
  const vision          = avg(res.slice(6, 9));
  const lidera          = avg(res.slice(9, 12));
  const orientacion     = avg(res.slice(12, 15));
  const asistencia      = avg(res.slice(15, 18));

  const promedioGeneral = avg(res);
  const c = countBMA(res);

  const evalName = row.evaluado_nombre || `Noemp ${row.evaluado_noemp}`;
  const evalPuesto = row.evaluado_puesto ? ` | ${row.evaluado_puesto}` : "";
  const evalArea = row.evaluado_area ? ` | ${row.evaluado_area}` : "";

  const tipoEval = row.tipo_eval || "NORMAL";
  const periodo = row.periodo ? `${row.periodo}-${row.anio}` : (row.anio ? `${row.anio}` : "N/D");

  // Respuestas agrupadas (solo lo esencial para RH)
  const grupos = [
    `RESP (1-3): ${res.slice(0,3).join(", ")}`,
    `COM (4-6): ${res.slice(3,6).join(", ")}`,
    `VIS (7-9): ${res.slice(6,9).join(", ")}`,
    `LID (10-12): ${res.slice(9,12).join(", ")}`,
    `ORI (13-15): ${res.slice(12,15).join(", ")}`,
    `ASI (16-18): ${res.slice(15,18).join(", ")}`
  ].join("\n");

  const comentario = (row.comentario || "").trim();

  return (
        `📄 *Detalle evaluación*\n` +
        `ID: ${row.id} | Fecha: ${row.fecha}\n` +
        `Tipo: ${tipoEval} | Periodo: ${periodo}\n\n` +

        `👤 *Evaluado:* ${evalName}${evalPuesto}${evalArea}\n\n` +

        `📊 *Promedios por competencia*\n` +
        `- Responsabilidad: ${responsabilidad}\n` +
        `- Comunicación e Influencia: ${comunicacion}\n` +
        `- Visión y Estrategia: ${vision}\n` +
        `- Lidera y Entrena: ${lidera}\n` +
        `- Orientación a Resultados: ${orientacion}\n` +
        `- Asistencia y Puntualidad: ${asistencia}\n\n` +

        `⭐ *Promedio general:* ${promedioGeneral}\n` +
        `📌 *Conteo:* Bajo=${c.bajo} | Medio=${c.medio} | Alto=${c.alto}\n\n` +

        `🧾 *Respuestas (por bloque)*\n${grupos}\n\n` +
        `💬 *Comentario:* ${comentario ? comentario : "(sin comentario)"}`
    );
}

module.exports = { formatDetalle };