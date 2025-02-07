// db.js
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = 'mongodb+srv://jonathanramirezreyes010:ReRssMD5@cluster-jon-230410.ezrya.mongodb.net/sesionesDB?retryWrites=true&w=majority&appName=Cluster-Jon-230410';

export const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Conectado a MongoDB Atlas");
  } catch (error) {
    console.error("Error al conectar a MongoDB Atlas:", error);
  }
};
