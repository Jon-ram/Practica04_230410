import express, { request, response } from "express";
import session, { Cookie } from "express-session";
import bodyParser from "body-parser";
import {v4 as uuidv4} from "uuid";
import os from "os";

const app = express();
const PORT=3000;

app.listen(PORT,()=>{
    console.log(`Servidor iniciado en https://localhost:${PORT}`)
});

app.use(express.json())
app.use(express.urlencoded({extended:true}));

const sessions = {};
app.use(
    session({
        secret: "p4-JBRR-SessionesHTTP-VariablesDeSesion",
        resave:false,
        saveUninitialized:false,
        cookie: {maxAge: 5*60*1000}
    })
)

app.get('/',(request,response)=>{
    return response.status(200).json({message: "Bienvenid@ al API de control de sesiones", 
    autor: "Jonathan Baldemar Ramirez Reyes"})
})

const getLocalIp=()=>{
    const networkInterfaces =os.networkInterfaces();
    for(const intefaceName in networkInterfaces){
        const intefaces = networkInterfaces[intefaceName];
        for(const Iface of intefaces){
            if(Iface.family === "IPv4" && !Iface.internal){
                return Iface.address;
            }
        }
    }
    return null;
}

app.post('/login',(request,response)=>{
    const{email,nickname,macAddres}=request.body;
    if(!email || !nickname || !macAddres){
        return response.status(400).json({message: "Se esperan campos requeridos"})
    }
    const sessionId = uuidv4();
    const now = new Date();
    session[sessionId]= {
        sessionId,
        email,
        nickname,
        macAddres,
        ip: getClientIP(request),
        createAt:now,
        lastAccesed:now
    };
    response.status(200).json({
        message: "Se ha ingersado de manera exitosa",
        sessionId,
    });
});

app.post('/logout',(request,response)=>{
    const{sessionId}= request.body;
    if(!sessionId || sessions[sessionId]){
        return response.status(404).json({message:"No se ha encontrado una sesion activa"})
    }
    delete sessions[sessionId];
    request.session.destroy((err)=>{
        if(err){
            return response.status(500).send('Error al cerrar sesion')
        }
    })
    response.status(200).json({message: "logout secessful"})
})

app.post('/update', (request,response)=>{
    const {sessionId,email, nickname} = request.body;

    if(!sessionId || !sessions[sessionId]){
        return response.status(404).json({message: "No existe una sesion activa"})
    }

    if(email) sessions[sessionId].email=email;
    if(nickname) sessions[sessionId].nickname = nickname;
        IdleDeadline()
        sessions[sessionId].lastAcceses = newDate();
})

