Jack Schnair and James Graham's Scorekeeping Project for Design of Software Systems

Once you check out this repository, enter the command 'npm install' to properly install all dependencies.

Webpage can be found here: https://superiorscorekeeping.s3.us-east-2.amazonaws.com/interface.html

Admin password is "password".

JSON events can be found in /src/JSON Events in the repository. 

Note that when pasting JSON into our "setRules" or "createGameEvent" use cases on the webpage you should only include the JSON that follows "game_event". 

ex: {
  "scorekeeperName": "Jack Schnair",
  "credentials": "password",
  "game_id": "22",
  "game_event": {
    ...
  }
}

Just include the {...} part in the json input textbox.

Our twelve use cases for Iteration 3:

1. List Games
2. Set Rules
3. Get League Info
4. Unregister Scorekeeper (League)
5. Unregister Scorekeeper (Admin)
6. Provide report of consumer accesses
7. Unfinalize game
8. Create game event
9. Finalize game
10. Retrieve information for Leauge
11. Retrieve information for any Game in League
12. Retrieve play-by-play information for game

Our six use cases for Iteration 2:
1. Create Team
2. Delete Team
3. List Leaugues
4. Finalize League
5. Assign Scorekeeper
6. Unassign Scorekeeper

Our six use cases for Iteration 1:
1. Create League
2. Delete League
3. Create Game
4. Delete Game
5. Create Scorekeeper
6. Register Scorekeeper

URL for the landing page: https://superiorscorekeeping.s3.us-east-2.amazonaws.com/interface.html

Cursor and chatGPT prompts we used are found in prompts.txt