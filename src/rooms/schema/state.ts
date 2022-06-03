import { Schema, type, MapSchema } from "@colyseus/schema";

export class NetworkedPlayerState extends Schema {
    @type('int16') 
    seat: number;

    @type('string') 
    userName: string;

    @type('string') 
    sessionId: string;

    @type('number') 
    pos: number = 0;

    @type('int16') 
    tick: number = 0;

    @type('int16') 
    isTapped: number = 0;

    @type('number') 
    timeStamp: number = 0;

    @type('int16') 
    isWaitingToStart: number = 0;

    @type('int16') 
    isReadyToStart: number = 0;

    @type('int16') 
    isReadyToRematch: number = 0;

    @type('int16') 
    isReadyToEnd: number = 0;
}

export class NetworkedRoomState extends Schema {
    @type({ map: NetworkedPlayerState }) 
    players: MapSchema<NetworkedPlayerState> = new MapSchema<NetworkedPlayerState>();
    
    //@type('string')
    //phase: string = 'waiting';

    @type('int16')
    winningPlayer: number = -1;

    createPlayer(sessionId: string, seat: number) {
        let player: NetworkedPlayerState = new NetworkedPlayerState();
        player.sessionId = sessionId;
        player.seat = seat;

        this.players.set(sessionId, player);
    }

    removePlayer(sessionId: string) {
        this.players.delete(sessionId);
    }

    moveFocusBar (sessionId: string, pos: any) {
        this.players.get(sessionId).pos = pos;
    }
}