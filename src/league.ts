// League Class

import { existsSync, readFileSync, writeFileSync } from 'fs';
import * as path from 'path';
import { Game } from './game';
import { Scorekeeper } from "./scorekeeper";


export class League {

    protected name: string;
    protected sport: string;
    protected date_created: Date
    //protected schedule: Game[];
    protected credentials!: string
    protected registered_scorekeepers!: Scorekeeper[]; //scorekeepers or scorekeepers?
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
            registered_scorekeepers: this.registered_scorekeepers
            //protected game_rules
        };
    }

    /**
     * Getter for the league name
     * @returns The name of the league
     */
    public getName(): string {
        return this.name;
    }

    /**
     * Registers a scorekeeper by updating their registration status to true in the JSON file
     * @param scorekeeper - The scorekeeper to register
     * @returns The updated scorekeeper with registration status set to true
     */
    public registerScorekeeper(scorekeeper: Scorekeeper): Scorekeeper {
        // Read existing scorekeeper data from JSON file
        const scorekeeperFileName: string = 'scorekeeperStorage.json';
        const scorekeeperFilePath: string = path.join(__dirname, '..', 'data', scorekeeperFileName);
        
        if (!existsSync(scorekeeperFilePath)) {
            throw Error('Scorekeeper storage file does not exist');
        }
        
        const fileContents: string = readFileSync(scorekeeperFilePath, 'utf-8');
        let scorekeepers: any[] = JSON.parse(fileContents);
        
        // Get scorekeeper JSON data
        const scorekeeperData = scorekeeper.toJSON() as any;
        
        // Find the scorekeeper in the array and update their registration status
        const scorekeeperIndex = scorekeepers.findIndex(sk => 
            sk.name === scorekeeperData.name && 
            sk.credentials === scorekeeperData.credentials &&
            sk.league === scorekeeperData.league
        );
        
        if (scorekeeperIndex === -1) {
            throw Error('Scorekeeper not found in storage');
        }
        
        // Update the registration status to true
        scorekeepers[scorekeeperIndex].registration_status = true;
        
        // Write the updated data back to the file
        const jsonString: string = JSON.stringify(scorekeepers);
        
        try {
            writeFileSync(scorekeeperFilePath, jsonString, 'utf-8');
            console.log(`Scorekeeper ${scorekeeperData.name} registered successfully`);
        } catch (error) {
            throw Error('Error writing scorekeeper file');
        }
        
        // Update the scorekeeper object's registration status
        (scorekeeper as any).registration_status = true;
        
        return scorekeeper;
    }

    // create new Game and append to gameStorage.json
    public createGame(id: string, date: Date, location: string): Game {
        // initialize game
        const newGame = new Game(id, date, this.name, location);
        const jsonGame = newGame.toJSON();

        const gameFileName = 'gameStorage.json';
        const gameFilePath = path.join(__dirname, '..', 'data', gameFileName);

        // create array of game objects
        let games: object[];

        // check if game file exists and read or create new
        if (existsSync(gameFilePath)) {
            const fileContents = readFileSync(gameFilePath, 'utf-8');
            games = JSON.parse(fileContents);

            // append new game to existing array
            games.push(jsonGame);
        } else {
            games = [jsonGame];
        }

        // write updated list to file
        const jsonString = JSON.stringify(games, null, 2);

        try {
            writeFileSync(gameFilePath, jsonString, 'utf-8');
            console.log(`Game file written successfully to ${gameFilePath}`);
        } catch (error) {
            throw Error('Error writing game file');
        }

        return newGame;
    }

    // remove game from gameStorage.json
    public deleteGame(gameId: string): boolean {
        const gameFileName: string = 'gameStorage.json';
        const gameFilePath: string = path.join(__dirname, '..', 'data', gameFileName);

        if (!existsSync(gameFilePath)) {
            throw new Error("No games on record");
        }

        const fileContents: string = readFileSync(gameFilePath, 'utf-8');
        let games: any[] = JSON.parse(fileContents);

        // filter out the game by ID
        const filteredGames = games.filter(game => !(game.id === gameId && game.league === this.name));

        // check if anything was actually removed
        if (filteredGames.length === games.length) {
            console.warn(`No game with ID "${gameId}" found.`)
            return false;
        }

        // save updated game list
        const jsonString: string = JSON.stringify(filteredGames, null, 2);

        try {
            writeFileSync(gameFilePath, jsonString, 'utf-8');
            console.log(`Game with ID "${gameId}" deleted successfully.`);
            return true;

        } catch (error) {
            throw new Error('Error writing game file');
        }
    }

    
}






        