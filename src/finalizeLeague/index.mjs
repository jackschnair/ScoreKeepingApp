import mysql from 'mysql';
import { config } from './config.mjs';

function queryAsync(connection, sql, params) {
  return new Promise((resolve, reject) => {
    connection.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
}

export async function finalizeLeague(leagueName) {
  let connection;

  try {
    if (!leagueName) {
      throw new Error('League name is required');
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

    // Check if the league exists
    const leagueCheck = await queryAsync(
      connection,
      'SELECT name FROM leagues WHERE name = ?',
      [leagueName]
    );

    if (leagueCheck.length === 0) {
      throw new Error(`League "${leagueName}" does not exist`);
    }

    // Proceed to finalize the league
    const result = await queryAsync(
      connection,
      'UPDATE leagues SET finalized = 1 WHERE name = ?',
      [leagueName]
    );

    connection.end();

    return result.affectedRows > 0;

  } catch (error) {
    if (connection) connection.end();
    console.error('Error finalizing league:', error);
    return false;
  }
}

// Lambda entry point
export async function handler(event) {
  let connection;
  try {
    const { name, credentials } = event || {};

    if (!name || !credentials) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing required fields' }),
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

    // Validate credentials
    const results = await queryAsync(
      connection,
      'SELECT * FROM leagues WHERE name = ? AND credentials = ?',
      [name, credentials]
    );

    if (results.length === 0) {
      connection.end();
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Invalid credentials' }),
      };
    }

    connection.end(); // Close connection before calling finalizeLeague (which opens its own)

    // Finalize the league
    const finalized = await finalizeLeague(name);

    if (!finalized) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Failed to finalize league' }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `League "${name}" finalized successfully.` }),
    };
  } catch (error) {
    if (connection) connection.end();
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' }),
    };
  }
}
