
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
 * AWS Lambda handler for creating a league.
 * Expects event with: name, sport, credentials as top-level properties.
 */
export async function handler(event) {
  let connection;
  try {
    const { name, sport, credentials } = event || {};

    if (!name || !sport || !credentials) {
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

    // Check if credentials exist in admin table
    // Admin table consists of one row with credentials
    const adminResult = await queryAsync(
      connection,
      'SELECT * FROM admin WHERE credentials = ?',
      [credentials]
    );
    if (!adminResult || adminResult.length === 0) {
      connection.end();
      return {
        statusCode: 403,
        body: JSON.stringify({ message: `Forbidden: Invalid admin credentials for league '${name}'` }),
      };
    }

    // Insert into leagues table (credentials in plaintext)
    await queryAsync(
      connection,
      'INSERT INTO leagues (name, sport, credentials) VALUES (?, ?, ?)',
      [name, sport, credentials]
    );

    connection.end();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `League '${name}' created successfully` }),
    };
  } catch (error) {
    if (connection) connection.end();
    console.error('Error:', error);
    return {
      statusCode: 400,
      body: JSON.stringify({ message: `Error creating league '${name}': ${error.message}` }),
    };
  }
}
    

