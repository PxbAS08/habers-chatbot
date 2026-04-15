const db = require("../config/database");

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeUser(value) {
  return cleanText(value).toLowerCase();
}

function assertUserFormat(user) {
  if (!/^[a-zA-Z0-9_.-]+$/.test(user)) {
    throw new Error("El usuario del evaluador solo puede contener letras, números, punto, guion o guion bajo.");
  }
}

function parseNoemp(value) {
  const clean = cleanText(value);

  if (!/^\d+$/.test(clean)) {
    throw new Error("El número de empleado del evaluador debe ser numérico.");
  }

  return Number(clean);
}

async function getEvaluadorByUser(user, options = {}) {
  const normalized = normalizeUser(user);
  if (!normalized) return null;

  const { includeInactive = false, connection = db } = options;
  const activeSql = includeInactive ? "" : "AND COALESCE(activo, 1) = 1";

  const [rows] = await connection.query(
    `SELECT user, Noemp, Nombre, Puesto, Area, COALESCE(activo, 1) AS activo
     FROM users
     WHERE LOWER(user) = LOWER(?)
       ${activeSql}
     LIMIT 1`,
    [normalized]
  );

  return rows[0] || null;
}

async function listEvaluadores(filters = {}) {
  const status = filters.status || "activos";
  const busqueda = cleanText(filters.busqueda);

  const where = [];
  const values = [];

  if (status === "activos") {
    where.push("COALESCE(u.activo, 1) = 1");
  } else if (status === "inactivos") {
    where.push("COALESCE(u.activo, 1) = 0");
  }

  if (busqueda) {
    where.push(`(
      LOWER(u.user) LIKE LOWER(?)
      OR CAST(u.Noemp AS CHAR) LIKE ?
      OR COALESCE(u.Nombre, '') LIKE ?
      OR COALESCE(u.Puesto, '') LIKE ?
      OR COALESCE(u.Area, '') LIKE ?
    )`);
    values.push(
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
      u.user,
      u.Noemp,
      u.Nombre,
      u.Puesto,
      u.Area,
      COALESCE(u.activo, 1) AS activo,
      (
        SELECT COUNT(*)
        FROM evaluados e
        WHERE LOWER(e.user) = LOWER(u.user)
      ) AS total_evaluados,
      (
        SELECT COUNT(*)
        FROM resultadosdesempeno r
        WHERE LOWER(r.user) = LOWER(u.user)
      ) AS total_evaluaciones
     FROM users u
     ${whereSql}
     ORDER BY COALESCE(u.activo, 1) DESC, u.Nombre ASC, u.user ASC`,
    values
  );

  return rows;
}

async function createEvaluador(data) {
  const user = normalizeUser(data.user);
  const noemp = parseNoemp(data.noemp);
  const nombre = cleanText(data.nombre);
  const puesto = cleanText(data.puesto);
  const area = cleanText(data.area);

  if (!user || !nombre || !puesto || !area) {
    throw new Error("Debes capturar usuario, número de empleado, nombre, puesto y área del evaluador.");
  }

  assertUserFormat(user);

  const [duplicates] = await db.query(
    `SELECT user, Noemp
     FROM users
     WHERE LOWER(user) = LOWER(?)
        OR Noemp = ?
     LIMIT 1`,
    [user, noemp]
  );

  if (duplicates.length) {
    throw new Error("Ya existe un evaluador con ese usuario o número de empleado.");
  }

  await db.query(
    `INSERT INTO users (user, Noemp, Nombre, Puesto, Area, activo)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [user, noemp, nombre, puesto, area]
  );

  return { user };
}

async function updateEvaluador(data) {
  const originalUser = normalizeUser(data.originalUser);
  const user = normalizeUser(data.user);
  const noemp = parseNoemp(data.noemp);
  const nombre = cleanText(data.nombre);
  const puesto = cleanText(data.puesto);
  const area = cleanText(data.area);

  if (!originalUser || !user || !nombre || !puesto || !area) {
    throw new Error("Faltan datos para actualizar el evaluador.");
  }

  assertUserFormat(user);

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const current = await getEvaluadorByUser(originalUser, {
      includeInactive: true,
      connection,
    });

    if (!current) {
      throw new Error("El evaluador a modificar ya no existe.");
    }

    const [duplicates] = await connection.query(
      `SELECT user, Noemp
       FROM users
       WHERE (LOWER(user) = LOWER(?) OR Noemp = ?)
         AND LOWER(user) <> LOWER(?)
       LIMIT 1`,
      [user, noemp, originalUser]
    );

    if (duplicates.length) {
      throw new Error("Ya existe otro evaluador con ese usuario o número de empleado.");
    }

    await connection.query(
      `UPDATE users
       SET user = ?, Noemp = ?, Nombre = ?, Puesto = ?, Area = ?
       WHERE LOWER(user) = LOWER(?)`,
      [user, noemp, nombre, puesto, area, originalUser]
    );

    if (user !== originalUser) {
      await connection.query(
        `UPDATE evaluados
         SET user = ?
         WHERE LOWER(user) = LOWER(?)`,
        [user, originalUser]
      );

      await connection.query(
        `UPDATE resultadosdesempeno
         SET user = ?
         WHERE LOWER(user) = LOWER(?)`,
        [user, originalUser]
      );

      await connection.query(
        `UPDATE bot_sessions
         SET evaluador_user = ?
         WHERE LOWER(evaluador_user) = LOWER(?)`,
        [user, originalUser]
      );
    }

    await connection.commit();
    return { user };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function setEvaluadorActivo(user, activo) {
  const normalized = normalizeUser(user);
  if (!normalized) {
    throw new Error("Evaluador inválido.");
  }

  const [result] = await db.query(
    `UPDATE users
     SET activo = ?
     WHERE LOWER(user) = LOWER(?)`,
    [activo ? 1 : 0, normalized]
  );

  if (!result.affectedRows) {
    throw new Error("No se encontró el evaluador solicitado.");
  }

  return { user: normalized, activo: activo ? 1 : 0 };
}

module.exports = {
  createEvaluador,
  getEvaluadorByUser,
  listEvaluadores,
  setEvaluadorActivo,
  updateEvaluador,
};
