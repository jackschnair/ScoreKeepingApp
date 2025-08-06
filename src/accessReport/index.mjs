
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
 * AWS Lambda handler for generating access reports.
 * Returns views count for each game and aggregate views for each league.
 * Requires admin credentials for access.
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
    if (!admin_credentials) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing required field: admin_credentials' }),
      };
    }

    // Check if admin_credentials exist in admin table
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

    // Get views count for each game
    const gamesWithViews = await queryAsync(
      connection,
      'SELECT id, league, home_team, away_team, views as views FROM games ORDER BY league, id',
      []
    );

    // Get aggregate views count for each league
    const leagueViews = await queryAsync(
      connection,
      'SELECT league, SUM(COALESCE(views, 0)) as total_views, COUNT(*) as total_games FROM games GROUP BY league ORDER BY total_views DESC',
      []
    );

    connection.end();

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        league_views: leagueViews,
        game_views: gamesWithViews
      }),
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
    

