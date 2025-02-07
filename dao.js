// dao.js
import Session from "./model.js";

export const createSession = async (sessionData) => {
  const session = new Session(sessionData);
  return await session.save(); // CREATE
};

export const getSessionById = async (sessionId) => {
  return await Session.findOne({ sessionId }); // READ
};

export const updateSession = async (sessionId, updateData) => {
  return await Session.findOneAndUpdate({ sessionId }, updateData, { new: true }); // UPDATE
};

export const getAllSessions = async () => {
  return await Session.find(); // READ: todas las sesiones
};

export const getAllCurrentSessions = async () => {
  return await Session.find({ status: "Activa" }); // READ: sesiones activas
};

export const deleteAllSessions = async () => {
  return await Session.deleteMany({}); // DELETE: eliminar todas las sesiones
};
