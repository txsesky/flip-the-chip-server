import express from 'express';
import { createServer } from 'http';
import cors from "cors";
import { Server } from 'colyseus';
import { monitor } from '@colyseus/monitor';
import { WebSocketTransport } from "@colyseus/ws-transport";
import { GameRoom } from './rooms/game-room';

const port = Number(process.env.PORT || 8080);
const app = express();

app.use(cors());
app.use(express.json())

const gameServer = new Server({
  transport: new WebSocketTransport({
    server: createServer(app)
  })
});

gameServer.define("GameRoom", GameRoom);

app.use('/colyseus', monitor());

gameServer.onShutdown(function(){
  console.log(`game server is going down.`);
});

gameServer.listen(port);

console.log(`Listening on http://localhost:${ port }`);
