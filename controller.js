import { v4 as uuidv4 } from "uuid";
import moment from "moment-timezone";
import os from "os";
import crypto from "crypto";
import * as dao from "./dao.js";

// Clave pública (ejemplo). En producción, obtén esta clave de forma segura.
const publicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsI71B1BSkSdZf9dXnKzX
s6vn0XqYriB0PZsD4lSfjZ3fjQaP3NqXThZ+vStU/xFAJxQ+QfsKM6cJ/R5wmfDN
oKjQvEeT8BpWj/y1HscEzco1MR74rTEEk1Rwv5yviMq5Q5pX3jDS3t+IemsoDqHR
bjkYYb6zy8yc6IFuVfDhsXCIK/+C5LJ4eJfN9ERnj6c5nOH2T47Anb7oC/JnH2+D
YcxJz4+6I/T2dYIKqfUVoQOa20A92PEnXJccV2z37JdB/0rEZT3+8G2z/nFs3qIW
Y6XjI4n3Sx1k0cKIR2DRkryXAl9xjVYJ98/fD6A4Ftrjcmw0xL8Zh7Kzq56xk0yV
NwIDAQAB
-----END PUBLIC KEY-----`;

// Función para encriptar un texto utilizando RSA y la clave pública
const encryptRSA = (text) => {
  const buffer = Buffer.from(text, "utf8");
  const encrypted = crypto.publicEncrypt(publicKey, buffer);
  return encrypted.toString("base64");
};

// Función para obtener la IP del cliente
const getClientIP = (req) => {
  let ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  if (ip && ip.includes("::ffff:")) {
    ip = ip.split("::ffff:")[1];
  }
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

// Función para transformar los datos de una sesión y formatear las fechas,
// manteniendo los campos sensibles en su forma encriptada (RSA).
const transformSession = (session) => ({
  sessionId: session.sessionId,
  email: session.email,         // Se muestra encriptado (RSA)
  nickname: session.nickname,
  clientIP: session.clientIP,   // Se muestra encriptado (RSA)
  clientMAC: session.clientMAC, // Se muestra encriptado (RSA)
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

  // Encriptamos los datos sensibles utilizando RSA
  const encryptedEmail = encryptRSA(email);
  const encryptedClientIP = encryptRSA(getClientIP(req));
  const encryptedClientMAC = encryptRSA(clientMAC);

  const sessionData = {
    sessionId,
    email: encryptedEmail,
    nickname,
    clientIP: encryptedClientIP,
    clientMAC: encryptedClientMAC,
    serverIP: serverInfo.ip,
    serverMAC: serverInfo.mac,
    createdAt: now,
    lastAccessed: now,
    status: "Activa",
  };

  try {
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
    let session = await dao.getSessionById(sessionId);
    if (!session) {
      return res.status(404).json({ message: "Sesión no encontrada" });
    }
    
    const inactivity = calculateInactivity(session.lastAccessed);

    if (session.status === "Activa" && inactivity >= 300) {
      session.lastAccessed = moment().tz("America/Mexico_City").toDate();
      await dao.updateSession(sessionId, {
        status: "Cerrada por el Sistema",
        lastAccessed: session.lastAccessed,
      });
      session.status = "Cerrada por el Sistema";
    }

    const formattedSession = transformSession(session);
    const response = { ...formattedSession, inactivityDuration: `${inactivity} segundos` };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error en status:", error);
    res.status(500).json({ message: "Error al obtener el estado de la sesión" });
  }
};

// Endpoint para actualizar la sesión (UPDATE)
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
