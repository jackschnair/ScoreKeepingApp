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
 */
export async function handler(event) {
  let connection;
  try {
    const {
      name,
      league,
      location
    } = event || {};

    // Validate required fields
    if (!name || !league || !location) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing required fields' }),
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

    // Insert new team
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
