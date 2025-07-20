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
    const {
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
      finalized = false
    } = event || {};

    // Validate required fields
    if (!id || !date || !league || !home_team || !away_team || !location) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing required fields' }),
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
