
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
 * AWS Lambda handler for listing all teams.
 * Returns all teams and their information from the database.
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

    // Select all teams from the database
    const teams = await queryAsync(
      connection,
      'SELECT name, league, location FROM teams',
      []
    );

    connection.end();

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        count: teams.length,
        teams: teams 
      }),
    };
  } catch (error) {
    if (connection) connection.end();
    console.error('Error:', error);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
    

