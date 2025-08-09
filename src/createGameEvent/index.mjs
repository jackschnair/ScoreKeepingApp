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
 * Helper to remove newlines from game event object recursively
 */
function removeNewlinesFromGameEvent(obj) {
  if (typeof obj === 'string') {
    return obj.replace(/\\n/g, '').replace(/\n/g, '');
  } else if (Array.isArray(obj)) {
    return obj.map(item => removeNewlinesFromGameEvent(item));
  } else if (obj !== null && typeof obj === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      cleaned[key] = removeNewlinesFromGameEvent(value);
    }
    return cleaned;
  }
  return obj;
}

/**
 * Access nested property using dot/bracket notation
 */
function getValueByPath(obj, path) {
  try {
    return path
      .replace(/\[(\w+)\]/g, '.$1') // convert [0] to .0
      .split('.')
      .reduce((acc, part) => acc && acc[part], obj);
  } catch {
    return undefined;
  }
}

/**
 * Evaluate an individual rule condition (value or field comparison)
 */
function evaluateRuleCondition(condition, eventData) {
  let left, right;

  if (condition.type === 'valueComparison') {
    left = getValueByPath(eventData, condition.field);
    right = condition.value;
  } else if (condition.type === 'fieldComparison') {
    left = getValueByPath(eventData, condition.fieldA);
    right = getValueByPath(eventData, condition.fieldB);
  } else {
    return false; // Unknown type
  }

  switch (condition.operator) {
    case '==': return left == right;
    case '!=': return left != right;
    case '>': return left > right;
    case '>=': return left >= right;
    case '<': return left < right;
    case '<=': return left <= right;
    default: return false;
  }
}

/**
 * Evaluate all rule conditions for an event
 */
function validateEvent(eventType, rule, eventData) {
  if (!rule || !rule.conditions) return false;
  return rule.conditions.every(condition =>
    evaluateRuleCondition(condition, eventData)
  );
}

/**
 * AWS Lambda handler for validating and creating game events.
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
      body = event; // fallback for test events
    }

    const { game_id, game_event } = body || {};
    if (!game_id || !game_event) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          message: 'Missing required fields: game_id or game_event',
          received_body: body,
          body_keys: Object.keys(body || {})
        }),
      };
    }

    // Parse game_event if it's a string, then clean it
    let parsedGameEvent;
    try {
      parsedGameEvent = typeof game_event === 'string' ? JSON.parse(game_event) : game_event;
    } catch (e) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          message: 'Invalid JSON in game_event field',
          error: e.message
        }),
      };
    }

    // Clean game_event by removing newlines before processing
    const cleanedGameEvent = removeNewlinesFromGameEvent(parsedGameEvent);

    const { event_type, ...eventData } = cleanedGameEvent;
    if (!event_type) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          message: 'Missing event_type in game_event',
          received_game_event: game_event,
          cleaned_game_event: cleanedGameEvent,
          available_keys: Object.keys(cleanedGameEvent || {})
        }),
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

    // Get league for the game
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

    // Get league rules
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

    let rules = {};
    try {
      rules = leagueRows[0].rules ? JSON.parse(leagueRows[0].rules) : {};
    } catch (e) {
      connection.end();
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Error parsing league rules' }),
      };
    }

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

    // Validate event
    const isValid = validateEvent(event_type, eventRule, eventData);

    // Get next event_id
    const maxEventIdResult = await queryAsync(
      connection,
      'SELECT COALESCE(MAX(event_id), 0) as max_id FROM gameEvents'
    );
    const newEventId = maxEventIdResult[0].max_id + 1;

    // Insert event into DB
    await queryAsync(
      connection,
      'INSERT INTO gameEvents (event_id, info, game_id, date, valid, type) VALUES (?, ?, ?, NOW(), ?, ?)',
      [newEventId, JSON.stringify(cleanedGameEvent), game_id, isValid, event_type]
    );

    connection.end();

    if (isValid) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Event is valid and has been created',
          event_id: newEventId,
          event_type,
          game_id,
          league: leagueName
        }),
      };
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Event is not valid according to league rules but has been recorded',
          event_id: newEventId,
          event_type,
          game_id,
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
