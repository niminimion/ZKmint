/**
 * Database module for storing custom user salts
 * 
 * This module provides database functionality to store and retrieve
 * custom salts for users, eliminating the one-to-one correspondence
 * between OAuth identifiers and on-chain Sui addresses.
 */

const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const path = require('path');

class UserSaltDatabase {
    constructor(dbPath = './user_salts.db') {
        this.dbPath = dbPath;
        this.db = null;
        this.initialized = false;
        this.initPromise = this.init();
    }

    /**
     * Ensure database is initialized before operations
     */
    async ensureInitialized() {
        if (!this.initialized) {
            await this.initPromise;
            this.initialized = true;
        }
    }

    /**
     * Initialize database and create tables
     */
    async init() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Error opening database:', err.message);
                    reject(err);
                    return;
                }
                console.log('Connected to SQLite database for user salts');
                
                // Create user_salts table if it doesn't exist
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS user_salts (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_identifier TEXT UNIQUE NOT NULL,
                        provider TEXT NOT NULL,
                        custom_salt TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `, (err) => {
                    if (err) {
                        console.error('Error creating table:', err.message);
                        reject(err);
                        return;
                    }
                    console.log('User salts table ready');
                    
                    // Create index for faster lookups
                    this.db.run(`
                        CREATE INDEX IF NOT EXISTS idx_user_provider 
                        ON user_salts(user_identifier, provider)
                    `, (err) => {
                        if (err) {
                            console.error('Error creating index:', err.message);
                            reject(err);
                            return;
                        }
                        console.log('Database initialization complete');
                        resolve();
                    });
                });
            });
        });
    }

    /**
     * Generate a new random salt
     */
    generateSalt() {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Get or create a custom salt for a user
     * @param {string} userIdentifier - OAuth subject (sub) claim
     * @param {string} provider - OAuth provider (e.g., 'google')
     * @returns {Promise<string>} - Custom salt for the user
     */
    async getOrCreateUserSalt(userIdentifier, provider) {
        await this.ensureInitialized();
        return new Promise((resolve, reject) => {
            // First, try to get existing salt
            this.db.get(
                'SELECT custom_salt FROM user_salts WHERE user_identifier = ? AND provider = ?',
                [userIdentifier, provider],
                (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    if (row) {
                        // Salt exists, return it
                        resolve(row.custom_salt);
                    } else {
                        // Salt doesn't exist, create a new one
                        const newSalt = this.generateSalt();
                        this.db.run(
                            `INSERT INTO user_salts (user_identifier, provider, custom_salt) 
                             VALUES (?, ?, ?)`,
                            [userIdentifier, provider, newSalt],
                            function(err) {
                                if (err) {
                                    reject(err);
                                    return;
                                }
                                console.log(`Created new salt for user ${userIdentifier} (${provider})`);
                                resolve(newSalt);
                            }
                        );
                    }
                }
            );
        });
    }

    /**
     * Update salt for a user (optional, for salt rotation)
     * @param {string} userIdentifier - OAuth subject (sub) claim
     * @param {string} provider - OAuth provider
     * @param {string} newSalt - New salt value
     * @returns {Promise<boolean>} - Success status
     */
    async updateUserSalt(userIdentifier, provider, newSalt) {
        await this.ensureInitialized();
        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE user_salts 
                 SET custom_salt = ?, updated_at = CURRENT_TIMESTAMP 
                 WHERE user_identifier = ? AND provider = ?`,
                [newSalt, userIdentifier, provider],
                function(err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(this.changes > 0);
                }
            );
        });
    }

    /**
     * Get all salts for a user across providers
     * @param {string} userIdentifier - OAuth subject (sub) claim
     * @returns {Promise<Array>} - Array of salt records
     */
    async getUserSalts(userIdentifier) {
        await this.ensureInitialized();
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM user_salts WHERE user_identifier = ?',
                [userIdentifier],
                (err, rows) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(rows);
                }
            );
        });
    }

    /**
     * Delete salt for a user (for account deletion)
     * @param {string} userIdentifier - OAuth subject (sub) claim
     * @param {string} provider - OAuth provider
     * @returns {Promise<boolean>} - Success status
     */
    async deleteUserSalt(userIdentifier, provider) {
        await this.ensureInitialized();
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM user_salts WHERE user_identifier = ? AND provider = ?',
                [userIdentifier, provider],
                function(err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(this.changes > 0);
                }
            );
        });
    }

    /**
     * Get database statistics
     * @returns {Promise<Object>} - Database statistics
     */
    async getStats() {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT COUNT(*) as total_users, COUNT(DISTINCT provider) as providers FROM user_salts',
                (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve({
                        totalUsers: row.total_users,
                        providers: row.providers,
                        dbPath: this.dbPath
                    });
                }
            );
        });
    }

    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err.message);
                } else {
                    console.log('Database connection closed');
                }
            });
        }
    }
}

module.exports = { UserSaltDatabase };