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
 * AWS Lambda handler for unregistering a scorekeeper (league-based).
 * Expects event with: scorekeeperName, league_name, league_credentials
 */
export async function handler(event) {
  let connection;
  try {
    const { scorekeeperName, league_name, league_credentials } = event || {};

    if (!scorekeeperName || !league_name || !league_credentials) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing required fields: scorekeeperName, league_name, league_credentials' }),
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

    // Validate league credentials
    const leagueResult = await queryAsync(
      connection,
      'SELECT * FROM leagues WHERE name = ? AND credentials = ?',
      [league_name, league_credentials]
    );

    if (!leagueResult || leagueResult.length === 0) {
      connection.end();
      return {
        statusCode: 403,
        body: JSON.stringify({ message: `Forbidden: Invalid league credentials or league not found` }),
      };
    }

    // League can only unregister scorekeepers from their own league
    const updateResult = await queryAsync(
      connection,
      'UPDATE scorekeepers SET registration_status = 0 WHERE LOWER(name) = LOWER(?) AND league = ?',
      [scorekeeperName, league_name]
    );

    connection.end();

    if (updateResult.affectedRows === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Scorekeeper not found' }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Scorekeeper unregistered successfully' }),
    };

  } catch (error) {
    if (connection) connection.end();
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error unregistering scorekeeper', error: error.message }),
    };
  }
}
