
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
 * AWS Lambda handler for setting rules for a specific league.
 * Accepts league_name, league_credentials, and rules (JSON) in event.body.
 * Merges/replaces rules in the DB for the league.
 */
export async function handler(event) {
  let connection;
  try {
    // Parse input from event.body
    let body;
    if (event.body) {
      if (typeof event.body === 'string') {
        try {
          body = JSON.parse(event.body);
        } catch (e) {
          return {
            statusCode: 400,
            body: JSON.stringify({ message: 'Invalid JSON in body' }),
          };
        }
      } else {
        body = event.body;
      }
    } else {
      body = event; // fallback for direct Lambda test events
    }
    const { league_name, league_credentials, rules } = body || {};
    if (!league_name || !league_credentials || !rules) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing required fields: league_name, league_credentials, or rules' }),
      };
    }

    // Connect to MySQL using config.mjs
    connection = mysql.createConnection({
      host: config.host,
      user: config.user,
      password: config.password,
      database: config.database,
    });
    await new Promise((resolve, reject) => {
      connection.connect(err => (err ? reject(err) : resolve()));
    });

    // Validate league credentials
    const leagueRows = await queryAsync(
      connection,
      'SELECT rules FROM leagues WHERE name = ? AND credentials = ?',
      [league_name, league_credentials]
    );
    if (!leagueRows || leagueRows.length === 0) {
      connection.end();
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Invalid league_name or league_credentials' }),
      };
    }

    // Parse existing rules (if any)
    let existingRules = {};
    if (leagueRows[0].rules) {
      try {
        existingRules = JSON.parse(leagueRows[0].rules);
      } catch (e) {
        // If parsing fails, start fresh
        existingRules = {};
      }
    }

    // Merge/replace rules
    for (const ruleName of Object.keys(rules)) {
      existingRules[ruleName] = rules[ruleName];
    }

    // Update the rules column in the DB
    await queryAsync(
      connection,
      'UPDATE leagues SET rules = ? WHERE name = ? AND credentials = ?',
      [JSON.stringify(existingRules), league_name, league_credentials]
    );

    connection.end();
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Rules updated successfully', rules: existingRules }),
    };
  } catch (error) {
    if (connection) connection.end();
    console.error('Error:', error);
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
    

