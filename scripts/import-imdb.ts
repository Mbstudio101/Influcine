import Database, { Statement } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const IMDB_PATH = '/Users/marvens/Desktop/IMDB';
const DB_PATH = path.resolve(process.cwd(), 'local-data/imdb.db');

// Initialize Database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

console.log(`Creating database at ${DB_PATH}...`);

// Create Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS titles (
    tconst TEXT PRIMARY KEY,
    titleType TEXT,
    primaryTitle TEXT,
    originalTitle TEXT,
    isAdult INTEGER,
    startYear INTEGER,
    endYear INTEGER,
    runtimeMinutes INTEGER,
    genres TEXT
  );

  CREATE TABLE IF NOT EXISTS ratings (
    tconst TEXT PRIMARY KEY,
    averageRating REAL,
    numVotes INTEGER
  );
  
  CREATE INDEX IF NOT EXISTS idx_titles_primaryTitle ON titles(primaryTitle);
  CREATE INDEX IF NOT EXISTS idx_titles_startYear ON titles(startYear);
`);

async function processFile(filename: string, tableName: string, insertStmt: Statement, transformFn: (line: string) => unknown[] | null) {
  const filePath = path.join(IMDB_PATH, filename);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return;
  }

  console.log(`Processing ${filename}...`);
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let count = 0;
  let headersSkipped = false;
  
  const BATCH_SIZE = 10000;
  let batch: unknown[][] = [];

  const flushBatch = db.transaction((data: unknown[][]) => {
    for (const row of data) {
      try {
        insertStmt.run(...row);
      } catch (err) {
        // Ignore duplicate key errors or constraint violations
      }
    }
  });

  for await (const line of rl) {
    if (!headersSkipped) {
      headersSkipped = true;
      continue;
    }

    const row = transformFn(line);
    if (row) {
      batch.push(row);
      count++;
    }

    if (batch.length >= BATCH_SIZE) {
      flushBatch(batch);
      batch = [];
      if (count % 100000 === 0) {
        console.log(`Imported ${count} rows from ${filename}`);
      }
    }
  }

  if (batch.length > 0) {
    flushBatch(batch);
  }

  console.log(`Finished ${filename}. Total rows: ${count}`);
}

// Transform functions
const parseNull = (val: string) => (val === '\\N' ? null : val);
const parseIntNull = (val: string) => (val === '\\N' ? null : parseInt(val, 10));
const parseFloatNull = (val: string) => (val === '\\N' ? null : parseFloat(val));

const transformTitle = (line: string) => {
  const parts = line.split('\t');
  // tconst, titleType, primaryTitle, originalTitle, isAdult, startYear, endYear, runtimeMinutes, genres
  // We only want movies and tv series to keep size manageable if needed, but let's take all
  // Filter for common types to reduce noise if database gets too big?
  // For now, let's keep 'movie', 'tvSeries', 'tvMiniSeries', 'tvMovie', 'video'
  const type = parts[1];
  // prevent unused variable error
  if (!type) return null;
  // if (!['movie', 'tvSeries', 'tvMiniSeries', 'tvMovie', 'short'].includes(type)) return null;

  return [
    parts[0], // tconst
    parts[1], // titleType
    parts[2], // primaryTitle
    parts[3], // originalTitle
    parseIntNull(parts[4]), // isAdult
    parseIntNull(parts[5]), // startYear
    parseIntNull(parts[6]), // endYear
    parseIntNull(parts[7]), // runtimeMinutes
    parseNull(parts[8]) // genres
  ];
};

const transformRating = (line: string) => {
  const parts = line.split('\t');
  return [
    parts[0], // tconst
    parseFloatNull(parts[1]), // averageRating
    parseIntNull(parts[2]) // numVotes
  ];
};

async function main() {
  const insertTitle = db.prepare(`
    INSERT OR REPLACE INTO titles (tconst, titleType, primaryTitle, originalTitle, isAdult, startYear, endYear, runtimeMinutes, genres)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertRating = db.prepare(`
    INSERT OR REPLACE INTO ratings (tconst, averageRating, numVotes)
    VALUES (?, ?, ?)
  `);

  // Process titles first
  await processFile('title.basics.tsv', 'titles', insertTitle, transformTitle);
  
  // Process ratings
  await processFile('title.ratings.tsv', 'ratings', insertRating, transformRating);

  console.log('Ingestion complete!');
  db.close();
}

main().catch(console.error);
