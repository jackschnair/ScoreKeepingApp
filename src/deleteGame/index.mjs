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
 * AWS Lambda handler for deleting a game.
 */
export async function handler(event) {
  let connection;
  try {
    const { id, league } = event || {};

    if (!id || !league) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing required fields: id and league' }),
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

    // Delete the game by id and league
    const result = await queryAsync(
      connection,
      'DELETE FROM games WHERE id = ? AND league = ?',
      [id, league]
    );

    connection.end();

    if (result.affectedRows === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: `No game found with id "${id}" in league "${league}"` }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Game with id "${id}" deleted successfully` }),
    };
  } catch (error) {
    if (connection) connection.end();
    console.error('Error deleting game:', error);
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Error deleting game', error: error.message }),
    };
  }
}
