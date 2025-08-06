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
 * AWS Lambda handler for unregistering a scorekeeper.
 * Expects event with: scorekeeperName, credentials (admin)
 */
export async function handler(event) {
  let connection;
  try {
    const { scorekeeperName, credentials } = event || {};

    if (!scorekeeperName || !credentials) {
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

    // Validate admin credentials
    const adminResult = await queryAsync(
      connection,
      'SELECT * FROM admin WHERE credentials = ?',
      [credentials]
    );

    if (!adminResult || adminResult.length === 0) {
      connection.end();
      return {
        statusCode: 403,
        body: JSON.stringify({ message: `Forbidden: Invalid admin credentials` }),
      };
    }

    // Case insensitive delete of scorekeeper by name
    const deleteResult = await queryAsync(
      connection,
      'DELETE FROM scorekeepers WHERE LOWER(name) = LOWER(?)',
      [scorekeeperName]
    );

    connection.end();

    if (deleteResult.affectedRows === 0) {
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
