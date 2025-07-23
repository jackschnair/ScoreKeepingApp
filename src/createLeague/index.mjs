
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
    const { name, sport, league_credentials, admin_credentials } = event || {};

    const missingFields = [];
    if (!name) missingFields.push('name');
    if (!sport) missingFields.push('sport');
    if (!admin_credentials) missingFields.push('admin_credentials');
    if (!league_credentials) missingFields.push('league_credentials');
    if (missingFields.length > 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: `Missing required fields: ${missingFields.join(', ')}` }),
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

    // Check if admin_credentials exist in admin table
    // Admin table consists of one row with credentials
    const adminResult = await queryAsync(
      connection,
      'SELECT * FROM admin WHERE credentials = ?',
      [admin_credentials]
    );
    if (!adminResult || adminResult.length === 0) {
      connection.end();
      return {
        statusCode: 403,
        body: JSON.stringify({ message: `Forbidden: Invalid admin credentials` }),
      };
    }

    // Insert into leagues table (store league_credentials in credentials column)
    await queryAsync(
      connection,
      'INSERT INTO leagues (name, sport, credentials, finalized) VALUES (?, ?, ?, ?)',
      [name, sport, league_credentials, 0]
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
    

