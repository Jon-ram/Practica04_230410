// controller.js
import { v4 as uuidv4 } from "uuid";
import moment from "moment-timezone";
import os from "os";
import * as dao from "./dao.js";

// Función para obtener la IP del cliente
const getClientIP = (req) => {
  let ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  if (ip && ip.includes("::ffff:")) {
    ip = ip.split("::ffff:")[1];
  }
  return ip;
};

// Función para obtener información de la interfaz de red del servidor
const getNetworkInfo = () => {
  const networkInterfaces = os.networkInterfaces();
  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];
    for (const iface of interfaces) {
      if (iface.family === "IPv4" && !iface.internal) {
        return { ip: iface.address, mac: iface.mac };
      }
    }
  }
  return { ip: null, mac: null };
};

const serverInfo = getNetworkInfo();

// Función para calcular el tiempo de inactividad en segundos
const calculateInactivity = (lastAccessed) => {
  const now = moment();
  const last = moment(lastAccessed);
  return now.diff(last, "seconds");
};

// Endpoint de bienvenida
export const welcome = (req, res) => {
  res.status(200).json({
    message:
      "Bienvenid@ al API de control de sesiones con persistencia en MongoDB Atlas",
    autor: "Tu Nombre",
  });
};

// Endpoint de login
export const login = async (req, res) => {
  const { email, nickname, clientMAC } = req.body;
  if (!email || !nickname || !clientMAC) {
    return res.status(400).json({
      message: "Se esperan campos requeridos: email, nickname, clientMAC",
    });
  }

  const sessionId = uuidv4();
  const now = moment().tz("America/Mexico_City").toDate();

  const sessionData = {
    sessionId,
    email,
    nickname,
    clientIP: getClientIP(req),
    clientMAC,
    serverIP: serverInfo.ip,
    serverMAC: serverInfo.mac,
    createdAt: now,
    lastAccessed: now,
    status: "Activa",
  };

  try {
    // CREATE: se usa el método .save() de Mongoose
    const newSession = await dao.createSession(sessionData);
    res.status(200).json({
      message: "Inicio de sesión exitoso",
      sessionId: newSession.sessionId,
    });
  } catch (error) {
    console.error("Error en login:", error);
    res.status(500).json({ message: "Error al registrar la sesión" });
  }
};

// Endpoint para consultar el estado de la sesión
export const status = async (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) {
    return res.status(400).json({ message: "Se requiere sessionId" });
  }
  try {
    // READ: se usa el método .findOne() de Mongoose
    const session = await dao.getSessionById(sessionId);
    if (!session) {
      return res.status(404).json({ message: "Sesión no encontrada" });
    }
    const inactivity = calculateInactivity(session.lastAccessed);
    res.status(200).json({
      sessionId: session.sessionId,
      email: session.email,
      nickname: session.nickname,
      clientIP: session.clientIP,
      clientMAC: session.clientMAC,
      serverIP: session.serverIP,
      serverMAC: session.serverMAC,
      createdAt: session.createdAt,
      lastAccessed: session.lastAccessed,
      status: session.status,
      inactivityDuration: `${inactivity} segundos`,
    });
  } catch (error) {
    console.error("Error en status:", error);
    res
      .status(500)
      .json({ message: "Error al obtener el estado de la sesión" });
  }
};

// Endpoint para actualizar la sesión (UPDATE)
export const update = async (req, res) => {
  const { sessionId, status } = req.body;
  if (!sessionId) {
    return res.status(400).json({ message: "Se requiere sessionId" });
  }
  try {
    const updateData = {
      lastAccessed: moment().tz("America/Mexico_City").toDate(),
    };
    if (status) {
      updateData.status = status;
    }
    // UPDATE: se usa el método .findOneAndUpdate() de Mongoose
    const updatedSession = await dao.updateSession(sessionId, updateData);
    if (!updatedSession) {
      return res.status(404).json({ message: "Sesión no encontrada" });
    }
    res
      .status(200)
      .json({ message: "Sesión actualizada", session: updatedSession });
  } catch (error) {
    console.error("Error en update:", error);
    res.status(500).json({ message: "Error al actualizar la sesión" });
  }
};

// Endpoint para cerrar la sesión (logout)
export const logout = async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ message: "Se requiere sessionId" });
  }
  try {
    // UPDATE: se cambia el status a "Finalizada por el Usuario" usando .findOneAndUpdate()
    const updatedSession = await dao.updateSession(sessionId, {
      status: "Finalizada por el Usuario",
      lastAccessed: moment().tz("America/Mexico_City").toDate(),
    });
    if (!updatedSession) {
      return res.status(404).json({ message: "Sesión no encontrada" });
    }
    res
      .status(200)
      .json({ message: "Sesión cerrada", session: updatedSession });
  } catch (error) {
    console.error("Error en logout:", error);
    res.status(500).json({ message: "Error al cerrar la sesión" });
  }
};

// Endpoint para obtener todas las sesiones (allSessions)
export const allSessions = async (req, res) => {
  try {
    // READ: se usa el método .find() de Mongoose
    const sessions = await dao.getAllSessions();
    res.status(200).json(sessions);
  } catch (error) {
    console.error("Error en allSessions:", error);
    res.status(500).json({ message: "Error al obtener todas las sesiones" });
  }
};

// Endpoint para obtener todas las sesiones activas (allCurrentSessions)
export const allCurrentSessions = async (req, res) => {
  try {
    // READ: se usa el método .find() de Mongoose con un filtro por status "Activa"
    const sessions = await dao.getAllCurrentSessions();
    res.status(200).json(sessions);
  } catch (error) {
    console.error("Error en allCurrentSessions:", error);
    res
      .status(500)
      .json({ message: "Error al obtener las sesiones activas" });
  }
};

// Endpoint para eliminar TODAS las sesiones (deleteAllSessions) - ¡PELIGROSO!
export const deleteAllSessions = async (req, res) => {
  try {
    // DELETE: se usa el método .deleteMany() de Mongoose
    await dao.deleteAllSessions();
    res
      .status(200)
      .json({ message: "Todas las sesiones han sido eliminadas" });
  } catch (error) {
    console.error("Error en deleteAllSessions:", error);
    res
      .status(500)
      .json({ message: "Error al eliminar todas las sesiones" });
  }
};
