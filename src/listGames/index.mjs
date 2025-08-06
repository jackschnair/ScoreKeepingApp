
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
 * AWS Lambda handler for listing games for a specific league.
 * Returns all games for the specified league after validating league credentials.
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

    // Extract league_name and league_credentials from event
    const { league_name, league_credentials } = event || {};
    const missingFields = [];
    if (!league_name) missingFields.push('league_name');
    if (!league_credentials) missingFields.push('league_credentials');
    if (missingFields.length > 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: `Missing required field(s): ${missingFields.join(', ')}` }),
      };
    }

    // Check if the league exists
    const leagueResult = await queryAsync(
      connection,
      'SELECT name FROM leagues WHERE name = ?',
      [league_name]
    );
    if (!leagueResult || leagueResult.length === 0) {
      connection.end();
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'League not found' }),
      };
    }

    // Check if the credentials match for the league
    const credentialsResult = await queryAsync(
      connection,
      'SELECT name FROM leagues WHERE name = ? AND credentials = ?',
      [league_name, league_credentials]
    );
    if (!credentialsResult || credentialsResult.length === 0) {
      connection.end();
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Forbidden: Invalid league_credentials' }),
      };
    }

    // Select games for the specific league
    const games = await queryAsync(
      connection,
      'SELECT id, date, league, location, home_team, away_team, home_score, away_score, finalized FROM games WHERE league = ?',
      [league_name]
    );

    connection.end();

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        count: games.length,
        games: games 
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
    

