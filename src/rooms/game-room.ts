import { Client, Room } from "colyseus";
import StateMachine from "../statemachine/state-machine";
import { NetworkedRoomState, NetworkedPlayerState } from './schema/state';

enum GameState {
    Waiting = 'Waiting',
    ReadyToStart = 'ReadyToStart',
    InProgress = 'InProgress',
    ReadyToEnd = 'ReadyToEnd',
    End = 'End'
}

export class GameRoom extends Room<NetworkedRoomState>{
    maxClients = 2;

    //playersTapped: number = 0;
    playerCount: number = 0;

    positions: Map<number, number>;
    currentTick = 0;

    gameStates: StateMachine;
    winningPlayer: number = -1;

    onCreate(options: any): void | Promise<any> {
        console.log('room created!');

        let state = new NetworkedRoomState();
        this.setState(state);

        this.gameStates = new StateMachine(this, 'game')

        this.gameStates
            .addState(GameState.Waiting, {
                onEnter: this.onWaitingToStartEnter,
                onUpdate: this.onWaitingToStartUpdate,
                onExit: this.onWaitingToStartExit
            })
            .addState(GameState.ReadyToStart, {
                onEnter: this.onReadyToStartEnter,
                onUpdate: this.onReadyToStartUpdate,
                onExit: this.onReadyToStartExit
            })
            .addState(GameState.InProgress, {
                onEnter: this.onInProgressEnter,
                onUpdate: this.onInProgressUpdate,
                onExit: this.onInProgressExit
            })
            .addState(GameState.ReadyToEnd, {
                onEnter: this.onReadyToEndEnter,
                onUpdate: this.onReadyToEndUpdate,
                onExit: this.onReadyToEndExit
            })
            .addState(GameState.End, {
                onEnter: this.onEndEnter,
                onUpdate: this.onEndUpdate,
                onExit: this.onEndExit
            })

        this.setGameState(GameState.Waiting)

        if (options["roomId"] != null) {
            this.roomId = options["roomId"];
        }

        this.setPatchRate(1000 / 20);

        this.setSimulationInterval((deltaTime) => this.update(deltaTime / 1000)); //16.6ms

        this.onMessage("Tap", (client, message: String) => {
            if (!message) return;

            let player: NetworkedPlayerState = this.state.players[client.sessionId];

            if (!player) return;

            if (player.isTapped == 0) {
                //this.playersTapped++;
                player.isTapped = 1;
                console.log('player ' + player.seat + ' tapped');

                if (this.positions.has(player.tick)) {
                    player.pos = this.positions.get(player.tick);

                    let delta = Math.abs(player.pos - 0.5);
                    console.log("delta = " + delta)
                    if (this.resultDecision(delta)) {
                        if (this.winningPlayer == -1)
                            this.winningPlayer = this.state.winningPlayer = player.seat + 1;
                        else
                            this.winningPlayer = this.state.winningPlayer = 0;
                    }
                }
                else {
                    //for cheaters or high ping player
                    client.close();
                }
            }
        });

        this.onMessage("Name", (client, message: String) => {
            if (!message) return;

            let player: NetworkedPlayerState = this.state.players[client.sessionId];

            if (!player) return;

            player.userName = message.toString();
        });

        this.onMessage("IsWaitingToStart", (client, message: String) => {
            if (!message) return;

            let player: NetworkedPlayerState = this.state.players[client.sessionId];

            if (!player) return;

            if (message == 'true')
                player.isWaitingToStart = 1;
            else
                player.isWaitingToStart = -1;

            console.log("IsWaitingToStart TRUE")
        });
        
        this.onMessage("IsReadyToStart", (client, message: String) => {
            if (!message) return;

            let player: NetworkedPlayerState = this.state.players[client.sessionId];

            if (!player) return;

            if (message == 'true')
                player.isReadyToStart = 1;
            else
                player.isReadyToStart = -1;
                
            console.log("IsReadyToStart TRUE")
        });

        this.onMessage("IsReadyToRematch", (client, message: String) => {
            if (!message) return;

            let player: NetworkedPlayerState = this.state.players[client.sessionId];

            if (!player) return;

            if (message == 'true')
                player.isReadyToRematch = 1;
            else
                player.isReadyToRematch = -1;
        });

        this.onMessage("IsReadyToEnd", (client, message: String) => {
            if (!message) return;

            let player: NetworkedPlayerState = this.state.players[client.sessionId];

            if (!player) return;

            if (message == 'true')
                player.isReadyToEnd = 1;
            else
                player.isReadyToEnd = -1;
        });
    }

    onAuth(client, options, req) {
        //nft token holder validation
        //ban validation
        //..
        //etc. validations
        return true;
    }

    onJoin(client: Client, options?: any, auth?: any): void | Promise<any> {
        console.log('client joined', client.sessionId);

        this.state.createPlayer(client.sessionId, ++this.playerCount);

        this.setGameState(GameState.Waiting)
    }

    onLeave(client: Client, consented?: boolean): void | Promise<any> {
        console.log('client left', client.sessionId);

        //check for if player failed and try to leave

        this.state.removePlayer(client.sessionId)
        this.playerCount--;
        this.unlock();
        this.setGameState(GameState.Waiting);
        //this.state.phase = 'waiting';
    }

    onDispose(): void | Promise<any> {
        console.log('room disposed');
    }

    update(deltaTime: number) {
        this.gameStates.update(deltaTime);
    }

    onWaitingToStartEnter() {
        console.log("onWaitingToStartEnter")
    }

    onWaitingToStartUpdate() {
        if (this.playerCount < 2)
            return;

        let isWaitingToStart = 0;

        this.state.players.forEach((value) => {
            isWaitingToStart += value.isWaitingToStart;
        });

        if (isWaitingToStart == 2) {
            this.lock();
            this.setGameState(GameState.ReadyToStart)
        }
    }

    onWaitingToStartExit() {
        this.state.players.forEach((value) => {
            value.isWaitingToStart = 0;
        });
    }

    onReadyToStartEnter() {
        console.log("onReadyToStartEnter")
    }

    onReadyToStartUpdate() {
        let isReadyToStart = 0;

        this.state.players.forEach((value) => {
            isReadyToStart += value.isReadyToStart;
        });

        if (isReadyToStart == 2) {
            this.setGameState(GameState.InProgress)
        }
    }

    onReadyToStartExit() {
        this.state.players.forEach((value) => {
            value.isReadyToStart = 0;
        });
    }

    onInProgressEnter() {
        console.log("onInProgressEnter")

        this.positions = new Map();
        this.currentTick = 0;
        this.progress = 0;
        this.reverse = false;

        this.state.players.forEach((value) => {
            value.isTapped = 0;
        });
    }

    speed: number = 1;
    progress: number = 0;
    reverse: boolean = false;
    serverTime: number = 0;

    onInProgressUpdate(deltaTime: number) {
        let isTapped = 0;

        this.state.players.forEach((value) => {
            isTapped += value.isTapped;
        });

        if (isTapped == 2) {
            this.setGameState(GameState.ReadyToEnd)
        }

        if (this.progress >= 1 && !this.reverse) {
            this.reverse = true;
            this.progress = 1;
        }
        else if (this.progress <= 0 && this.reverse) {
            this.reverse = false;
            this.progress = 0;
        }

        let modSpeed = this.speed + getRandomArbitrary(-0.5, 0.5);

        if (this.reverse) {
            this.progress -= deltaTime * modSpeed;
        }
        else {
            this.progress += deltaTime * modSpeed;
        }

        this.serverTime += deltaTime;

        this.state.players.forEach((value) => {
            if (value.isTapped == 0) {
                value.pos = this.progress;
                value.tick = this.currentTick;
                value.timeStamp = parseFloat(this.serverTime.toString());
            }
        });

        this.cachePositions(this.progress);
    }

    onInProgressExit() {
    }

    onReadyToEndEnter() {
        console.log("onReadyToEndEnter")
    }

    onReadyToEndUpdate() {
        let isReadyToEnd = 0

        this.state.players.forEach((value) => {
            isReadyToEnd += value.isReadyToEnd;
        });

        if (isReadyToEnd == 2) {
            if (this.winningPlayer == 0 || this.winningPlayer == -1) {
                this.speed += 1;

                this.setGameState(GameState.ReadyToStart)
            }
            else {
                this.speed = 1;

                this.setGameState(GameState.End)
            }
        }
    }

    onReadyToEndExit() {
        this.state.players.forEach((value) => {
            value.isReadyToEnd = 0;
        });

        this.state.winningPlayer = -1
        this.winningPlayer = -1
    }

    onEndEnter() {
        console.log("onEndEnter")

        this.state.players.forEach((value) => {
            value.isReadyToRematch = 0;
        });

        //this.disconnect(); //from client
    }

    onEndUpdate() {
        let isReadyToRematch = 0;

        this.state.players.forEach((value) => {
            isReadyToRematch += value.isReadyToRematch;
        });

        if (isReadyToRematch == 2) {
            this.setGameState(GameState.InProgress)
        }
        else if (isReadyToRematch < 0) {

        }
    }

    onEndExit() {
    }

    setGameState(gameState: string) {
        this.gameStates.setState(gameState);
        this.broadcast("onChangeGameState", gameState)
    }

    cachePositions(pos: number) {
        if (this.positions.size >= 600) { //Clean old elements to detect low latency player to prevent cheating, when player sends calculated tick-pos, but will do real job only after randomizing speed
            this.positions.clear;
            this.currentTick = 0;
        }

        this.positions.set(this.currentTick, pos)

        this.currentTick++;
    }

    resultDecision(delta: number) {
        //variant1
        /*let minChanceToFail = delta * 2;
        let maxChanceToFail = minChanceToFail * getRandomArbitrary(1,2)

        let chanceToFail = getRandomArbitrary(minChanceToFail, maxChanceToFail)

        let chanceToWin = Math.max(maxChanceToFail - (minChanceToFail/2), minChanceToFail)

        if(chanceToFail <= chanceToWin)
            return true;

        return false;*/

        //variant2

        let target = delta * 2
        let rolled = getRandomArbitrary(0.3, 0.5)

        if (rolled >= target)
            /*if(delta < 0.2)*/
            return true

        return false
    }
}

function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
}