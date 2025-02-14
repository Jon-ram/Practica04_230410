// app.js
import express from "express";
import session from "express-session";
import dotenv from "dotenv";
import { connectDB } from "./db.js";
import * as controller from "./controller.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración del middleware de sesiones (opcional)
app.use(
  session({
    secret: "p4-JBRR-SessionesHTTP-VariablesDeSesion",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 5 * 60 * 1000 }, // 5 minutos
  })
);

// Definición de rutas
app.get("/welcome", controller.welcome);
app.post("/login", controller.login);
app.get("/status", controller.status);
app.post("/update", controller.update);
app.post("/logout", controller.logout);
app.get("/allSessions", controller.allSessions);
app.get("/allCurrentSessions", controller.allCurrentSessions);
// Se utiliza el método DELETE para eliminar todas las sesiones (endpoint peligroso)
app.delete("/deleteAllSessions", controller.deleteAllSessions);

// Conectar a la base de datos y arrancar el servidor
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
});
