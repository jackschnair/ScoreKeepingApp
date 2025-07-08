// Class: Design of Software Systems
// Author: James Graham, Jack Schnair

import { createLeague, createScorekeeper, unregisterScorekeeper } from "./admin"

console.log()

let league = createLeague("Soccer League", "Soccer")
let scorekeeper = createScorekeeper("Jack Doe", "123456", league.getName())
league.registerScorekeeper(scorekeeper)
unregisterScorekeeper(scorekeeper)

console.log("\nDone")
