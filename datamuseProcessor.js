const { Pool } = require('pg');
const DatamuseService = require('./DatamuseService');

// Database configuration
const dbConfig = {
    user: 'puzzle_user',
    host: 'localhost',
    database: 'puzzle_db',
    password: 'puzzle_password',
    port: 5433,
    driver: 'org.postgresql.Driver'
};

// Create PostgreSQL connection pool
const pool = new Pool(dbConfig);


/**
 * Query words from database that need frequency information
 * @param {number} limit - Maximum number of words to fetch
 * @returns {Promise<Array>} Array of word objects
 */
async function queryWordsNeedingInfo(limit = 100) {
    try {
        const query = `
            SELECT word 
            FROM dictionary d
            WHERE d."language" = 'english'
            AND d.source = 'wiktionary'
            AND d.info IS NULL
            ORDER BY d.created_at ASC
            LIMIT $1
        `;
        
        const result = await pool.query(query, [limit]);
        console.log(`Found ${result.rows.length} words needing frequency information`);
        return result.rows;
    } catch (error) {
        console.error('Error querying words from database:', error);
        throw error;
    }
}

/**
 * Update word info in the database
 * @param {string} word - The word to update
 * @param {Object} info - The frequency information to store
 * @returns {Promise<boolean>} Success status
 */
async function updateWordInfo(word, info) {
    try {
        const query = `
            UPDATE dictionary 
            SET info = $1 
            WHERE word = $2 
            AND "language" = 'english' 
            AND source = 'wiktionary'
        `;
        
        const result = await pool.query(query, [JSON.stringify(info), word]);
        console.log(`Updated info for word: ${word}`);
        return result.rowCount > 0;
    } catch (error) {
        console.error(`Error updating word info for "${word}":`, error);
        throw error;
    }
}

/**
 * Process words by fetching frequency data and updating database
 * @param {number} batchSize - Number of words to process in this batch
 * @param {number} delayMs - Delay between API calls to avoid rate limiting
 */
async function processWords(batchSize = 1000, delayMs = 1000) {
    try {
        console.log('Starting word processing...');
        
        // Get words that need frequency information
        const words = await queryWordsNeedingInfo(batchSize);
        
        if (words.length === 0) {
            console.log('No words found that need frequency information');
            return;
        }
        
        console.log(`Processing ${words.length} words...`);
        
        let processedCount = 0;
        let successCount = 0;
        let errorCount = 0;
        
        for (const wordRow of words) {
            const word = wordRow.word;
            
            try {
                // Fetch frequency data from Datamuse
                const frequencyInfo = await DatamuseService.fetchWordFrequency(word);
                
                // Update database with frequency information
                const updateSuccess = await updateWordInfo(word, frequencyInfo);
                
                if (updateSuccess) {
                    successCount++;
                    console.log(`✓ Successfully processed: ${word}`);
                } else {
                    errorCount++;
                    console.log(`✗ Failed to update database for: ${word}`);
                }
                
                processedCount++;
                
                // Add delay between requests to avoid rate limiting
                if (processedCount < words.length) {
                    console.log(`Waiting ${delayMs}ms before next request...`);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }
                
            } catch (error) {
                errorCount++;
                console.error(`Error processing word "${word}":`, error.message);
            }
        }
        
        console.log('\n=== Batch Processing Summary ===');
        console.log(`Total words processed: ${processedCount}`);
        console.log(`Successful updates: ${successCount}`);
        console.log(`Errors: ${errorCount}`);
        
        return { processedCount, successCount, errorCount };
        
    } catch (error) {
        console.error('Error in processWords:', error);
        throw error;
    }
}

/**
 * Process all words in batches with breaks between batches
 * @param {number} batchSize - Number of words to process per batch
 * @param {number} delayMs - Delay between API calls within a batch
 * @param {number} batchDelayMs - Delay between batches (5 seconds default)
 */
async function processAllWords(batchSize = 1000, delayMs = 1000, batchDelayMs = 5000) {
    let totalProcessed = 0;
    let totalSuccess = 0;
    let totalErrors = 0;
    let batchNumber = 1;
    
    console.log('=== Starting Continuous Processing ===');
    console.log(`Batch size: ${batchSize} words`);
    console.log(`Delay between API calls: ${delayMs}ms`);
    console.log(`Delay between batches: ${batchDelayMs}ms\n`);
    
    while (true) {
        try {
            console.log(`\n🔄 Starting Batch #${batchNumber}`);
            console.log('='.repeat(50));
            
            const result = await processWords(batchSize, delayMs);
            
            if (result.processedCount === 0) {
                console.log('\n🎉 All words have been processed! No more words found.');
                break;
            }
            
            totalProcessed += result.processedCount;
            totalSuccess += result.successCount;
            totalErrors += result.errorCount;
            
            console.log(`\n📊 Batch #${batchNumber} completed:`);
            console.log(`   Processed: ${result.processedCount}`);
            console.log(`   Success: ${result.successCount}`);
            console.log(`   Errors: ${result.errorCount}`);
            
            batchNumber++;
            
            // Check if we processed fewer words than batch size (indicating we're near the end)
            if (result.processedCount < batchSize) {
                console.log('\n🎉 All remaining words have been processed!');
                break;
            }
            
            // Take a 5-second break before the next batch
            console.log(`\n⏳ Taking ${batchDelayMs/1000} second break before next batch...`);
            await new Promise(resolve => setTimeout(resolve, batchDelayMs));
            
        } catch (error) {
            console.error(`Error in batch #${batchNumber}:`, error);
            totalErrors++;
            
            // Still take a break even if there was an error
            console.log(`\n⏳ Taking ${batchDelayMs/1000} second break before retrying...`);
            await new Promise(resolve => setTimeout(resolve, batchDelayMs));
        }
    }
    
    console.log('\n🏁 === FINAL PROCESSING SUMMARY ===');
    console.log(`Total batches processed: ${batchNumber - 1}`);
    console.log(`Total words processed: ${totalProcessed}`);
    console.log(`Total successful updates: ${totalSuccess}`);
    console.log(`Total errors: ${totalErrors}`);
    console.log(`Success rate: ${totalProcessed > 0 ? ((totalSuccess / totalProcessed) * 100).toFixed(2) : 0}%`);
}

/**
 * Test database connection
 */
async function testConnection() {
    try {
        const result = await pool.query('SELECT NOW()');
        console.log('✓ Database connection successful:', result.rows[0].now);
        return true;
    } catch (error) {
        console.error('✗ Database connection failed:', error.message);
        return false;
    }
}

/**
 * Test Datamuse API connection
 */
async function testDatamuseAPI() {
    return await DatamuseService.testConnection();
}

/**
 * Main function to run the processor
 */
async function main() {
    console.log('=== Datamuse Word Processor ===\n');
    
    try {
        // Test connections
        console.log('Testing connections...');
        const dbConnected = await testConnection();
        const apiConnected = await testDatamuseAPI();
        
        if (!dbConnected || !apiConnected) {
            console.log('Connection tests failed. Exiting...');
            process.exit(1);
        }
        
        console.log('\nAll connections successful. Starting processing...\n');
        
        // Process all words in batches
        await processAllWords(1000, 200, 5000); // Process 1000 words per batch, 1 second delay between API calls, 5 second delay between batches
        
        console.log('\nProcessing completed successfully!');
        
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    } finally {
        // Close database connection
        await pool.end();
        console.log('Database connection closed.');
    }
}

// Export functions for use as module
module.exports = {
    queryWordsNeedingInfo,
    updateWordInfo,
    processWords,
    processAllWords,
    testConnection,
    testDatamuseAPI
};

// Run main function if this file is executed directly
if (require.main === module) {
    main().catch(console.error);
}
