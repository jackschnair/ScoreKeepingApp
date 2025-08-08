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
 * AWS Lambda handler for loading play-by-play events by league and game ID.
 */
export async function handler(event) {
  let connection;
  try {
    // Parse and normalize input
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
      body = event;
    }

    const { league, game_id } = body || {};
    if (!league || !game_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing required fields: league or game_id' }),
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

    // Confirm league exists
    const leagueRows = await queryAsync(
      connection,
      'SELECT name FROM leagues WHERE name = ?',
      [league]
    );
    if (!leagueRows || leagueRows.length === 0) {
      connection.end();
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'League not found' }),
      };
    }

    // Confirm game belongs to league
    const gameRows = await queryAsync(
      connection,
      'SELECT id FROM games WHERE id = ? AND league = ?',
      [game_id, league]
    );
    if (!gameRows || gameRows.length === 0) {
      connection.end();
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Game not found in the specified league' }),
      };
    }

    // Fetch play-by-play events ordered by event_id ascending
    const events = await queryAsync(
      connection,
      'SELECT event_id, info, date, valid, type FROM gameEvents WHERE game_id = ? ORDER BY event_id ASC',
      [game_id]
    );

    connection.end();

    // Parse event info JSON for each event
    const parsedEvents = events.map(e => {
      let infoObj;
      try {
        infoObj = JSON.parse(e.info);
      } catch {
        infoObj = null; // fallback if JSON parse fails
      }
      return {
        event_id: e.event_id,
        date: e.date,
        valid: e.valid,
        type: e.type,
        info: infoObj,
      };
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        league,
        game_id,
        play_by_play: parsedEvents,
      }),
    };

  } catch (error) {
    if (connection) connection.end();
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error loading play-by-play events',
        error: error.message,
        sqlMessage: error.sqlMessage,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState
      }),
    };
  }
}
