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
 * AWS Lambda handler to finalize a game.
 * Expects event with: id (game ID), league (league name), scorekeeperName, credentials
 */
export async function handler(event) {
  let connection;
  try {
    const { id, league, scorekeeperName, credentials } = event || {};

    // Validate required fields
    const missingFields = [];
    if (!id) missingFields.push('id');
    if (!league) missingFields.push('league');
    if (!scorekeeperName) missingFields.push('scorekeeperName');
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

    // Validate scorekeeper credentials (case-insensitive name match)
    const scorekeeperResult = await queryAsync(
      connection,
      `
      SELECT * FROM scorekeepers 
      WHERE LOWER(name) = LOWER(?) AND credentials = ? AND league = ?
      `,
      [scorekeeperName, credentials, league]
    );

    if (!scorekeeperResult || scorekeeperResult.length === 0) {
      connection.end();
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Forbidden: Invalid scorekeeper credentials for this league' }),
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

    // Finalize the game
    await queryAsync(
      connection,
      'UPDATE games SET finalized = true WHERE id = ? AND league = ?',
      [id, league]
    );

    connection.end();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Game with ID '${id}' in league '${league}' has been finalized` }),
    };

  } catch (error) {
    if (connection) connection.end();
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error finalizing game', error: error.message }),
    };
  }
}