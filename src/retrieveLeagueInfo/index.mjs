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
 * AWS Lambda handler to get league summary:
 * - League name
 * - List of teams
 * - Finalized games
 * - Scheduled games today
 */
export async function handler(event) {
  let connection;
  try {
    // Extract league_name from event
    const { league_name } = event || {};

    if (!league_name) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing required field: league_name' }),
      };
    }

    // Create connection
    connection = mysql.createConnection({
      host: config.host,
      user: config.user,
      password: config.password,
      database: config.database,
    });

    await new Promise((resolve, reject) => {
      connection.connect(err => (err ? reject(err) : resolve()));
    });

    // Confirm league exists
    const leagueResult = await queryAsync(
      connection,
      'SELECT name FROM leagues WHERE name = ?',
      [league_name]
    );

    if (!leagueResult || leagueResult.length === 0) {
      connection.end();
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'League not found' }),
      };
    }

    const league = leagueResult[0];

    // Get teams
    const teamsResult = await queryAsync(
      connection,
      'SELECT name FROM teams WHERE league = ?',
      [league_name]
    );
    const teams = teamsResult.map(team => team.name);

    // Finalized games (any date)
    const finalizedGames = await queryAsync(
      connection,
      `
      SELECT 
        id AS \`Game ID\`,
        league AS \`League\`,
        home_team AS \`Home Team\`,
        away_team AS \`Away Team\`,
        location AS \`Location\`,
        DATE_FORMAT(date, '%Y-%m-%d %H:%i:%s') AS \`Date and Time\`
      FROM games
      WHERE league = ? AND finalized = 1
      ORDER BY date DESC
      `,
      [league_name]
    );

    // Scheduled games for today
    const scheduledGamesToday = await queryAsync(
      connection,
      `
      SELECT 
        id AS \`Game ID\`,
        league AS \`League\`,
        home_team AS \`Home Team\`,
        away_team AS \`Away Team\`,
        location AS \`Location\`,
        DATE_FORMAT(date, '%Y-%m-%d %H:%i:%s') AS \`Date and Time\`
      FROM games
      WHERE league = ? AND finalized = 0 AND DATE(date) = CURDATE()
      ORDER BY date ASC
      `,
      [league_name]
    );

    connection.end();

    return {
      statusCode: 200,
      body: JSON.stringify({
        league: {
          name: league.name,
          teams,
          finalized_games: finalizedGames,
          scheduled_games_today: scheduledGamesToday
        }
      }),
    };

  } catch (error) {
    if (connection) connection.end();
    console.error('Error:', error);
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: 'Error retrieving league summary',
        error: error.message,
        sqlMessage: error.sqlMessage,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState
      }),
    };
  }
}
