// Game class

import { Scorekeeper } from "./scorekeeper";

export class Game {

    protected id: string;
    protected date:Date;
    protected game_length!: number;
    protected league: string;
    
    // Should these be of type Team if we're registering teams?
    // That way we don't have to pass in a bunch of players in the constructor.
    //protected home_team: string;
    //protected away_team: string;
    //protected home_players: string[];
    //protected away_players: string[];

    protected home_score: number;
    protected away_score: number;
    protected location: string;
    //protected game_events!: GameEvent[];
    protected scorekeeper!: Scorekeeper;
    protected finalized: boolean;
    //protected winner!: Team / String

    constructor(id:string, date:Date, league:string, location:string){

        this.id = id;
        this.date = new Date()
        this.league = league;
        //this.home_team = home_team;
        //this.away_team = away_team;
        this.home_score = 0;
        this.away_score = 0;
        this.location = location
        this.finalized = false;
    }

}