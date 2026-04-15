const db = require("../config/database");
const {
  getEvaluadorByIdentity,
  getEvaluadorByUser,
} = require("./evaluadores.service");

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeUser(value) {
  return cleanText(value).toLowerCase();
}

function normalizeEvaluado(value) {
  return cleanText(value);
}

function parseTipo(value) {
  const tipo = Number(value || 1);

  if (!Number.isInteger(tipo) || tipo < 0) {
    throw new Error("El campo tipo del evaluado debe ser numérico.");
  }

  return tipo;
}

async function getEvaluadosByUser(evaluadorUser, options = {}) {
  const user = normalizeUser(evaluadorUser);
  const {
    extraoficial = null,
    includeInactive = false,
    connection = db,
  } = options;

  const where = ["LOWER(user) = LOWER(?)"];
  const values = [user];

  if (!includeInactive) {
    where.push("COALESCE(activo, 1) = 1");
  }

  if (extraoficial === true) {
    where.push("COALESCE(es_extraoficial, 0) = 1");
  } else if (extraoficial === false) {
    where.push("COALESCE(es_extraoficial, 0) = 0");
  }

  const [rows] = await connection.query(
    `SELECT
      user,
      evaluado,
      tipo,
      nombre,
      puesto,
      COALESCE(area, '') AS area,
      COALESCE(es_extraoficial, 0) AS es_extraoficial,
      COALESCE(activo, 1) AS activo
     FROM evaluados
     WHERE ${where.join(" AND ")}
     ORDER BY nombre ASC, evaluado ASC`,
    values
  );

  return rows;
}

async function getAssignedEvaluado(evaluadorUser, evaluado, options = {}) {
  const user = normalizeUser(evaluadorUser);
  const evaluadoId = normalizeEvaluado(evaluado);
  const {
    extraoficial = null,
    includeInactive = false,
    connection = db,
  } = options;

  if (!user || !evaluadoId) return null;

  const where = [
    "LOWER(user) = LOWER(?)",
    "LOWER(TRIM(evaluado)) = LOWER(TRIM(?))",
  ];
  const values = [user, evaluadoId];

  if (!includeInactive) {
    where.push("COALESCE(activo, 1) = 1");
  }

  if (extraoficial === true) {
    where.push("COALESCE(es_extraoficial, 0) = 1");
  } else if (extraoficial === false) {
    where.push("COALESCE(es_extraoficial, 0) = 0");
  }

  const [rows] = await connection.query(
    `SELECT
      user,
      evaluado,
      tipo,
      nombre,
      puesto,
      COALESCE(area, '') AS area,
      COALESCE(es_extraoficial, 0) AS es_extraoficial,
      COALESCE(activo, 1) AS activo
     FROM evaluados
     WHERE ${where.join(" AND ")}
     LIMIT 1`,
    values
  );

  return rows[0] || null;
}

async function listEvaluados(filters = {}) {
  const tipoRegistro = filters.tipoRegistro || "todos";
  const status = filters.status || "activos";
  const busqueda = cleanText(filters.busqueda);
  const evaluadorUser = normalizeUser(filters.evaluadorUser);

  const where = [];
  const values = [];
  const orderValues = [];
  let orderSql = "ORDER BY COALESCE(e.activo, 1) DESC, e.nombre ASC, e.evaluado ASC";

  if (tipoRegistro === "oficial") {
    where.push("COALESCE(e.es_extraoficial, 0) = 0");
  } else if (tipoRegistro === "extraoficial") {
    where.push("COALESCE(e.es_extraoficial, 0) = 1");
  }

  if (status === "activos") {
    where.push("COALESCE(e.activo, 1) = 1");
  } else if (status === "inactivos") {
    where.push("COALESCE(e.activo, 1) = 0");
  }

  if (evaluadorUser) {
    where.push("LOWER(e.user) = LOWER(?)");
    values.push(evaluadorUser);
  }

  if (busqueda && !evaluadorUser) {
    const matchedEvaluador = await getEvaluadorByIdentity(busqueda, {
      includeInactive: true,
    });

    if (matchedEvaluador) {
      const relatedEvaluados = Array.from(
        new Set(
          [matchedEvaluador.user, matchedEvaluador.Noemp != null ? String(matchedEvaluador.Noemp) : ""]
            .map((value) => normalizeUser(value))
            .filter(Boolean)
        )
      );
      const relatedPlaceholders = relatedEvaluados.map(() => "?").join(", ");

      where.push(`(
        LOWER(e.user) = LOWER(?)
        OR LOWER(TRIM(e.evaluado)) IN (${relatedPlaceholders})
      )`);
      values.push(matchedEvaluador.user, ...relatedEvaluados);

      orderSql = `ORDER BY
        CASE
          WHEN LOWER(e.user) = LOWER(?) THEN 0
          WHEN LOWER(TRIM(e.evaluado)) IN (${relatedPlaceholders}) THEN 1
          ELSE 2
        END,
        COALESCE(e.activo, 1) DESC,
        e.nombre ASC,
        e.evaluado ASC`;
      orderValues.push(matchedEvaluador.user, ...relatedEvaluados);
    } else {
      where.push(`(
        LOWER(e.user) LIKE LOWER(?)
        OR LOWER(e.evaluado) LIKE LOWER(?)
        OR CAST(u.Noemp AS CHAR) LIKE ?
        OR COALESCE(e.nombre, '') LIKE ?
        OR COALESCE(e.puesto, '') LIKE ?
        OR COALESCE(e.area, '') LIKE ?
        OR COALESCE(u.Nombre, '') LIKE ?
      )`);
      values.push(
        `%${busqueda}%`,
        `%${busqueda}%`,
        `%${busqueda}%`,
        `%${busqueda}%`,
        `%${busqueda}%`,
        `%${busqueda}%`,
        `%${busqueda}%`
      );
    }
  } else if (busqueda) {
    where.push(`(
      LOWER(e.user) LIKE LOWER(?)
      OR LOWER(e.evaluado) LIKE LOWER(?)
      OR CAST(u.Noemp AS CHAR) LIKE ?
      OR COALESCE(e.nombre, '') LIKE ?
      OR COALESCE(e.puesto, '') LIKE ?
      OR COALESCE(e.area, '') LIKE ?
      OR COALESCE(u.Nombre, '') LIKE ?
    )`);
    values.push(
      `%${busqueda}%`,
      `%${busqueda}%`,
      `%${busqueda}%`,
      `%${busqueda}%`,
      `%${busqueda}%`,
      `%${busqueda}%`,
      `%${busqueda}%`
    );
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await db.query(
    `SELECT
      e.user,
      e.evaluado,
      e.tipo,
      e.nombre,
      e.puesto,
      COALESCE(e.area, '') AS area,
      COALESCE(e.es_extraoficial, 0) AS es_extraoficial,
      COALESCE(e.activo, 1) AS activo,
      u.Nombre AS evaluador_nombre,
      u.Area AS evaluador_area
     FROM evaluados e
     LEFT JOIN users u
       ON LOWER(u.user) = LOWER(e.user)
     ${whereSql}
     ${orderSql}`,
    [...values, ...orderValues]
  );

  return rows;
}

async function createEvaluado(data) {
  const evaluadorUser = normalizeUser(data.evaluador_user);
  const evaluado = normalizeEvaluado(data.evaluado);
  const tipo = parseTipo(data.tipo);
  const nombre = cleanText(data.nombre);
  const puesto = cleanText(data.puesto);
  const area = cleanText(data.area);
  const esExtraoficial = String(data.es_extraoficial) === "1" ? 1 : 0;

  if (!evaluadorUser || !evaluado || !nombre || !puesto || !area) {
    throw new Error("Debes capturar evaluador, identificador, nombre, puesto y área del evaluado.");
  }

  if (esExtraoficial && !/^[a-zA-Z0-9_.-]+$/.test(evaluado)) {
    throw new Error("Para extraoficiales, el identificador del evaluado debe ser un usuario válido.");
  }

  const evaluador = await getEvaluadorByUser(evaluadorUser);
  if (!evaluador) {
    throw new Error("El evaluador no existe o está inactivo. Debes darlo de alta primero en el panel.");
  }

  const existing = await getAssignedEvaluado(evaluadorUser, evaluado, {
    includeInactive: true,
  });

  if (existing) {
    throw new Error("Ya existe un evaluado registrado con ese evaluador e identificador.");
  }

  await db.query(
    `INSERT INTO evaluados (user, evaluado, tipo, nombre, puesto, area, es_extraoficial, activo)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [evaluadorUser, evaluado, tipo, nombre, puesto, area, esExtraoficial]
  );

  return { evaluadorUser, evaluado };
}

async function updateEvaluado(data) {
  const originalUser = normalizeUser(data.original_user);
  const originalEvaluado = normalizeEvaluado(data.original_evaluado);
  const evaluadorUser = normalizeUser(data.evaluador_user);
  const evaluado = normalizeEvaluado(data.evaluado);
  const tipo = parseTipo(data.tipo);
  const nombre = cleanText(data.nombre);
  const puesto = cleanText(data.puesto);
  const area = cleanText(data.area);
  const esExtraoficial = String(data.es_extraoficial) === "1" ? 1 : 0;

  if (!originalUser || !originalEvaluado || !evaluadorUser || !evaluado || !nombre || !puesto || !area) {
    throw new Error("Faltan datos para actualizar el evaluado.");
  }

  if (esExtraoficial && !/^[a-zA-Z0-9_.-]+$/.test(evaluado)) {
    throw new Error("Para extraoficiales, el identificador del evaluado debe ser un usuario válido.");
  }

  const evaluador = await getEvaluadorByUser(evaluadorUser);
  if (!evaluador) {
    throw new Error("El evaluador no existe o está inactivo. Debes darlo de alta primero en el panel.");
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const current = await getAssignedEvaluado(originalUser, originalEvaluado, {
      includeInactive: true,
      connection,
    });

    if (!current) {
      throw new Error("El evaluado a modificar ya no existe.");
    }

    const [duplicates] = await connection.query(
      `SELECT user, evaluado
       FROM evaluados
       WHERE LOWER(user) = LOWER(?)
         AND LOWER(TRIM(evaluado)) = LOWER(TRIM(?))
         AND NOT (
           LOWER(user) = LOWER(?)
           AND LOWER(TRIM(evaluado)) = LOWER(TRIM(?))
         )
       LIMIT 1`,
      [evaluadorUser, evaluado, originalUser, originalEvaluado]
    );

    if (duplicates.length) {
      throw new Error("Ya existe otro evaluado con ese evaluador e identificador.");
    }

    await connection.query(
      `UPDATE evaluados
       SET user = ?, evaluado = ?, tipo = ?, nombre = ?, puesto = ?, area = ?, es_extraoficial = ?
       WHERE LOWER(user) = LOWER(?)
         AND LOWER(TRIM(evaluado)) = LOWER(TRIM(?))`,
      [evaluadorUser, evaluado, tipo, nombre, puesto, area, esExtraoficial, originalUser, originalEvaluado]
    );

    if (evaluadorUser !== originalUser || evaluado !== originalEvaluado) {
      await connection.query(
        `UPDATE resultadosdesempeno
         SET user = ?, evaluado = ?
         WHERE LOWER(user) = LOWER(?)
           AND LOWER(TRIM(evaluado)) = LOWER(TRIM(?))`,
        [evaluadorUser, evaluado, originalUser, originalEvaluado]
      );

      await connection.query(
        `UPDATE bot_sessions
         SET evaluador_user = ?, evaluado_noemp = ?
         WHERE LOWER(evaluador_user) = LOWER(?)
           AND LOWER(TRIM(evaluado_noemp)) = LOWER(TRIM(?))`,
        [evaluadorUser, evaluado, originalUser, originalEvaluado]
      );
    }

    await connection.commit();
    return { evaluadorUser, evaluado };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function setEvaluadoActivo(evaluadorUser, evaluado, activo) {
  const user = normalizeUser(evaluadorUser);
  const evaluadoId = normalizeEvaluado(evaluado);

  if (!user || !evaluadoId) {
    throw new Error("Evaluado inválido.");
  }

  const [result] = await db.query(
    `UPDATE evaluados
     SET activo = ?
     WHERE LOWER(user) = LOWER(?)
       AND LOWER(TRIM(evaluado)) = LOWER(TRIM(?))`,
    [activo ? 1 : 0, user, evaluadoId]
  );

  if (!result.affectedRows) {
    throw new Error("No se encontró el evaluado solicitado.");
  }

  return { evaluadorUser: user, evaluado: evaluadoId, activo: activo ? 1 : 0 };
}

module.exports = {
  createEvaluado,
  getAssignedEvaluado,
  getEvaluadosByUser,
  listEvaluados,
  setEvaluadoActivo,
  updateEvaluado,
};
