// Scorekeeper Class

export class Scorekeeper {

    protected name: string;
    private credentials: string;
    protected registration_status: boolean;
    protected league: string;

    constructor(name:string, credentials: string, league: string) {
        this.name = name;
        this.credentials = credentials;
        this.league = league;
        this.registration_status = false;
    }



}