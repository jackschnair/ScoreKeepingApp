
import mysql from 'mysql';
import { config } from './config.mjs';

/**
 * Helper to run a query with mysql and return a Promise.
 */
function queryAsync(connection, sql, params) {
  return new Promise((resolve, reject) => {
    connection.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
}

/**
 * AWS Lambda handler for retrieving a specific game by ID.
 * Returns the game from the games table associated with the provided game_id.
 */
export async function handler(event) {
  let connection;
  try {
    // Connect to MySQL using config.mjs
    connection = mysql.createConnection({
      host: config.host,
      user: config.user,
      password: config.password,
      database: config.database,
    });

    // Promisify connection.connect
    await new Promise((resolve, reject) => {
      connection.connect(err => (err ? reject(err) : resolve()));
    });

    // Extract game_id and league_name from event
    const { game_id, league_name } = event || {};
    const missingFields = [];
    if (!game_id) missingFields.push('game_id');
    if (!league_name) missingFields.push('league_name');
    if (missingFields.length > 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: `Missing required field(s): ${missingFields.join(', ')}` }),
      };
    }

    // Increment the views count for this game
    await queryAsync(
      connection,
      'UPDATE games SET views = COALESCE(views, 0) + 1 WHERE id = ? AND league = ?',
      [game_id, league_name]
    );
    
    // Select the specific game by ID and check it belongs to the specified league
    const games = await queryAsync(
      connection,
      'SELECT id, date, league, location, home_team, away_team, home_score, away_score, finalized, views FROM games WHERE id = ? AND league = ?',
      [game_id, league_name]
    );

    if (!games || games.length === 0) {
      connection.end();
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Game not found in the specified league' }),
      };
    }

    

    connection.end();

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        game: games[0]
      }),
    };
  } catch (error) {
    if (connection) connection.end();
    console.error('Error:', error);
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: 'Error with SQL operation',
        error: error.message,
        sqlMessage: error.sqlMessage,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState
      }),
    };
  }
}
    

