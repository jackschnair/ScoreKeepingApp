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
 * AWS Lambda handler for creating a team.
 * Expects event with: name, league, location, and team_credentials as top-level properties.
 */
export async function handler(event) {
  let connection;
  let name, league, location, league_credentials;
  try {
    ({ name, league, location, league_credentials } = event || {});

    // Validate required fields
    const missingFields = [];
    if (!name) missingFields.push('name');
    if (!league) missingFields.push('league');
    if (!location) missingFields.push('location');
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
      'SELECT credentials, finalized FROM leagues WHERE name = ?',
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
    if (leagueRows[0].finalized === 1 || leagueRows[0].finalized === true || leagueRows[0].finalized === '1') {
      connection.end();
      return {
        statusCode: 400,
        body: JSON.stringify({ message: `Cannot create a team: League '${league}' is finalized.` }),
      };
    }

    // Insert new team (without credentials)
    const insertQuery = `
      INSERT INTO teams (
        name, league, location
      ) VALUES (?, ?, ?)
    `;

    const params = [
      name,
      league,
      location
    ];

    await queryAsync(connection, insertQuery, params);

    connection.end();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Team '${name}' created successfully` }),
    };
  } catch (error) {
    if (connection) connection.end();
    if (error.code === 'ER_DUP_ENTRY') {
      return {
        statusCode: 409,
        body: JSON.stringify({
          message: `Duplicate entry: a team with the name '${name}' already exists.`,
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
        message: `Error creating team '${name}': ${error.message}`,
        error: error.message,
        sqlMessage: error.sqlMessage,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState
      }),
    };
  }
}
