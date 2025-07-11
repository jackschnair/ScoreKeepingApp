
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
 * AWS Lambda handler for creating a scorekeeper.
 * Expects event with: name, sport, credentials as top-level properties.
 */
export async function handler(event) {
  let connection;
  try {
    const { name, league, credentials } = event || {};

    if (!name || !league || !credentials) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing required fields' }),
      };
    }

    console.log("Connecting to host:", config.host);

    // Connect to MySQL using config.mjs
    connection = mysql.createConnection({
      host: config.host,
      user: config.user,
      password: config.password,
      database: config.database,
    });

    console.log("Connection created");

    // Promisify connection.connect
    await new Promise((resolve, reject) => {
      connection.connect(err => (err ? reject(err) : resolve()));
    });

    console.log("Connection established");

    // Insert into leagues table (credentials in plaintext)
    await queryAsync(
      connection,
      'INSERT INTO scorekeepers (name, league, credentials, registration_status) VALUES (?, ?, ?, 0)',
      [name, league, credentials, 0]
    );

    connection.end();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'scorekeeper created successfully' }),
    };
  } catch (error) {
    if (connection) connection.end();
    console.error('Error:', error);
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Error creating scorekeeper', error: error.message }),
    };
  }
}
    

