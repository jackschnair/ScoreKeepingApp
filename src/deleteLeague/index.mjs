
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
 * AWS Lambda handler for deleting a league.
 * Expects event with: name (the league name to delete) as a top-level property.
 */
export async function handler(event) {
  let connection;
  try {
    const { name, credentials } = event || {};

    if (!name || !credentials) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing required field: name or credentials' }),
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

    // Check credentials before deleting
    const rows = await queryAsync(
      connection,
      'SELECT credentials FROM leagues WHERE name = ?',
      [name]
    );
    if (!rows || rows.length === 0) {
      connection.end();
      return {
        statusCode: 404,
        body: JSON.stringify({ message: `League '${name}' not found` }),
      };
    }
    if (rows[0].credentials !== credentials) {
      connection.end();
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Invalid credentials for this league' }),
      };
    }

    // Delete from leagues table by name
    const result = await queryAsync(
      connection,
      'DELETE FROM leagues WHERE name = ?',
      [name]
    );

    connection.end();

    // Check if a row was actually deleted
    if (result.affectedRows && result.affectedRows > 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: `League '${name}' deleted successfully` }),
      };
    } else {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: `League '${name}' not found` }),
      };
    }
  } catch (error) {
    if (connection) connection.end();
    console.error('Error:', error);
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Error deleting league', error: error.message }),
    };
  }
}
    

