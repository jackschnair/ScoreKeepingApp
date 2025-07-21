
import mysql from 'mysql';
import { config } from './config.mjs';

function queryAsync(connection, sql, params) {
  return new Promise((resolve, reject) => {
    connection.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
}

export async function finalizeLeague(leagueName) {
  let connection;

  try {
    if (!leagueName) {
      throw new Error('League name is required');
    }

    connection = mysql.createConnection({
      host: config.host,
      user: config.user,
      password: config.password,
      database: config.database,
    });

    await new Promise((resolve, reject) => {
      connection.connect(err => (err ? reject(err) : resolve()));
    });

    const result = await queryAsync(
      connection,
      'UPDATE leagues SET finalized = 1 WHERE name = ?',
      [leagueName]
    );

    connection.end();

    return result.affectedRows > 0;

  } catch (error) {
    if (connection) connection.end();
    console.error('Error finalizing league:', error);
    return false;
  }
}
