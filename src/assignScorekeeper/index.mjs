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
 * AWS Lambda handler for assigning a scorekeeper to a game.
 * Expects event with: gameId, scorekeeperName, and credentials as top-level properties.
 */
export async function handler(event) {
  let connection;
  try {
    const { gameId, scorekeeperName, credentials } = event || {};

    if (!gameId || !scorekeeperName || !credentials) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing required fields: gameId, scorekeeperName, or credentials' }),
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

    // Validate credentials for the scorekeeper
    const authCheck = await queryAsync(
      connection,
      'SELECT COUNT(*) AS count FROM scorekeepers WHERE name = ? AND credentials = ?',
      [scorekeeperName, credentials]
    );

    if (authCheck[0].count === 0) {
      connection.end();
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Invalid credentials for scorekeeper' }),
      };
    }

    // Check if the game exists
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

    // Prevent duplicate assignment
    const duplicateCheck = await queryAsync(
      connection,
      'SELECT COUNT(*) AS count FROM games WHERE id = ? AND scorekeeper = ?',
      [gameId, scorekeeperName]
    );

    if (duplicateCheck[0].count > 0) {
      connection.end();
      return {
        statusCode: 409,
        body: JSON.stringify({ message: `Scorekeeper '${scorekeeperName}' is already assigned to game ${gameId}` }),
      };
    }

    // Assign scorekeeper to game
    const result = await queryAsync(
      connection,
      'UPDATE games SET scorekeeper = ? WHERE id = ?',
      [scorekeeperName, gameId] 
    );

    connection.end();

    if (result.affectedRows && result.affectedRows > 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: `Scorekeeper '${scorekeeperName}' assigned to game ${gameId} successfully` }),
      };
    } else {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: `Failed to assign scorekeeper to game` }),
      };
    }
  } catch (error) {
    if (connection) connection.end();
    console.error('Error:', error);
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Error assigning scorekeeper to game', error: error.message }),
    };
  }
}
