
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
 * AWS Lambda handler for listing all scorekeepers.
 * Returns all scorekeepers and their information from the database.
 */
export async function handler(event) {
  let connection;
  try {
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

    // Select all scorekeepers from the database
    const scorekeepers = await queryAsync(
      connection,
      'SELECT name, league, registration_status FROM scorekeepers',
      []
    );

    connection.end();

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Scorekeepers retrieved successfully',
        count: scorekeepers.length,
        scorekeepers: scorekeepers 
      }),
    };
  } catch (error) {
    if (connection) connection.end();
    console.error('Error:', error);
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Error retrieving scorekeepers', error: error.message }),
    };
  }
}
    

