// League Class

import { Scorekeeper } from "./scorekeeper";


export class League {

    protected name: string;
    protected game: string;
    protected date_created: Date
    //protected schedule: Game[];
    protected credentials!: string
    protected registered_scorekeeprs!: Scorekeeper[];
    //protected game_rules


    constructor(name: string, game: string ) {
        this.name = name;
        this.game = game;
        this.date_created = new Date()

    }

}