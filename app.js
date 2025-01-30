import express from "express";
import session from "express-session";
import { v4 as uuidv4 } from "uuid";
import os from "os";
import moment from "moment-timezone";

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessions = {}; // Objeto para almacenar las sesiones activas

// Configuración del middleware de sesiones
app.use(
  session({
    secret: "p4-JBRR-SessionesHTTP-VariablesDeSesion",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 2 * 60 * 1000 }, // 2 minutos de inactividad
  })
);

// Función para obtener la IP del cliente
const getClientIP = (req) => {
  let ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;

  if (ip) {
    // Si el IP es IPv6 con mapeo IPv4 (::ffff:192.168.1.100), extraer solo IPv4
    if (ip.includes("::ffff:")) {
      ip = ip.split("::ffff:")[1];
    }
  }

  return ip;
};

// Función para obtener información de la interfaz de red
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

// Función para calcular el tiempo de inactividad
const calculateInactivity = (lastAccessed) => {
  const now = moment();
  const lastAccess = moment(lastAccessed);
  return now.diff(lastAccess, "seconds");
};

// Endpoint de bienvenida
app.get("/welcome", (req, res) => {
  res.status(200).json({
    message: "Bienvenid@ al API de control de sesiones",
    autor: "Jonathan Baldemar Ramirez Reyes",
  });
});

// Endpoint de login
app.post("/login", (req, res) => {
  const { email, nickname, clientMAC } = req.body;

  if (!email || !nickname || !clientMAC) {
    return res.status(400).json({ message: "Se esperan campos requeridos (email, nickname, clientMAC)" });
  }

  const sessionId = uuidv4();
  const now = moment().tz("America/Mexico_City");

  sessions[sessionId] = {
    sessionId,
    email,
    nickname,
    clientIP: getClientIP(req),
    clientMAC, // Ahora se recibe desde el cliente
    serverIP: serverInfo.ip,
    serverMAC: serverInfo.mac,
    createdAt: now,
    lastAccessed: now,
    inactivityDuration: 0,
  };

  res.status(200).json({
    message: "Inicio de sesión exitoso",
    sessionId,
  });
});

// Endpoint de estado de la sesión
app.get("/status", (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId || !sessions[sessionId]) {
    return res.status(404).json({ message: "Sesión no encontrada" });
  }

  const session = sessions[sessionId];
  session.inactivityDuration = calculateInactivity(session.lastAccessed);

  res.status(200).json({
    sessionId: session.sessionId,
    email: session.email,
    nickname: session.nickname,
    clientIP: session.clientIP,
    clientMAC: session.clientMAC,
    serverIP: session.serverIP,
    serverMAC: session.serverMAC,
    createdAt: session.createdAt.format(),
    lastAccessed: session.lastAccessed.format(),
    inactivityDuration: `${session.inactivityDuration} segundos`,
  });
});

// Endpoint de actualización de la sesión
app.post("/update", (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId || !sessions[sessionId]) {
    return res.status(404).json({ message: "Sesión no encontrada" });
  }

  sessions[sessionId].lastAccessed = moment().tz("America/Mexico_City");
  res.status(200).json({ message: "Sesión actualizada correctamente" });
});

// Endpoint para listar sesiones activas
app.get("/Sessions", (req, res) => {
  const activeSessions = Object.values(sessions).map((session) => ({
    sessionId: session.sessionId,
    email: session.email,
    nickname: session.nickname,
    clientIP: session.clientIP,
    clientMAC: session.clientMAC,
    serverIP: session.serverIP,
    serverMAC: session.serverMAC,
    createdAt: session.createdAt.format(),
    lastAccessed: session.lastAccessed.format(),
    inactivityDuration: `${calculateInactivity(session.lastAccessed)} segundos`,
  }));

  res.status(200).json(activeSessions);
});

// Endpoint de logout
app.post("/logout", (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId || !sessions[sessionId]) {
    return res.status(404).json({ message: "Sesión no encontrada" });
  }

  delete sessions[sessionId];
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send("Error al cerrar sesión");
    }
  });
  res.status(200).json({ message: "Sesión cerrada correctamente" });
});

// Eliminar sesiones inactivas automáticamente
setInterval(() => {
  const now = moment();
  for (const sessionId in sessions) {
    const session = sessions[sessionId];
    const inactivity = calculateInactivity(session.lastAccessed);
    if (inactivity > 120) {
      delete sessions[sessionId];
    }
  }
}, 60 * 1000); // Cada minuto

app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
});
