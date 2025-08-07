
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
 * Helper to evaluate a condition against event data
 */
function evaluateCondition(condition, eventData) {
  const { field, operator, value } = condition;
  const actualValue = eventData[field];
  
  if (actualValue === undefined) {
    return false; // Field doesn't exist in event data
  }
  
  switch (operator) {
    case '==':
      return actualValue == value;
    case '!=':
      return actualValue != value;
    case '>':
      return actualValue > value;
    case '>=':
      return actualValue >= value;
    case '<':
      return actualValue < value;
    case '<=':
      return actualValue <= value;
    default:
      return false; // Unknown operator
  }
}

/**
 * Helper to validate an event against its rule conditions
 */
function validateEvent(eventType, rule, eventData) {
  if (!rule || !rule.conditions) {
    return false;
  }
  
  // All conditions must be true for the event to be valid
  return rule.conditions.every(condition => evaluateCondition(condition, eventData));
}

/**
 * AWS Lambda handler for validating and creating game events.
 * Accepts game_id, event_type, and event data in event.body.
 * Validates the event against the league's rules using the event's own data.
 */
export async function handler(event) {
  let connection;
  try {
    // Robustly parse input from event.body
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
    
    const { game_id, game_event } = body || {};
    if (!game_id || !game_event) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing required fields: game_id or game_event' }),
      };
    }

    // Extract event_type from game_event
    const { event_type, ...eventData } = game_event;
    if (!event_type) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing event_type in game_event' }),
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

    // Get the game and its associated league
    const gameRows = await queryAsync(
      connection,
      'SELECT league FROM games WHERE id = ?',
      [game_id]
    );
    
    if (!gameRows || gameRows.length === 0) {
      connection.end();
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Game not found' }),
      };
    }
    
    const leagueName = gameRows[0].league;
    
    // Get the league's rules
    const leagueRows = await queryAsync(
      connection,
      'SELECT rules FROM leagues WHERE name = ?',
      [leagueName]
    );
    
    if (!leagueRows || leagueRows.length === 0) {
      connection.end();
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'League not found' }),
      };
    }
    
    // Parse the rules
    let rules = {};
    if (leagueRows[0].rules) {
      try {
        rules = JSON.parse(leagueRows[0].rules);
      } catch (e) {
        connection.end();
        return {
          statusCode: 500,
          body: JSON.stringify({ message: 'Error parsing league rules' }),
        };
      }
    }
    
    // Check if the event type has a rule defined
    const eventRule = rules[event_type];
    if (!eventRule) {
      connection.end();
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          message: `No rule defined for event type: ${event_type}`,
          available_rules: Object.keys(rules)
        }),
      };
    }
    
    // Validate the event against the rule using the event's own data
    const isValid = validateEvent(event_type, eventRule, eventData);
    
    // Get the highest event_id and increment by 1
    const maxEventIdResult = await queryAsync(
      connection,
      'SELECT COALESCE(MAX(event_id), 0) as max_id FROM gameEvents'
    );
    const newEventId = maxEventIdResult[0].max_id + 1;
    
    // Insert the game event into the database
    await queryAsync(
      connection,
      'INSERT INTO gameEvents (event_id, info, game_id, date, valid, type) VALUES (?, ?, ?, NOW(), ?, ?)',
      [newEventId, JSON.stringify(game_event), game_id, isValid, event_type]
    );
    
    connection.end();
    
    if (isValid) {
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          message: 'Event is valid and has been created',
          event_id: newEventId,
          event_type: event_type,
          game_id: game_id,
          league: leagueName
        }),
      };
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          message: 'Event is not valid according to league rules but has been recorded',
          event_id: newEventId,
          event_type: event_type,
          game_id: game_id,
          league: leagueName,
          rule_conditions: eventRule.conditions,
          event_data: eventData
        }),
      };
    }
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
    

