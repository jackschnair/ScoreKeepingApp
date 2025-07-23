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
 * AWS Lambda handler for creating a game.
 */
export async function handler(event) {
  let connection;
  try {
    let id, date, league, home_team, away_team, location, scorekeeper, winner, home_score, away_score, finalized, league_credentials;
    ({
      id,
      date,
      league,
      home_team,
      away_team,
      location,
      scorekeeper = null,
      winner = null,
      home_score = 0,
      away_score = 0,
      finalized = false,
      league_credentials
    } = event || {});

    // Validate required fields
    const missingFields = [];
    if (!id) missingFields.push('id');
    if (!date) missingFields.push('date');
    if (!league) missingFields.push('league');
    if (!home_team) missingFields.push('home_team');
    if (!away_team) missingFields.push('away_team');
    if (!location) missingFields.push('location');
    if (!league_credentials) missingFields.push('league_credentials');
    if (missingFields.length > 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: `Missing required fields: ${missingFields.join(', ')}` }),
      };
    }

    // Validate date format: YYYY-MM-DD HH:MM:SS
    const dateTimeRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
    if (!dateTimeRegex.test(date)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Date must be in YYYY-MM-DD HH:MM:SS format' }),
      };
    }

    // Use the provided date string directly (or parse if needed)
    const gameDate = date;

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

    // Validate league_credentials against leagues table
    const leagueRows = await queryAsync(
      connection,
      'SELECT credentials FROM leagues WHERE name = ?',
      [league]
    );
    if (!leagueRows || leagueRows.length === 0) {
      connection.end();
      return {
        statusCode: 404,
        body: JSON.stringify({ message: `League '${league}' not found` }),
      };
    }
    if (leagueRows[0].credentials !== league_credentials) {
      connection.end();
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Invalid credentials for this league' }),
      };
    }

    // Insert new game
    const insertQuery = `
      INSERT INTO games (
        id, date, league, home_team, away_team,
        home_score, away_score, location, scorekeeper,
        finalized, winner
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      id,
      gameDate,
      league,
      home_team,
      away_team,
      home_score,
      away_score,
      location,
      scorekeeper,
      finalized,
      winner
    ];

    await queryAsync(connection, insertQuery, params);

    connection.end();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Game created successfully' }),
    };
  } catch (error) {
    if (connection) connection.end();
    console.error('Error:', error);
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Error creating game', error: error.message }),
    };
  }
}
