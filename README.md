# Datamuse Word Processor

Processes words from PostgreSQL database and fetches frequency data from Datamuse API.

## What it does

1. Connects to PostgreSQL database
2. Finds words without frequency data (`info` IS NULL)
3. Fetches frequency from Datamuse API
4. Updates database with frequency data
5. Processes 1000 words per batch with 5-second breaks

## Database

- Host: localhost:5433
- Database: puzzle_db
- Username: puzzle_user
- Password: puzzle_password

## Configuration

Edit `datamuseProcessor.js` main() function:
- Batch size: 1000 words
- API delay: 500ms between calls
- Batch delay: 5000ms between batches
