
import mysql from 'mysql';
import { config } from './config.mjs';

/**
 * Helper to run a query with MySQL and return a Promise.
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
 * AWS Lambda handler for unassigning a scorekeeper from a game.
 * Expects event with: gameId and scorekeeperName as top-level properties.
 */
export async function handler(event) {
  let connection;
  try {
    const { gameId, scorekeeperName } = event || {};

    if (!gameId || !scorekeeperName) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing required fields: gameId or scorekeeperName' }),
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

    // Confirm game exists
    const gameCheck = await queryAsync(
      connection,
      'SELECT COUNT(*) AS count FROM games WHERE id = ?',
      [gameId]
    );

    if (gameCheck[0].count === 0) {
      connection.end();
      return {
        statusCode: 404,
        body: JSON.stringify({ message: `Game with ID '${gameId}' not found` }),
      };
    }

    // Confirm scorekeeper exists by name
    const scorekeeperCheck = await queryAsync(
      connection,
      'SELECT COUNT(*) AS count FROM scorekeepers WHERE name = ?',
      [scorekeeperName]
    );

    if (scorekeeperCheck[0].count === 0) {
      connection.end();
      return {
        statusCode: 404,
        body: JSON.stringify({ message: `Scorekeeper '${scorekeeperName}' not found` }),
      };
    }

    // Delete the assignment using name instead of ID
    const result = await queryAsync(
      connection,
      'DELETE FROM game_scorekeepers WHERE game_id = ? AND scorekeeper_name = ?',
      [gameId, scorekeeperName]
    );

    connection.end();

    if (result.affectedRows && result.affectedRows > 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: `Scorekeeper '${scorekeeperName}' unassigned from game ${gameId} successfully` }),
      };
    } else {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: `Scorekeeper '${scorekeeperName}' was not assigned to game ${gameId}` }),
      };
    }
  } catch (error) {
    if (connection) connection.end();
    console.error('Error:', error);
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Error unassigning scorekeeper from game', error: error.message }),
    };
  }
}
