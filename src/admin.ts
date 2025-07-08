// Contains functions that an admin would need

import { existsSync, readFileSync, writeFileSync } from 'fs';
import * as path from 'path';
import { League } from "./league";
import { Scorekeeper } from "./scorekeeper";

// create new League and append json file with new info
export function createLeague(name: string, sport: string): League {

    const leagueFileName: string = 'leagueStorage.json'
    const leagueFilePath: string = path.join(__dirname, '..', 'data', leagueFileName)

    let newLeague: League = new League(name, sport)
    let jsonLeague = newLeague.toJSON()

    let leagues!: object[]

    if (existsSync(leagueFilePath)) {
        const fileContents:string = readFileSync(leagueFilePath, 'utf-8')
        leagues = JSON.parse(fileContents)
        leagues.push(jsonLeague)
    } else {
        leagues = [jsonLeague]
    }

    const jsonString: string = JSON.stringify(leagues)

    try {
        writeFileSync(leagueFilePath, jsonString, 'utf-8');
        console.log(`File written successfully to ${leagueFilePath}`);
    } catch (error) {
        throw Error('Error writing file')
    }

    return newLeague
}

// remove league from storage json file
export function deleteLeague(name: string): Boolean {

    const leagueFileName: string = 'leagueStorage.json'
    const leagueFilePath: string = path.join(__dirname, '..', 'data', leagueFileName)

    if (existsSync(leagueFilePath)) {
        const fileContents:string = readFileSync(leagueFilePath, 'utf-8')

        let leagues: any[] = JSON.parse(fileContents)
        let filteredLeagues = leagues.filter(league => league.name !== name)
        const jsonString: string = JSON.stringify(filteredLeagues)

        try {
            writeFileSync(leagueFilePath, jsonString, 'utf-8');
            console.log(`File written successfully to ${leagueFilePath}`);

        } catch (error) {
            throw Error('Error writing file')
            return false
        }
    } else {
        throw Error ("There are no leagues on record")
        return false
    }


   

    return true
}

// create new Scorekeeper and append json file with new info
export function createScorekeeper(name: string, credentials: string, league: string): Scorekeeper {

    const scorekeeperFileName: string = 'scorekeeperStorage.json'
    const scorekeeperFilePath: string = path.join(__dirname, '..', 'data', scorekeeperFileName)

    let newScorekeeper: Scorekeeper = new Scorekeeper(name, credentials, league)
    let jsonScorekeeper = newScorekeeper.toJSON()

    let scorekeepers!: object[]

    if (existsSync(scorekeeperFilePath)) {
        const fileContents:string = readFileSync(scorekeeperFilePath, 'utf-8')
        scorekeepers = JSON.parse(fileContents)
        scorekeepers.push(jsonScorekeeper)
    } else {
        scorekeepers = [jsonScorekeeper]
    }

    const jsonString: string = JSON.stringify(scorekeepers)

    try {
        writeFileSync(scorekeeperFilePath, jsonString, 'utf-8');
        console.log(`Scorekeeper file written successfully to ${scorekeeperFilePath}`);
    } catch (error) {
        throw Error('Error writing scorekeeper file')
    }

    return newScorekeeper
}

// Unregister a scorekeeper by updating their registration status to false in the JSON file
export function unregisterScorekeeper(scorekeeper: Scorekeeper): Scorekeeper {
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
    
    // Update the registration status to false
    scorekeepers[scorekeeperIndex].registration_status = false;
    
    // Write the updated data back to the file
    const jsonString: string = JSON.stringify(scorekeepers);
    
    try {
        writeFileSync(scorekeeperFilePath, jsonString, 'utf-8');
        console.log(`Scorekeeper ${scorekeeperData.name} unregistered successfully`);
    } catch (error) {
        throw Error('Error writing scorekeeper file');
    }
    
    // Update the scorekeeper object's registration status
    (scorekeeper as any).registration_status = false;
    
    return scorekeeper;
}