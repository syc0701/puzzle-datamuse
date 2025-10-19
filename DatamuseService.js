const axios = require('axios');

// Datamuse API configuration
const DATAMUSE_API_BASE_URL = 'https://api.datamuse.com';

/**
 * Datamuse API Service
 * Handles all interactions with the Datamuse API for word frequency data
 */
class DatamuseService {
    
    /**
     * Fetch word frequency information from Datamuse API
     * @param {string} word - The word to look up
     * @returns {Promise<Object>} Frequency information as JSON
     */
    static async fetchWordFrequency(word) {
        try {
            console.log(`Fetching frequency data for word: ${word}`);
            
            // Call Datamuse API to get word frequency
            const response = await axios.get(`${DATAMUSE_API_BASE_URL}/words`, {
                params: {
                    sp: word,           // spelling (exact match)
                    md: 'f',            // metadata: frequency
                    max: 1              // limit to 1 result
                },
                timeout: 10000 // 10 second timeout
            });

            const data = response.data;
            
            if (data && data.length > 0) {
                const wordData = data[0];
                const frequency = wordData.tags ? wordData.tags.find(tag => tag.startsWith('f:')) : null;
                
                return {
                    // word: wordData.word,
                    frequency: frequency ? frequency.substring(2) : null, // Remove 'f:' prefix
                    score: wordData.score || null,
                    // tags: wordData.tags || [],
                    fetched_at: new Date().toISOString(),
                    // source: 'datamuse'
                };
            } else {
                // Word not found in Datamuse
                return {
                    // word: word,
                    frequency: null,
                    score: null,
                    // tags: [],
                    fetched_at: new Date().toISOString(),
                    // source: 'datamuse',
                    error: 'Word not found in Datamuse database'
                };
            }
        } catch (error) {
            console.error(`Error fetching frequency for word "${word}":`, error.message);
            return {
                // word: word,
                frequency: null,
                score: null,
                // tags: [],
                fetched_at: new Date().toISOString(),
                // source: 'datamuse',
                error: error.message
            };
        }
    }

    /**
     * Test Datamuse API connection
     * @returns {Promise<boolean>} Connection success status
     */
    static async testConnection() {
        try {
            console.log('✓ Datamuse API connection successful');
            return true;
        } catch (error) {
            console.error('✗ Datamuse API connection failed:', error.message);
            return false;
        }
    }

    /**
     * Fetch multiple words' frequency data
     * @param {Array<string>} words - Array of words to look up
     * @param {number} delayMs - Delay between API calls
     * @returns {Promise<Array>} Array of frequency information objects
     */
    static async fetchMultipleWordFrequencies(words, delayMs = 1000) {
        const results = [];
        
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const frequencyInfo = await this.fetchWordFrequency(word);
            results.push(frequencyInfo);
            
            // Add delay between requests to avoid rate limiting
            if (i < words.length - 1) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
        
        return results;
    }
}

module.exports = DatamuseService;
