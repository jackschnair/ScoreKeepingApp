// GameEvent Class

// Should this just be an interface?

import { Scorekeeper } from "./scorekeeper";

export class GameEvent{

    protected id:string;
    protected scorekeeper:Scorekeeper;
    protected player:string;
    protected game_id: string;
    protected team:string;
    protected time:Date;
    protected event_type: string;
    protected description:object;

    constructor(id:string, scorekeeper:Scorekeeper, player:string, game_id: string, team:string, event_type: string, description:object) {
        this.id = id;
        this.scorekeeper = scorekeeper;
        this.player = player;
        this.game_id = game_id;
        this.team = team;
        this.time = new Date()
        this.event_type = event_type;
        this.description = description;
    }
}