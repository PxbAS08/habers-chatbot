function avg(nums) {
  const s = nums.reduce((a, b) => a + b, 0);
  return Math.round(s / nums.length);
}

function nivel(valor) {
  if (valor <= 1) return "Bajo";
  if (valor === 2) return "Medio";
  return "Alto";
}

function buildResumen(respuestas18) {
  const bajos = respuestas18.filter((x) => x === 1).length;
  const medios = respuestas18.filter((x) => x === 2).length;
  const altos = respuestas18.filter((x) => x === 3).length;

  const bloques = {
    Responsabilidad: respuestas18.slice(0, 3),
    "Comunicación e Influencia": respuestas18.slice(3, 6),
    "Visión y Estrategia": respuestas18.slice(6, 9),
    "Lidera y Entrena": respuestas18.slice(9, 12),
    "Orientación a Resultados": respuestas18.slice(12, 15),
    "Asistencia y Puntualidad": respuestas18.slice(15, 18),
  };

  const lines = [];

  for (const [k, v] of Object.entries(bloques)) {
    lines.push(`- ${k}: ${avg(v)}`);
  }

  const promedioGeneral = avg(respuestas18);

  lines.push(`Promedio general: ${promedioGeneral} (${nivel(promedioGeneral)})`);
  lines.push(`Conteo -> Bajo:${bajos} Medio:${medios} Alto:${altos}`);

  return lines.join("\n");
}

module.exports = { buildResumen };

function buildResumen(respuestas18) {
  const bajos = respuestas18.filter((x) => x === 1).length;
  const medios = respuestas18.filter((x) => x === 2).length;
  const altos = respuestas18.filter((x) => x === 3).length;

  const bloques = {
    Responsabilidad: respuestas18.slice(0, 3),
    "Comunicación e Influencia": respuestas18.slice(3, 6),
    "Visión y Estrategia": respuestas18.slice(6, 9),
    "Lidera y Entrena": respuestas18.slice(9, 12),
    "Orientación a Resultados": respuestas18.slice(12, 15),
    "Asistencia y Puntualidad": respuestas18.slice(15, 18),
  };

  const lines = [];
  for (const [k, v] of Object.entries(bloques)) {
    lines.push(`- ${k}: ${avg(v)}`);
  }
  lines.push(`Promedio general: ${avg(respuestas18)}`);
  lines.push(`Conteo -> Bajo:${bajos} Medio:${medios} Alto:${altos}`);

  return lines.join("\n");
}

module.exports = { buildResumen };