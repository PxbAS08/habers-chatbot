const {
  createEvaluador,
  getEvaluadorByUser,
  listEvaluadores,
  setEvaluadorActivo,
  updateEvaluador,
} = require("../services/evaluadores.service");
const {
  createEvaluado,
  getAssignedEvaluado,
  listEvaluados,
  setEvaluadoActivo,
  updateEvaluado,
} = require("../services/evaluados.service");

function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildQuery(basePath, params = {}) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    query.set(key, value);
  }

  const suffix = query.toString();
  return suffix ? `${basePath}?${suffix}` : basePath;
}

function redirectWithFlash(res, basePath, status, message, extras = {}) {
  return res.redirect(
    buildQuery(basePath, {
      status,
      message,
      ...extras,
    })
  );
}

function renderFlash(query) {
  const message = query.message ? escapeHtml(query.message) : "";
  const status = query.status === "error" ? "error" : "success";

  if (!message) return "";

  return `<div class="flash ${status}">${message}</div>`;
}

function renderLayout({ title, activeTab, intro, flash, content }) {
  const nav = [
    { href: "/reportes", label: "Reportes", key: "reportes" },
    { href: "/reportes/evaluadores", label: "Evaluadores", key: "evaluadores" },
    { href: "/reportes/evaluados", label: "Evaluados", key: "evaluados" },
  ]
    .map((item) => {
      const activeClass = item.key === activeTab ? "nav-link active" : "nav-link";
      return `<a class="${activeClass}" href="${item.href}">${item.label}</a>`;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <title>${escapeHtml(title)}</title>
      <style>
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: Arial, sans-serif;
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
          gap: 16px;
          flex-wrap: wrap;
        }
        .topbar h1 {
          margin: 0;
          font-size: 28px;
        }
        .topbar p {
          margin: 6px 0 0;
          color: rgba(255,255,255,.85);
        }
        .top-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
        }
        .nav-link,
        .logout-link,
        .secondary-link,
        .table-link,
        button,
        .submit-btn {
          border: none;
          text-decoration: none;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 14px;
          cursor: pointer;
          transition: .18s ease;
        }
        .nav-link,
        .logout-link {
          color: white;
          background: rgba(255,255,255,.14);
        }
        .nav-link.active {
          background: white;
          color: #1d4ed8;
          font-weight: bold;
        }
        .logout-link:hover,
        .nav-link:hover {
          background: rgba(255,255,255,.26);
        }
        .nav-link.active:hover {
          background: white;
        }
        .page {
          padding: 24px 32px 40px;
        }
        .flash {
          margin-bottom: 16px;
          padding: 14px 16px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: bold;
        }
        .flash.success {
          background: #dcfce7;
          color: #166534;
        }
        .flash.error {
          background: #fee2e2;
          color: #991b1b;
        }
        .grid {
          display: grid;
          grid-template-columns: minmax(320px, 380px) minmax(0, 1fr);
          gap: 20px;
          align-items: start;
        }
        .card {
          background: white;
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 10px 25px rgba(0,0,0,.06);
          margin-bottom: 20px;
        }
        .card h2 {
          margin: 0 0 8px;
          font-size: 22px;
        }
        .card p {
          margin: 0 0 16px;
          color: #64748b;
          line-height: 1.45;
        }
        .filters {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: end;
          margin-bottom: 16px;
        }
        .field {
          margin-bottom: 12px;
        }
        .field label {
          display: block;
          margin-bottom: 6px;
          font-size: 13px;
          font-weight: bold;
          color: #334155;
        }
        input, select {
          width: 100%;
          padding: 11px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          font-size: 14px;
          background: white;
        }
        input:focus, select:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37,99,235,.14);
        }
        .submit-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #2563eb;
          color: white;
          font-weight: bold;
        }
        .submit-btn:hover {
          background: #1d4ed8;
        }
        .secondary-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #e2e8f0;
          color: #1e293b;
          font-weight: bold;
        }
        .secondary-link:hover {
          background: #cbd5e1;
        }
        .danger-btn {
          background: #fee2e2;
          color: #991b1b;
          font-weight: bold;
        }
        .danger-btn:hover {
          background: #fecaca;
        }
        .success-btn {
          background: #dcfce7;
          color: #166534;
          font-weight: bold;
        }
        .success-btn:hover {
          background: #bbf7d0;
        }
        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 8px;
        }
        .table-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #e0f2fe;
          color: #0f4c81;
          font-weight: bold;
        }
        .table-link:hover {
          background: #bae6fd;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          border-radius: 16px;
          overflow: hidden;
        }
        th, td {
          padding: 12px;
          border-top: 1px solid #e5e7eb;
          text-align: left;
          vertical-align: top;
          font-size: 14px;
        }
        thead th {
          border-top: none;
          background: #e2e8f0;
        }
        tr:nth-child(even) {
          background: #f8fafc;
        }
        tr:hover {
          background: #eff6ff;
        }
        .badge {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: bold;
        }
        .badge.active {
          background: #dcfce7;
          color: #166534;
        }
        .badge.inactive {
          background: #e2e8f0;
          color: #475569;
        }
        .badge.extra {
          background: #fef3c7;
          color: #92400e;
        }
        .badge.normal {
          background: #dbeafe;
          color: #1d4ed8;
        }
        .small {
          color: #64748b;
          font-size: 12px;
        }
        .empty {
          color: #64748b;
          font-style: italic;
        }
        .hint {
          margin-top: -4px;
          margin-bottom: 12px;
          color: #64748b;
          font-size: 12px;
          line-height: 1.45;
        }
        @media (max-width: 980px) {
          .grid {
            grid-template-columns: 1fr;
          }
        }
      </style>
    </head>
    <body>
      <div class="topbar">
        <div>
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(intro)}</p>
        </div>
        <div class="top-actions">
          ${nav}
          <a class="logout-link" href="/logout">Cerrar sesi&oacute;n</a>
        </div>
      </div>

      <div class="page">
        ${flash}
        ${content}
      </div>
    </body>
    </html>
  `;
}

exports.viewEvaluadores = async (req, res) => {
  try {
    const filters = {
      busqueda: req.query.busqueda || "",
      status: req.query.status || "activos",
      edit: req.query.edit || "",
    };

    const [evaluadores, editItem] = await Promise.all([
      listEvaluadores(filters),
      filters.edit
        ? getEvaluadorByUser(filters.edit, { includeInactive: true })
        : Promise.resolve(null),
    ]);

    const formTitle = editItem ? "Modificar evaluador" : "Alta de evaluador";
    const formButton = editItem ? "Guardar cambios" : "Dar de alta";

    const rowsHtml = evaluadores.length
      ? evaluadores
          .map((row) => {
            const statusBadge = row.activo
              ? '<span class="badge active">Activo</span>'
              : '<span class="badge inactive">Inactivo</span>';
            const statusAction = row.activo
              ? `
                <form method="POST" action="/reportes/evaluadores/estado" onsubmit="return confirm('Se dar\u00e1 de baja este evaluador. \u00bfDeseas continuar?');">
                  <input type="hidden" name="user" value="${escapeHtml(row.user)}" />
                  <input type="hidden" name="activo" value="0" />
                  <button class="danger-btn" type="submit">Dar de baja</button>
                </form>
              `
              : `
                <form method="POST" action="/reportes/evaluadores/estado">
                  <input type="hidden" name="user" value="${escapeHtml(row.user)}" />
                  <input type="hidden" name="activo" value="1" />
                  <button class="success-btn" type="submit">Reactivar</button>
                </form>
              `;

            return `
              <tr>
                <td>
                  <strong>${escapeHtml(row.Nombre)}</strong><br>
                  <span class="small">Usuario: ${escapeHtml(row.user)}</span>
                </td>
                <td>${escapeHtml(row.Noemp)}</td>
                <td>${escapeHtml(row.Puesto)}</td>
                <td>${escapeHtml(row.Area)}</td>
                <td>${statusBadge}</td>
                <td>
                  <span class="small">Evaluados asignados: ${escapeHtml(row.total_evaluados)}</span><br>
                  <span class="small">Evaluaciones guardadas: ${escapeHtml(row.total_evaluaciones)}</span>
                </td>
                <td>
                  <div class="actions">
                    <a class="table-link" href="${buildQuery("/reportes/evaluadores", { edit: row.user, busqueda: filters.busqueda, status: filters.status })}">Editar</a>
                    ${statusAction}
                  </div>
                </td>
              </tr>
            `;
          })
          .join("")
      : '<tr><td colspan="7" class="empty">No hay evaluadores para mostrar.</td></tr>';

    const content = `
      <div class="grid">
        <div>
          <div class="card">
            <h2>${formTitle}</h2>
            <p>Las bajas son l&oacute;gicas para conservar el historial de evaluaciones y permitir reactivaciones posteriores.</p>
            <form method="POST" action="/reportes/evaluadores/guardar">
              ${editItem ? `<input type="hidden" name="originalUser" value="${escapeHtml(editItem.user)}" />` : ""}
              <div class="field">
                <label>Usuario</label>
                <input name="user" value="${escapeHtml(editItem?.user || "")}" required />
              </div>
              <div class="field">
                <label>No. empleado</label>
                <input name="noemp" inputmode="numeric" value="${escapeHtml(editItem?.Noemp || "")}" required />
              </div>
              <div class="field">
                <label>Nombre</label>
                <input name="nombre" value="${escapeHtml(editItem?.Nombre || "")}" required />
              </div>
              <div class="field">
                <label>Puesto</label>
                <input name="puesto" value="${escapeHtml(editItem?.Puesto || "")}" required />
              </div>
              <div class="field">
                <label>&Aacute;rea</label>
                <input name="area" value="${escapeHtml(editItem?.Area || "")}" required />
              </div>
              <div class="actions">
                <button class="submit-btn" type="submit">${formButton}</button>
                ${editItem ? '<a class="secondary-link" href="/reportes/evaluadores">Cancelar edici&oacute;n</a>' : ""}
              </div>
            </form>
          </div>
        </div>

        <div>
          <div class="card">
            <h2>Listado de evaluadores</h2>
            <p>Administra qui&eacute;n puede entrar al chatbot y recibir asignaciones de evaluados.</p>

            <form class="filters" method="GET" action="/reportes/evaluadores">
              <div class="field" style="min-width: 220px; margin-bottom: 0;">
                <label>B&uacute;squeda</label>
                <input name="busqueda" placeholder="Usuario, nombre o &aacute;rea" value="${escapeHtml(filters.busqueda)}" />
              </div>
              <div class="field" style="min-width: 180px; margin-bottom: 0;">
                <label>Estatus</label>
                <select name="status">
                  <option value="activos" ${filters.status === "activos" ? "selected" : ""}>Activos</option>
                  <option value="inactivos" ${filters.status === "inactivos" ? "selected" : ""}>Inactivos</option>
                  <option value="todos" ${filters.status === "todos" ? "selected" : ""}>Todos</option>
                </select>
              </div>
              <div class="actions" style="margin-top: 24px;">
                <button class="submit-btn" type="submit">Filtrar</button>
                <a class="secondary-link" href="/reportes/evaluadores">Limpiar</a>
              </div>
            </form>

            <table>
              <thead>
                <tr>
                  <th>Evaluador</th>
                  <th>No. emp.</th>
                  <th>Puesto</th>
                  <th>&Aacute;rea</th>
                  <th>Estatus</th>
                  <th>Uso</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    res.send(
      renderLayout({
        title: "Panel de Evaluadores",
        activeTab: "evaluadores",
        intro: "Altas, bajas y modificaciones de los evaluadores que ingresan al chatbot.",
        flash: renderFlash(req.query),
        content,
      })
    );
  } catch (error) {
    console.error(error);
    res.status(500).send("Error cargando evaluadores");
  }
};

exports.saveEvaluador = async (req, res) => {
  try {
    if (req.body.originalUser) {
      await updateEvaluador(req.body);
      return redirectWithFlash(res, "/reportes/evaluadores", "success", "Evaluador actualizado correctamente.");
    }

    await createEvaluador(req.body);
    return redirectWithFlash(res, "/reportes/evaluadores", "success", "Evaluador dado de alta correctamente.");
  } catch (error) {
    console.error(error);
    return redirectWithFlash(
      res,
      "/reportes/evaluadores",
      "error",
      error.message,
      req.body.originalUser ? { edit: req.body.originalUser } : {}
    );
  }
};

exports.changeEvaluadorStatus = async (req, res) => {
  try {
    await setEvaluadorActivo(req.body.user, String(req.body.activo) === "1");

    const message = String(req.body.activo) === "1"
      ? "Evaluador reactivado correctamente."
      : "Evaluador dado de baja correctamente.";

    return redirectWithFlash(res, "/reportes/evaluadores", "success", message);
  } catch (error) {
    console.error(error);
    return redirectWithFlash(res, "/reportes/evaluadores", "error", error.message);
  }
};

exports.viewEvaluados = async (req, res) => {
  try {
    const filters = {
      busqueda: req.query.busqueda || "",
      status: req.query.status || "activos",
      tipoRegistro: req.query.tipoRegistro || "todos",
      editUser: req.query.editUser || "",
      editEvaluado: req.query.editEvaluado || "",
    };

    const [evaluados, evaluadores, editItem] = await Promise.all([
      listEvaluados(filters),
      listEvaluadores({ status: "activos" }),
      filters.editUser && filters.editEvaluado
        ? getAssignedEvaluado(filters.editUser, filters.editEvaluado, { includeInactive: true })
        : Promise.resolve(null),
    ]);

    const evaluadorOptions = evaluadores
      .map((row) => {
        const selected = row.user === (editItem?.user || "") ? "selected" : "";
        return `<option value="${escapeHtml(row.user)}" ${selected}>${escapeHtml(row.user)} - ${escapeHtml(row.Nombre)}</option>`;
      })
      .join("");

    const rowsHtml = evaluados.length
      ? evaluados
          .map((row) => {
            const typeBadge = row.es_extraoficial
              ? '<span class="badge extra">Extraoficial</span>'
              : '<span class="badge normal">Oficial</span>';
            const statusBadge = row.activo
              ? '<span class="badge active">Activo</span>'
              : '<span class="badge inactive">Inactivo</span>';
            const statusAction = row.activo
              ? `
                <form method="POST" action="/reportes/evaluados/estado" onsubmit="return confirm('Se dar\u00e1 de baja este evaluado. \u00bfDeseas continuar?');">
                  <input type="hidden" name="evaluador_user" value="${escapeHtml(row.user)}" />
                  <input type="hidden" name="evaluado" value="${escapeHtml(row.evaluado)}" />
                  <input type="hidden" name="activo" value="0" />
                  <button class="danger-btn" type="submit">Dar de baja</button>
                </form>
              `
              : `
                <form method="POST" action="/reportes/evaluados/estado">
                  <input type="hidden" name="evaluador_user" value="${escapeHtml(row.user)}" />
                  <input type="hidden" name="evaluado" value="${escapeHtml(row.evaluado)}" />
                  <input type="hidden" name="activo" value="1" />
                  <button class="success-btn" type="submit">Reactivar</button>
                </form>
              `;

            return `
              <tr>
                <td>
                  <strong>${escapeHtml(row.nombre)}</strong><br>
                  <span class="small">Evaluador: ${escapeHtml(row.user)}${row.evaluador_nombre ? ` - ${escapeHtml(row.evaluador_nombre)}` : ""}</span>
                </td>
                <td>${escapeHtml(row.evaluado)}</td>
                <td>${typeBadge}</td>
                <td>${escapeHtml(row.puesto)}</td>
                <td>${escapeHtml(row.area)}</td>
                <td>${escapeHtml(row.tipo)}</td>
                <td>${statusBadge}</td>
                <td>
                  <div class="actions">
                    <a class="table-link" href="${buildQuery("/reportes/evaluados", {
                      editUser: row.user,
                      editEvaluado: row.evaluado,
                      busqueda: filters.busqueda,
                      status: filters.status,
                      tipoRegistro: filters.tipoRegistro,
                    })}">Editar</a>
                    ${statusAction}
                  </div>
                </td>
              </tr>
            `;
          })
          .join("")
      : '<tr><td colspan="8" class="empty">No hay evaluados para mostrar.</td></tr>';

    const formTitle = editItem ? "Modificar evaluado" : "Alta de evaluado";
    const formButton = editItem ? "Guardar cambios" : "Dar de alta";
    const selectedTipo = String(editItem?.es_extraoficial || 0);

    const content = `
      <div class="grid">
        <div>
          <div class="card">
            <h2>${formTitle}</h2>
            <p>Registra asignaciones oficiales y extraoficiales. Para la evaluaci&oacute;n EXTRA, el bot pedir&aacute; el identificador que captures aqu&iacute;.</p>

            ${evaluadores.length === 0 ? '<div class="flash error">Primero debes dar de alta al menos un evaluador activo.</div>' : ""}

            <form method="POST" action="/reportes/evaluados/guardar">
              ${editItem ? `
                <input type="hidden" name="original_user" value="${escapeHtml(editItem.user)}" />
                <input type="hidden" name="original_evaluado" value="${escapeHtml(editItem.evaluado)}" />
              ` : ""}

              <div class="field">
                <label>Evaluador asignado</label>
                <select name="evaluador_user" required>
                  <option value="">Selecciona un evaluador</option>
                  ${evaluadorOptions}
                </select>
              </div>

              <div class="field">
                <label>Tipo de registro</label>
                <select name="es_extraoficial" required>
                  <option value="0" ${selectedTipo === "0" ? "selected" : ""}>Oficial</option>
                  <option value="1" ${selectedTipo === "1" ? "selected" : ""}>Extraoficial</option>
                </select>
              </div>

              <div class="field">
                <label>Identificador del evaluado</label>
                <input name="evaluado" value="${escapeHtml(editItem?.evaluado || "")}" required />
                <div class="hint">Para oficiales usa normalmente el No. de empleado. Para extraoficiales usa el usuario que el evaluador escribir&aacute; en el chat.</div>
              </div>

              <div class="field">
                <label>Nombre</label>
                <input name="nombre" value="${escapeHtml(editItem?.nombre || "")}" required />
              </div>

              <div class="field">
                <label>Puesto</label>
                <input name="puesto" value="${escapeHtml(editItem?.puesto || "")}" required />
              </div>

              <div class="field">
                <label>&Aacute;rea</label>
                <input name="area" value="${escapeHtml(editItem?.area || "")}" required />
              </div>

              <div class="field">
                <label>Tipo</label>
                <input name="tipo" inputmode="numeric" value="${escapeHtml(editItem?.tipo || 1)}" required />
                <div class="hint">Se conserva el campo <code>tipo</code> actual para no romper el guardado de evaluaciones.</div>
              </div>

              <div class="actions">
                <button class="submit-btn" type="submit" ${evaluadores.length === 0 ? "disabled" : ""}>${formButton}</button>
                ${editItem ? '<a class="secondary-link" href="/reportes/evaluados">Cancelar edici&oacute;n</a>' : ""}
              </div>
            </form>
          </div>
        </div>

        <div>
          <div class="card">
            <h2>Listado de evaluados</h2>
            <p>Desde aqu&iacute; controlas altas, bajas y cambios de asignaci&oacute;n para evaluaciones normales y extra.</p>

            <form class="filters" method="GET" action="/reportes/evaluados">
              <div class="field" style="min-width: 220px; margin-bottom: 0;">
                <label>B&uacute;squeda</label>
                <input name="busqueda" placeholder="Nombre, evaluador o identificador" value="${escapeHtml(filters.busqueda)}" />
              </div>
              <div class="field" style="min-width: 180px; margin-bottom: 0;">
                <label>Tipo</label>
                <select name="tipoRegistro">
                  <option value="todos" ${filters.tipoRegistro === "todos" ? "selected" : ""}>Todos</option>
                  <option value="oficial" ${filters.tipoRegistro === "oficial" ? "selected" : ""}>Oficial</option>
                  <option value="extraoficial" ${filters.tipoRegistro === "extraoficial" ? "selected" : ""}>Extraoficial</option>
                </select>
              </div>
              <div class="field" style="min-width: 180px; margin-bottom: 0;">
                <label>Estatus</label>
                <select name="status">
                  <option value="activos" ${filters.status === "activos" ? "selected" : ""}>Activos</option>
                  <option value="inactivos" ${filters.status === "inactivos" ? "selected" : ""}>Inactivos</option>
                  <option value="todos" ${filters.status === "todos" ? "selected" : ""}>Todos</option>
                </select>
              </div>
              <div class="actions" style="margin-top: 24px;">
                <button class="submit-btn" type="submit">Filtrar</button>
                <a class="secondary-link" href="/reportes/evaluados">Limpiar</a>
              </div>
            </form>

            <table>
              <thead>
                <tr>
                  <th>Evaluado</th>
                  <th>Identificador</th>
                  <th>Tipo</th>
                  <th>Puesto</th>
                  <th>&Aacute;rea</th>
                  <th>Campo tipo</th>
                  <th>Estatus</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    res.send(
      renderLayout({
        title: "Panel de Evaluados",
        activeTab: "evaluados",
        intro: "Altas, bajas y modificaciones de evaluados oficiales y extraoficiales.",
        flash: renderFlash(req.query),
        content,
      })
    );
  } catch (error) {
    console.error(error);
    res.status(500).send("Error cargando evaluados");
  }
};

exports.saveEvaluado = async (req, res) => {
  try {
    if (req.body.original_user && req.body.original_evaluado) {
      await updateEvaluado(req.body);
      return redirectWithFlash(res, "/reportes/evaluados", "success", "Evaluado actualizado correctamente.");
    }

    await createEvaluado(req.body);
    return redirectWithFlash(res, "/reportes/evaluados", "success", "Evaluado dado de alta correctamente.");
  } catch (error) {
    console.error(error);
    return redirectWithFlash(
      res,
      "/reportes/evaluados",
      "error",
      error.message,
      req.body.original_user && req.body.original_evaluado
        ? { editUser: req.body.original_user, editEvaluado: req.body.original_evaluado }
        : {}
    );
  }
};

exports.changeEvaluadoStatus = async (req, res) => {
  try {
    await setEvaluadoActivo(
      req.body.evaluador_user,
      req.body.evaluado,
      String(req.body.activo) === "1"
    );

    const message = String(req.body.activo) === "1"
      ? "Evaluado reactivado correctamente."
      : "Evaluado dado de baja correctamente.";

    return redirectWithFlash(res, "/reportes/evaluados", "success", message);
  } catch (error) {
    console.error(error);
    return redirectWithFlash(res, "/reportes/evaluados", "error", error.message);
  }
};
