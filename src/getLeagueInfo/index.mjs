
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
 * AWS Lambda handler for getting league information.
 * Returns teams and registered scorekeepers for a specific league.
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

    // Extract league_name and admin_credentials from event
    const { league_name, admin_credentials } = event || {};
    const missingFields = [];
    if (!league_name) missingFields.push('league_name');
    if (!admin_credentials) missingFields.push('admin_credentials');
    if (missingFields.length > 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: `Missing required field(s): ${missingFields.join(', ')}` }),
      };
    }

    // Check if admin_credentials exist in admin table
    // works in short term with only one admin. That's the extent of the project anyways.
    const adminResult = await queryAsync(
      connection,
      'SELECT * FROM admin WHERE credentials = ?',
      [admin_credentials]
    );
    if (!adminResult || adminResult.length === 0) {
      connection.end();
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Forbidden: Invalid admin_credentials' }),
      };
    }

    // Check if the league exists
    const leagueResult = await queryAsync(
      connection,
      'SELECT name, sport FROM leagues WHERE name = ?',
      [league_name]
    );
    if (!leagueResult || leagueResult.length === 0) {
      connection.end();
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'League not found' }),
      };
    }

    const league = leagueResult[0];

    // Get teams for the specific league
    const teams = await queryAsync(
      connection,
      'SELECT name FROM teams WHERE league = ?',
      [league_name]
    );

    // Get registered scorekeepers for the specific league
    const scorekeepers = await queryAsync(
      connection,
      'SELECT name FROM scorekeepers WHERE league = ? AND registration_status = 1',
      [league_name]
    );

    // Get games for the specific league that have happened or will happen today (no future dates)
    const games = await queryAsync(
      connection,
      'SELECT id, date, location, home_team, away_team, home_score, away_score, finalized FROM games WHERE league = ? AND DATE(date) <= CURDATE() ORDER BY date DESC',
      [league_name]
    );

    connection.end();

    return {
      statusCode: 200,
      body: JSON.stringify({
        league: {
          name: league.name,
          teams: teams.map(team => team.name),
          registered_scorekeepers: scorekeepers.map(sk => sk.name),
          games: games
        }
      }),
    };
  } catch (error) {
    if (connection) connection.end();
    console.error('Error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return {
        statusCode: 409,
        body: JSON.stringify({
          message: 'Duplicate entry: a record with this value already exists.',
          error: error.sqlMessage,
          code: error.code,
          errno: error.errno,
          sqlState: error.sqlState
        }),
      };
    }
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