
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
 * AWS Lambda handler for listing all leagues.
 * Returns all leagues and their information from the database.
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

    // Extract admin_credentials from event
    const { admin_credentials } = event || {};
    const missingFields = [];
    if (!admin_credentials) missingFields.push('admin_credentials');
    if (missingFields.length > 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: `Missing required field(s): ${missingFields.join(', ')}` }),
      };
    }

    // Check if admin_credentials exist in admin table
    // works in short term with only one admin. That's the exent of the project anyways.
    const adminResult = await queryAsync(
      connection,
      'SELECT * FROM admin WHERE credentials = ?',
      [admin_credentials]
    );
    if (!adminResult || adminResult.length === 0) {
      connection.end();
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Forbidden: Invalid admin_credentials' }),
      };
    }

    // Select all leagues from the database
    const leagues = await queryAsync(
      connection,
      'SELECT name, sport FROM leagues',
      []
    );

    // For each league, get scorekeepers
    for (const league of leagues) {
      const scorekeepers = await queryAsync(
        connection,
        'SELECT name FROM scorekeepers WHERE league = ?',
        [league.name]
      );
      league.scorekeepers = scorekeepers.map(sk => sk.name);
    }

    connection.end();

    return {
      statusCode: 200,
      body: JSON.stringify({
        count: leagues.length,
        leagues: leagues
      }),
    };
  } catch (error) {
    if (connection) connection.end();
    console.error('Error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return {
        statusCode: 409,
        body: JSON.stringify({
          message: 'Duplicate entry: a record with this value already exists.',
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
        message: 'Error with SQL operation',
        error: error.message,
        sqlMessage: error.sqlMessage,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState
      }),
    };
  }
}