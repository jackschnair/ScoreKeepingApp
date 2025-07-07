// League Class

import { Scorekeeper } from "./scorekeeper";


export class League {

    protected name: string;
    protected sport: string;
    protected date_created: Date
    //protected schedule: Game[];
    protected credentials!: string
    protected registered_scorekeeprs!: Scorekeeper[];
    //protected game_rules


    constructor(name: string, sport: string ) {
        this.name = name;
        this.sport = sport;
        this.date_created = new Date()

    }

    // genereated using GPT
    public toJSON(): object {
        return {
            name: this.name,
            sport: this.sport,
            date_created: this.date_created.toISOString(),
            //protected schedule: Game[];
            credentials: this.credentials,
            registered_scorekeeprs: this.registered_scorekeeprs
            //protected game_rules
        };
    }



    
}