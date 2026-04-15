const db = require("../config/database");

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeUser(value) {
  return cleanText(value).toLowerCase();
}

function assertUserFormat(user) {
  if (!/^[a-zA-Z0-9_.-]+$/.test(user)) {
    throw new Error("El usuario del evaluador solo puede contener letras, numeros, punto, guion o guion bajo.");
  }
}

function parseNoemp(value) {
  const clean = cleanText(value);

  if (!clean) {
    return null;
  }

  if (!/^\d+$/.test(clean)) {
    throw new Error("El numero de empleado del evaluador debe ser numerico.");
  }

  return Number(clean);
}

function resolveEvaluatorIdentity(data) {
  const rawUser = normalizeUser(data.user);
  const noemp = parseNoemp(data.noemp);
  const user = rawUser || (noemp != null ? String(noemp) : "");

  if (!user && noemp == null) {
    throw new Error("Debes capturar al menos usuario o numero de empleado del evaluador.");
  }

  return { user, noemp };
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

async function getEvaluadorByIdentity(value, options = {}) {
  const raw = cleanText(value);
  if (!raw) return null;

  const normalized = normalizeUser(raw);
  const { includeInactive = false, connection = db } = options;
  const activeSql = includeInactive ? "" : "AND COALESCE(activo, 1) = 1";

  const [rows] = await connection.query(
    `SELECT user, Noemp, Nombre, Puesto, Area, COALESCE(activo, 1) AS activo
     FROM users
     WHERE (
       LOWER(user) = LOWER(?)
       OR CAST(Noemp AS CHAR) = ?
     )
       ${activeSql}
     LIMIT 1`,
    [normalized, raw]
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
  const { user, noemp } = resolveEvaluatorIdentity(data);
  const nombre = cleanText(data.nombre);
  const puesto = cleanText(data.puesto);
  const area = cleanText(data.area);

  if (!nombre || !puesto || !area) {
    throw new Error("Debes capturar nombre, puesto y area del evaluador.");
  }

  assertUserFormat(user);

  const duplicateSql = noemp == null
    ? `SELECT user, Noemp
       FROM users
       WHERE LOWER(user) = LOWER(?)
       LIMIT 1`
    : `SELECT user, Noemp
       FROM users
       WHERE LOWER(user) = LOWER(?)
          OR Noemp = ?
       LIMIT 1`;

  const duplicateParams = noemp == null ? [user] : [user, noemp];
  const [duplicates] = await db.query(duplicateSql, duplicateParams);

  if (duplicates.length) {
    throw new Error("Ya existe un evaluador con ese usuario o numero de empleado.");
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
  const { user, noemp } = resolveEvaluatorIdentity(data);
  const nombre = cleanText(data.nombre);
  const puesto = cleanText(data.puesto);
  const area = cleanText(data.area);

  if (!originalUser || !nombre || !puesto || !area) {
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

    const duplicateSql = noemp == null
      ? `SELECT user, Noemp
         FROM users
         WHERE LOWER(user) = LOWER(?)
           AND LOWER(user) <> LOWER(?)
         LIMIT 1`
      : `SELECT user, Noemp
         FROM users
         WHERE (LOWER(user) = LOWER(?) OR Noemp = ?)
           AND LOWER(user) <> LOWER(?)
         LIMIT 1`;

    const duplicateParams = noemp == null
      ? [user, originalUser]
      : [user, noemp, originalUser];

    const [duplicates] = await connection.query(duplicateSql, duplicateParams);

    if (duplicates.length) {
      throw new Error("Ya existe otro evaluador con ese usuario o numero de empleado.");
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
    throw new Error("Evaluador invalido.");
  }

  const [result] = await db.query(
    `UPDATE users
     SET activo = ?
     WHERE LOWER(user) = LOWER(?)`,
    [activo ? 1 : 0, normalized]
  );

  if (!result.affectedRows) {
    throw new Error("No se encontro el evaluador solicitado.");
  }

  return { user: normalized, activo: activo ? 1 : 0 };
}

module.exports = {
  createEvaluador,
  getEvaluadorByIdentity,
  getEvaluadorByUser,
  listEvaluadores,
  setEvaluadorActivo,
  updateEvaluador,
};
