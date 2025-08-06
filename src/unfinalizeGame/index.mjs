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
 * AWS Lambda handler to unfinalize a game.
 * Expects event with: id (game ID), league (league name), credentials (admin)
 */
export async function handler(event) {
  let connection;
  try {
    const { id, league, credentials } = event || {};

    // Validate required fields
    const missingFields = [];
    if (!id) missingFields.push('id');
    if (!league) missingFields.push('league');
    if (!credentials) missingFields.push('credentials');

    if (missingFields.length > 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: `Missing required fields: ${missingFields.join(', ')}` }),
      };
    }

    connection = mysql.createConnection({
      host: config.host,
      user: config.user,
      password: config.password,
      database: config.database,
    });

    await new Promise((resolve, reject) => {
      connection.connect(err => (err ? reject(err) : resolve()));
    });

    // Validate admin credentials
    const adminResult = await queryAsync(
      connection,
      'SELECT * FROM admin WHERE credentials = ?',
      [credentials]
    );

    if (!adminResult || adminResult.length === 0) {
      connection.end();
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Forbidden: Invalid admin credentials' }),
      };
    }

    // Validate that the league exists
    const leagueResult = await queryAsync(
      connection,
      'SELECT * FROM leagues WHERE name = ?',
      [league]
    );

    if (!leagueResult || leagueResult.length === 0) {
      connection.end();
      return {
        statusCode: 404,
        body: JSON.stringify({ message: `League '${league}' not found` }),
      };
    }

    // Check if the game exists for that league
    const gameResult = await queryAsync(
      connection,
      'SELECT finalized FROM games WHERE id = ? AND league = ?',
      [id, league]
    );

    if (!gameResult || gameResult.length === 0) {
      connection.end();
      return {
        statusCode: 404,
        body: JSON.stringify({ message: `Game with ID '${id}' not found in league '${league}'` }),
      };
    }

    // Unfinalize the game
    await queryAsync(
      connection,
      'UPDATE games SET finalized = false WHERE id = ? AND league = ?',
      [id, league]
    );

    connection.end();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Game with ID '${id}' in league '${league}' has been unfinalized` }),
    };

  } catch (error) {
    if (connection) connection.end();
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error unfinalizing game', error: error.message }),
    };
  }
}
