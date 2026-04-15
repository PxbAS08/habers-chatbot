const ExcelJS = require("exceljs");
const { getEvaluaciones, getEvaluacionDetalle } = require("../services/reportes.service");

function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

exports.viewReportes = async (req, res) => {
  try {
    const filtros = {
      periodo: req.query.periodo || "",
      anio: req.query.anio || "",
      tipo_eval: req.query.tipo_eval || "",
      busqueda: req.query.busqueda || "",
      evaluador: req.query.evaluador || "",
      area: req.query.area || "",
      puesto: req.query.puesto || "",
    };

    const rows = await getEvaluaciones(filtros);

    const tableRows = rows.map((r) => `
      <tr>
        <td>${r.id}</td>
        <td>${escapeHtml(r.fecha)}</td>
        <td>${escapeHtml(r.periodo)}-${escapeHtml(r.anio)}</td>
        <td>${escapeHtml(r.tipo_eval)}</td>
        <td>
          <strong>${escapeHtml(r.evaluado_nombre || "Sin nombre")}</strong><br>
          <span class="small">ID: ${escapeHtml(r.evaluado)}</span>
        </td>
        <td>${escapeHtml(r.evaluado_puesto || "")}</td>
        <td>${escapeHtml(r.evaluado_area || "")}</td>
        <td>
          <strong>${escapeHtml(r.evaluador_nombre || "Sin nombre")}</strong><br>
          <span class="small">User: ${escapeHtml(r.evaluador_user || "")}</span>
        </td>
        <td>${escapeHtml(r.promedio)}</td>
        <td>${escapeHtml(r.comentario || "")}</td>
        <td>
          <a class="link-btn" href="/reportes/detalle/${r.id}">Ver detalle</a>
        </td>
      </tr>
    `).join("");

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Reporte RH</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            background: #f1f5f9;
            color: #1e293b;
          }
          .topbar {
            background: linear-gradient(135deg, #0f172a, #1d4ed8);
            color: white;
            padding: 20px 32px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .topbar h1 {
            margin: 0;
            font-size: 28px;
          }
          .topbar .actions {
            display: flex;
            gap: 12px;
          }
          .topbar a {
            color: white;
            text-decoration: none;
            background: rgba(255,255,255,.15);
            padding: 10px 14px;
            border-radius: 10px;
            font-size: 14px;
          }
          .topbar a:hover {
            background: rgba(255,255,255,.25);
          }
          .container {
            padding: 24px 32px;
          }
          .card {
            background: white;
            border-radius: 16px;
            box-shadow: 0 10px 25px rgba(0,0,0,.06);
            padding: 20px;
            margin-bottom: 20px;
          }
          form {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
            align-items: center;
          }
          input, select {
            padding: 10px 12px;
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            min-width: 160px;
            background: white;
          }
          input:focus, select:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow: 0 0 0 3px rgba(37,99,235,.12);
          }
          table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 25px rgba(0,0,0,.06);
          }
          th {
            background: #e2e8f0;
            padding: 12px;
            text-align: left;
            font-size: 14px;
          }
          td {
            padding: 12px;
            border-top: 1px solid #e5e7eb;
            vertical-align: top;
            font-size: 14px;
          }
          tr:nth-child(even) {
            background: #f8fafc;
          }
          tr:hover {
            background: #eff6ff;
          }
          .link-btn {
            text-decoration: none;
            color: #2563eb;
            font-weight: bold;
          }
          .small {
            color: #64748b;
            font-size: 12px;
          }
           .no-spinner::-webkit-outer-spin-button,
            .no-spinner::-webkit-inner-spin-button {
              -webkit-appearance: none;
              margin: 0;
         }
        .no-spinner {
              appearance: textfield;
              -moz-appearance: textfield;
          } 
              .clear-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 10px 14px;
            border-radius: 10px;
            background: #e2e8f0;
            color: #1e293b;
            text-decoration: none;
            font-size: 14px;
            font-weight: bold;
          }

          .clear-btn:hover {
            background: #cbd5e1;
          }
        </style>
      </head>
      <body>
          <div class="topbar">
            <h1>Reporte de Evaluaciones RH</h1>
            <div class="actions">
              <a href="/reportes/evaluadores">
                Evaluadores
              </a>
              <a href="/reportes/evaluados">
                Evaluados
              </a>
              <a href="/reportes/excel?periodo=${encodeURIComponent(filtros.periodo)}&anio=${encodeURIComponent(filtros.anio)}&tipo_eval=${encodeURIComponent(filtros.tipo_eval)}&busqueda=${encodeURIComponent(filtros.busqueda)}&evaluador=${encodeURIComponent(filtros.evaluador)}&area=${encodeURIComponent(filtros.area)}&puesto=${encodeURIComponent(filtros.puesto)}">
                Exportar Excel
              </a>
              <a href="/reportes/excel-graficas?periodo=${encodeURIComponent(filtros.periodo)}&anio=${encodeURIComponent(filtros.anio)}&tipo_eval=${encodeURIComponent(filtros.tipo_eval)}&busqueda=${encodeURIComponent(filtros.busqueda)}&evaluador=${encodeURIComponent(filtros.evaluador)}&area=${encodeURIComponent(filtros.area)}&puesto=${encodeURIComponent(filtros.puesto)}" style="background: #10b981;">
                Excel Gráficas
              </a>
              <a href="/logout">Cerrar sesión</a>
            </div>
          </div>

        <div class="container">
        <div class="card">
        <form id="filterForm" method="GET" action="/reportes">

          <form id="filterForm" method="GET" action="/reportes">
            <select name="periodo" class="auto-submit">
              <option value="">Todos los periodos</option>
              <option value="Q1" ${filtros.periodo === "Q1" ? "selected" : ""}>Q1</option>
              <option value="Q2" ${filtros.periodo === "Q2" ? "selected" : ""}>Q2</option>
              <option value="Q3" ${filtros.periodo === "Q3" ? "selected" : ""}>Q3</option>
            </select>

            <input type="text" inputmode="numeric" pattern="[0-9]*" name="anio" class="auto-submit no-spinner" placeholder="Año" value="${escapeHtml(filtros.anio)}" />

            <select name="tipo_eval" class="auto-submit">
              <option value="">Todos los tipos</option>
              <option value="NORMAL" ${filtros.tipo_eval === "NORMAL" ? "selected" : ""}>NORMAL</option>
              <option value="EXTRA" ${filtros.tipo_eval === "EXTRA" ? "selected" : ""}>EXTRA</option>
            </select>

            <input type="text" name="busqueda" class="auto-submit" placeholder="Identificador o nombre" value="${escapeHtml(filtros.busqueda)}" />

            <input type="text" name="evaluador" class="auto-submit" placeholder="Evaluador" value="${escapeHtml(filtros.evaluador)}" />

            <input type="text" name="area" class="auto-submit" placeholder="Área" value="${escapeHtml(filtros.area)}" />

            <input type="text" name="puesto" class="auto-submit" placeholder="Puesto" value="${escapeHtml(filtros.puesto)}" />

            <a href="/reportes" class="clear-btn">Limpiar filtros</a>
          </form>
        </form>
        </div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Fecha</th>
              <th>Periodo</th>
              <th>Tipo</th>
              <th>Evaluado</th>
              <th>Puesto</th>
              <th>Área</th>
              <th>Evaluador</th>
              <th>Promedio</th>
              <th>Comentario</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows || `<tr><td colspan="11">No hay registros</td></tr>`}
          </tbody>
        </table>
        <script>
          const form = document.getElementById("filterForm");
          const autoFields = document.querySelectorAll(".auto-submit");

          let lastField = null;

          autoFields.forEach(el => {

            if (el.tagName === "SELECT") {
              el.addEventListener("change", () => form.submit());
              return;
            }

            el.addEventListener("focus", () => {
              lastField = el.name;
            });

            el.addEventListener("input", () => {
              clearTimeout(el._timer);

              el._timer = setTimeout(() => {
                const params = new URLSearchParams(new FormData(form));

                if (lastField) {
                  params.set("focus", lastField);
                }

                window.location.href = "/reportes?" + params.toString();
              }, 1200);
            });

          });

          const urlParams = new URLSearchParams(window.location.search);
          const focusField = urlParams.get("focus");

          if (focusField) {
            const field = document.querySelector('[name="' + focusField + '"]');
            if (field) {
              field.focus();
              field.selectionStart = field.value.length;
            }
          }
          </script>
      </body>
      </html>
    `;

    res.send(html);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error generando reporte");
  }
};

exports.exportExcel = async (req, res) => {
  try {
    const filtros = {
      periodo: req.query.periodo || "",
      anio: req.query.anio || "",
      tipo_eval: req.query.tipo_eval || "",
      busqueda: req.query.busqueda || "",
      evaluador: req.query.evaluador || "",
      area: req.query.area || "",
      puesto: req.query.puesto || "",
    };

    const rows = await getEvaluaciones(filtros);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Evaluaciones RH");

    worksheet.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Fecha", key: "fecha", width: 15 },
      { header: "Periodo", key: "periodo", width: 10 },
      { header: "Año", key: "anio", width: 10 },
      { header: "Tipo Eval", key: "tipo_eval", width: 12 },
      { header: "No. Evaluado", key: "evaluado", width: 15 },
      { header: "Evaluado", key: "evaluado_nombre", width: 25 },
      { header: "Puesto", key: "evaluado_puesto", width: 25 },
      { header: "Área", key: "evaluado_area", width: 20 },
      { header: "Evaluador", key: "evaluador_nombre", width: 25 },
      { header: "Promedio", key: "promedio", width: 12 },
      { header: "Comentario", key: "comentario", width: 40 },
    ];

    rows.forEach((r) => {
      worksheet.addRow({
        id: r.id,
        fecha: r.fecha,
        periodo: r.periodo,
        anio: r.anio,
        tipo_eval: r.tipo_eval,
        evaluado: r.evaluado,
        evaluado_nombre: r.evaluado_nombre || "",
        evaluado_puesto: r.evaluado_puesto || "",
        evaluado_area: r.evaluado_area || "",
        evaluador_nombre: r.evaluador_nombre || r.evaluador_user || "",
        promedio: r.promedio,
        comentario: r.comentario || "",
      });
    });

    worksheet.getRow(1).font = { bold: true };

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="evaluaciones_rh.xlsx"'
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).send("Error exportando Excel");
  }
};

exports.exportExcelGraficas = async (req, res) => {
  try {
    const filtros = {
      periodo: req.query.periodo || "",
      anio: req.query.anio || "",
      tipo_eval: req.query.tipo_eval || "",
      busqueda: req.query.busqueda || "",
      evaluador: req.query.evaluador || "",
      area: req.query.area || "",
      puesto: req.query.puesto || "",
    };

    const rows = await getEvaluaciones(filtros);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Datos Gráficas");

    // Agregamos "No. Evaluador" a la lista de columnas
    worksheet.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Fecha", key: "fecha", width: 15 },
      { header: "Tipo Eval", key: "tipo_eval", width: 12 },
      { header: "No. Evaluado", key: "evaluado", width: 15 },
      { header: "Evaluado", key: "evaluado_nombre", width: 25 },
      { header: "No. Evaluador", key: "evaluador_user", width: 15 },
      { header: "Evaluador", key: "evaluador_nombre", width: 25 },
      { header: "P1", key: "re1", width: 8 },
      { header: "P2", key: "re2", width: 8 },
      { header: "P3", key: "re3", width: 8 },
      { header: "P4", key: "re4", width: 8 },
      { header: "P5", key: "re5", width: 8 },
      { header: "P6", key: "re6", width: 8 },
      { header: "P7", key: "re7", width: 8 },
      { header: "P8", key: "re8", width: 8 },
      { header: "P9", key: "re9", width: 8 },
      { header: "P10", key: "re10", width: 8 },
      { header: "P11", key: "re11", width: 8 },
      { header: "P12", key: "re12", width: 8 },
      { header: "P13", key: "re13", width: 8 },
      { header: "P14", key: "re14", width: 8 },
      { header: "P15", key: "re15", width: 8 },
      { header: "P16", key: "re16", width: 8 },
      { header: "P17", key: "re17", width: 8 },
      { header: "P18", key: "re18", width: 8 },
      { header: "Comentario", key: "comentario", width: 40 }
    ];

    // Mapeamos el dato evaluador_user en cada fila
    rows.forEach((r) => {
      worksheet.addRow({
        id: r.id,
        fecha: r.fecha,
        tipo_eval: r.tipo_eval,
        evaluado: r.evaluado,
        evaluado_nombre: r.evaluado_nombre || "",
        evaluador_user: r.evaluador_user || "",
        evaluador_nombre: r.evaluador_nombre || r.evaluador_user || "",
        re1: r.re1, re2: r.re2, re3: r.re3, re4: r.re4, re5: r.re5, re6: r.re6,
        re7: r.re7, re8: r.re8, re9: r.re9, re10: r.re10, re11: r.re11, re12: r.re12,
        re13: r.re13, re14: r.re14, re15: r.re15, re16: r.re16, re17: r.re17, re18: r.re18,
        comentario: r.comentario || ""
      });
    });

    worksheet.getRow(1).font = { bold: true };

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="datos_graficas_rh.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).send("Error exportando Excel de gráficas");
  }
};

exports.viewDetalle = async (req, res) => {
  try {
    const row = await getEvaluacionDetalle(req.params.id);

    if (!row) {
      return res.status(404).send("Evaluación no encontrada");
    }

    const respuestas = Array.from({ length: 18 }, (_, i) => Number(row[`re${i + 1}`] || 0));

    const avg = (arr) => {
      const s = arr.reduce((a, b) => a + b, 0);
      return arr.length ? (s / arr.length).toFixed(2) : "0.00";
    };

    const bloques = {
      "Responsabilidad": respuestas.slice(0, 3),
      "Comunicación e Influencia": respuestas.slice(3, 6),
      "Visión y Estrategia": respuestas.slice(6, 9),
      "Lidera y Entrena": respuestas.slice(9, 12),
      "Orientación a Resultados": respuestas.slice(12, 15),
      "Asistencia y Puntualidad": respuestas.slice(15, 18),
    };

    const promedioCrudo = respuestas.length ? (respuestas.reduce((a, b) => a + b, 0) / respuestas.length) : 0;
    const promedioRedondeado = Math.round(promedioCrudo);
    const nivel = promedioRedondeado >= 3 ? "Alto" : (promedioRedondeado === 2 ? "Medio" : "Bajo");
    const promedioGeneral = `${promedioRedondeado} = ${nivel}`;

    const conteo = {
      bajo: respuestas.filter(r => r === 1).length,
      medio: respuestas.filter(r => r === 2).length,
      alto: respuestas.filter(r => r === 3).length,
    };

    const preguntas = [
      "Respeta las normas, reglamentos, instrucciones y disposiciones para lograr el impacto requerido en el puesto.",
      "Cumple con las funciones y obligaciones asignadas en el puesto.",
      "Obtiene resultados de acuerdo con los objetivos del puesto.",
      "Se comunica de manera simple, concisa y consistente.",
      "Usa hechos y argumentos racionales para influenciar y convencer.",
      "Usa su conocimiento del medio ambiente interno y externo para anticiparse a la reacción de su audiencia y adapta su comunicación de acuerdo con la situación.",
      "Piensa más allá de su propia función y entiende interacciones complejas del negocio.",
      "Desarrolla y comunica una clara visión y estrategias.",
      "Actualiza las estrategias y se anticipa a los cambios que impactan al negocio.",
      "Evalúa fortalezas y áreas de desarrollo de su gente y ejecuta con ellas un plan de acción.",
      "Reconoce y recompensa el buen desempeño, así como confronta sus áreas de oportunidad y carencia de resultados.",
      "Crea oportunidades de aprendizaje continuamente y estimula a su gente a que también las creen para desarrollar a otros compañeros.",
      "Siempre establece objetivos personales y de equipo alineados con los de la compañía.",
      "Toma la iniciativa para eliminar procesos que no agregan valor en su puesto y en la organización.",
      "Hace lo que tiene que hacer aún cuando se enfrenta con decisiones difíciles y toma las acciones necesarias para cumplir objetivos establecidos.",
      "Actitud positiva de presentarse a trabajar a la hora establecida y al cumplimiento de las actividades de su puesto.",
      "Es puntual a la hora de entrada, solo excepcionalmente llega tarde y sus retardos tienen una causa justificada.",
      "Acude con puntualidad a la hora de entrada y a sus compromisos de trabajo."
    ];

    const label = (v) => v === 1 ? "Bajo" : v === 2 ? "Medio" : v === 3 ? "Alto" : "N/A";

    const filasPreguntas = preguntas.map((p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(p)}</td>
        <td>${respuestas[i]}</td>
        <td>${label(respuestas[i])}</td>
      </tr>
    `).join("");

    const bloquesHtml = Object.entries(bloques).map(([nombre, vals]) => `
      <tr>
        <td>${escapeHtml(nombre)}</td>
        <td>${vals.join(", ")}</td>
        <td>${avg(vals)}</td>
      </tr>
    `).join("");

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Detalle Evaluación ${row.id}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            background: #f1f5f9;
            color: #1e293b;
          }
          .topbar {
            background: linear-gradient(135deg, #0f172a, #1d4ed8);
            color: white;
            padding: 20px 32px;
          }
          .topbar a {
            color: white;
            text-decoration: none;
            font-size: 14px;
          }
          .container {
            padding: 24px 32px;
          }
          h1, h2 {
            margin-top: 0;
          }
          .card {
            border: none;
            border-radius: 16px;
            padding: 20px;
            margin-bottom: 20px;
            background: white;
            box-shadow: 0 10px 25px rgba(0,0,0,.06);
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            font-size: 14px;
          }
          th, td {
            border: 1px solid #e5e7eb;
            padding: 10px;
            text-align: left;
            vertical-align: top;
          }
          th {
            background: #e2e8f0;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 12px;
          }
          .badge {
            display: inline-block;
            padding: 8px 12px;
            border-radius: 999px;
            background: #dbeafe;
            color: #1d4ed8;
            margin-right: 8px;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
          <div class="topbar">
            <a href="/reportes">← Volver a reportes</a>
          </div>
          <div class="container">

        <div class="card">
          <div class="grid">
            <div><strong>ID:</strong> ${row.id}</div>
            <div><strong>Fecha:</strong> ${escapeHtml(row.fecha)}</div>
            <div><strong>Periodo:</strong> ${escapeHtml(row.periodo)}-${escapeHtml(row.anio)}</div>
            <div><strong>Tipo evaluación:</strong> ${escapeHtml(row.tipo_eval)}</div>
            <div><strong>Evaluado:</strong> ${escapeHtml(row.evaluado)} - ${escapeHtml(row.evaluado_nombre || "")}</div>
            <div><strong>Puesto:</strong> ${escapeHtml(row.evaluado_puesto || "")}</div>
            <div><strong>Área:</strong> ${escapeHtml(row.evaluado_area || "")}</div>
            <div><strong>Evaluador:</strong> ${escapeHtml(row.evaluador_nombre || row.user || "")}</div>
          </div>
        </div>

        <div class="card">
          <h2>Resumen general</h2>
          <span class="badge">Promedio general: ${promedioGeneral}</span>
          <span class="badge">Bajo: ${conteo.bajo}</span>
          <span class="badge">Medio: ${conteo.medio}</span>
          <span class="badge">Alto: ${conteo.alto}</span>
        </div>

        <div class="card">
          <h2>Promedios por competencia</h2>
          <table>
            <thead>
              <tr>
                <th>Competencia</th>
                <th>Respuestas</th>
                <th>Promedio</th>
              </tr>
            </thead>
            <tbody>
              ${bloquesHtml}
            </tbody>
          </table>
        </div>

        <div class="card">
          <h2>Respuestas por pregunta</h2>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Pregunta</th>
                <th>Valor</th>
                <th>Nivel</th>
              </tr>
            </thead>
            <tbody>
              ${filasPreguntas}
            </tbody>
          </table>
        </div>

        <div class="card">
          <h2>Comentario</h2>
          <p>${escapeHtml(row.re19 || "(sin comentario)")}</p>
        </div>
      </body>
      </html>
    `;

    res.send(html);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error obteniendo detalle");
  }
};
