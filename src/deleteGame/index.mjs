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
 * AWS Lambda handler for deleting a game.
 */
export async function handler(event) {
  let connection;
  try {
    let id, league, league_credentials;
    ({ id, league, league_credentials } = event || {});

    // Validate required fields
    const missingFields = [];
    if (!id) missingFields.push('id');
    if (!league) missingFields.push('league');
    if (!league_credentials) missingFields.push('league_credentials');
    if (missingFields.length > 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: `Missing required fields: ${missingFields.join(', ')}` }),
      };
    }

    // Connect to MySQL
    connection = mysql.createConnection({
      host: config.host,
      user: config.user,
      password: config.password,
      database: config.database,
    });

    await new Promise((resolve, reject) => {
      connection.connect(err => (err ? reject(err) : resolve()));
    });

    // Validate league_credentials against leagues table
    const leagueRows = await queryAsync(
      connection,
      'SELECT credentials FROM leagues WHERE name = ?',
      [league]
    );
    if (!leagueRows || leagueRows.length === 0) {
      connection.end();
      return {
        statusCode: 404,
        body: JSON.stringify({ message: `League '${league}' not found` }),
      };
    }
    if (leagueRows[0].credentials !== league_credentials) {
      connection.end();
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Invalid credentials for this league' }),
      };
    }

    // Fetch the game's date
    const games = await queryAsync(
      connection,
      'SELECT date FROM games WHERE id = ? AND league = ?',
      [id, league]
    );

    if (!games || games.length === 0) {
      connection.end();
      return {
        statusCode: 404,
        body: JSON.stringify({ message: `No game found with id "${id}" in league "${league}"` }),
      };
    }

    const gameDate = new Date(games[0].date);
    const now = new Date();
    if (gameDate < now) {
      connection.end();
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Cannot delete a game that has already occurred.' }),
      };
    }

    // Delete the game by id and league
    const result = await queryAsync(
      connection,
      'DELETE FROM games WHERE id = ? AND league = ?',
      [id, league]
    );

    connection.end();

    if (result.affectedRows === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: `No game found with id "${id}" in league "${league}"` }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Game with id "${id}" deleted successfully` }),
    };
  } catch (error) {
    if (connection) connection.end();
    console.error('Error deleting game:', error);
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Error deleting game', error: error.message }),
    };
  }
}
