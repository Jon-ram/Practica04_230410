// model.js
import mongoose from "mongoose";

const SessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  nickname: { type: String, required: true },
  clientIP: { type: String, required: true },
  clientMAC: { type: String, required: true },
  serverIP: { type: String, required: true },
  serverMAC: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  lastAccessed: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ["Activa", "Inactiva", "Finalizada por el Usuario", "Finalizada por Falla de Sistema"],
    default: "Activa",
  },
});

const Session = mongoose.model("Session", SessionSchema);

export default Session;
