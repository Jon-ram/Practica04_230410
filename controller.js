// controller.js
import { v4 as uuidv4 } from "uuid";
import moment from "moment-timezone";
import os from "os";
import * as dao from "./dao.js";

// (Opcional) Establece el locale a español
// moment.locale("es");

// Función para obtener la IP del cliente
const getClientIP = (req) => {
  // Se obtiene la IP a través de la cabecera 'x-forwarded-for' o, en su defecto, del objeto de conexión.
  let ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  
  // Si la IP contiene el prefijo "::ffff:" significa que es una dirección IPv4 mapeada en IPv6.
  if (ip && ip.includes("::ffff:")) {
    ip = ip.split("::ffff:")[1];
  }
  
  // Si la IP es "::1" (IPv6 de loopback), se muestra como "localhost" para mayor claridad.
  if (ip === "::1") {
    ip = "10.10.60.17";
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

// Función para formatear fechas de forma legible
const formatDate = (date) =>
  moment(date)
    .tz("America/Mexico_City")
    .format("DD/MM/YYYY HH:mm:ss");

// Función para transformar los datos de una sesión y formatear las fechas
const transformSession = (session) => ({
  sessionId: session.sessionId,
  email: session.email,
  nickname: session.nickname,
  clientIP: session.clientIP,
  clientMAC: session.clientMAC,
  serverIP: session.serverIP,
  serverMAC: session.serverMAC,
  createdAt: formatDate(session.createdAt),
  lastAccessed: formatDate(session.lastAccessed),
  status: session.status,
});

// Endpoint de bienvenida
export const welcome = (req, res) => {
  res.status(200).json({
    message: "Bienvenid@ al API de sesiones",
    autor: "Jonathan Baldemar Ramirez Reyes",
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
// Solo requiere el sessionId en query: ?sessionId=...
// Si la sesión está "Activa" pero han pasado 2 o más minutos de inactividad,
// se actualiza su estado a "Cerrada por el Sistema".
export const status = async (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) {
    return res.status(400).json({ message: "Se requiere sessionId" });
  }
  try {
    let session = await dao.getSessionById(sessionId);
    if (!session) {
      return res.status(404).json({ message: "Sesión no encontrada" });
    }
    
    const inactivity = calculateInactivity(session.lastAccessed);

    // Si la sesión está activa y han pasado 2 minutos o más de inactividad,
    // se cambia el estado a "Cerrada por el Sistema".
    if (session.status === "Activa" && inactivity >= 120) {
      session.lastAccessed = moment().tz("America/Mexico_City").toDate();
      await dao.updateSession(sessionId, {
        status: "Cerrada por el Sistema",
        lastAccessed: session.lastAccessed,
      });
      session.status = "Cerrada por el Sistema";
    }

    const formattedSession = transformSession(session);
    // Añadir la duración de inactividad al objeto formateado
    const response = { ...formattedSession, inactivityDuration: `${inactivity} segundos` };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error en status:", error);
    res.status(500).json({ message: "Error al obtener el estado de la sesión" });
  }
};

// Endpoint para actualizar la sesión (UPDATE)
// Siempre actualiza el campo lastAccessed y establece el estado a "Activa"
export const update = async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ message: "Se requiere sessionId" });
  }
  try {
    const updateData = {
      lastAccessed: moment().tz("America/Mexico_City").toDate(),
      status: "Activa",
    };

    // UPDATE: se usa el método .findOneAndUpdate() de Mongoose
    const updatedSession = await dao.updateSession(sessionId, updateData);
    if (!updatedSession) {
      return res.status(404).json({ message: "Sesión no encontrada" });
    }
    const formattedSession = transformSession(updatedSession);
    res.status(200).json({ message: "Sesión actualizada", session: formattedSession });
  } catch (error) {
    console.error("Error en update:", error);
    res.status(500).json({ message: "Error al actualizar la sesión" });
  }
};

// Endpoint para cerrar la sesión (logout)
// Actualiza el estado a "Cerrada por el Usuario"
export const logout = async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ message: "Se requiere sessionId" });
  }
  try {
    const updatedSession = await dao.updateSession(sessionId, {
      status: "Cerrada por el Usuario",
      lastAccessed: moment().tz("America/Mexico_City").toDate(),
    });
    if (!updatedSession) {
      return res.status(404).json({ message: "Sesión no encontrada" });
    }
    const formattedSession = transformSession(updatedSession);
    res.status(200).json({ message: "Sesión cerrada", session: formattedSession });
  } catch (error) {
    console.error("Error en logout:", error);
    res.status(500).json({ message: "Error al cerrar la sesión" });
  }
};

// Endpoint para obtener todas las sesiones (allSessions)
export const allSessions = async (req, res) => {
  try {
    const sessions = await dao.getAllSessions();
    const transformedSessions = sessions.map((session) => transformSession(session));
    res.status(200).json(transformedSessions);
  } catch (error) {
    console.error("Error en allSessions:", error);
    res.status(500).json({ message: "Error al obtener todas las sesiones" });
  }
};

// Endpoint para obtener todas las sesiones activas (allCurrentSessions)
export const allCurrentSessions = async (req, res) => {
  try {
    const sessions = await dao.getAllCurrentSessions();
    const transformedSessions = sessions.map((session) => transformSession(session));
    res.status(200).json(transformedSessions);
  } catch (error) {
    console.error("Error en allCurrentSessions:", error);
    res.status(500).json({ message: "Error al obtener las sesiones activas" });
  }
};

// Endpoint para eliminar TODAS las sesiones (deleteAllSessions) - ¡PELIGROSO!
export const deleteAllSessions = async (req, res) => {
  try {
    await dao.deleteAllSessions();
    res.status(200).json({ message: "Todas las sesiones han sido eliminadas" });
  } catch (error) {
    console.error("Error en deleteAllSessions:", error);
    res.status(500).json({ message: "Error al eliminar todas las sesiones" });
  }
};
