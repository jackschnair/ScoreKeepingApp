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
 * AWS Lambda handler for deleting a team.
 */
export async function handler(event) {
  let connection;
  try {
    const { name } = event || {};

    // Validate required field
    if (!name) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing required field: name' }),
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

    // Delete team
    const deleteQuery = `
      DELETE FROM teams WHERE name = ?
    `;

    const params = [name];

    const result = await queryAsync(connection, deleteQuery, params);

    connection.end();

    if (result.affectedRows === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: `Team '${name}' not found` }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Team '${name}' deleted successfully` }),
    };
  } catch (error) {
    if (connection) connection.end();
    console.error('Error:', error);
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
        message: `Error deleting team '${name}': ${error.message}`,
        error: error.message,
        sqlMessage: error.sqlMessage,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState
      }),
    };
  }
}
