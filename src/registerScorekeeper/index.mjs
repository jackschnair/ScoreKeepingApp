
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
 * AWS Lambda handler for registering a scorekeeper.
 * Expects event with: name as top-level property.
 * Changes registration_status from 0 to 1 using only the name as reference.
 */
export async function handler(event) {
  let connection;
  try {
    const { name } = event || {};

    if (!name) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing required field: name' }),
      };
    }

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

    // Update scorekeeper registration_status from 0 to 1 using only name
    const result = await queryAsync(
      connection,
      'UPDATE scorekeepers SET registration_status = 1 WHERE name = ?',
      [name]
    );

    connection.end();

    // Check if a row was actually updated
    if (result.affectedRows && result.affectedRows > 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: `Scorekeeper '${name}' registered successfully` }),
      };
    } else {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: `Scorekeeper '${name}' not found or already registered` }),
      };
    }
  } catch (error) {
    if (connection) connection.end();
    console.error('Error:', error);
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Error registering scorekeeper', error: error.message }),
    };
  }
}
    

