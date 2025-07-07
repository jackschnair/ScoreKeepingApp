// Contains functions that an admin would need

import { existsSync, readFileSync, writeFileSync } from 'fs';
import * as path from 'path';
import { League } from "./league";

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