/**
 * Production zkLogin Implementation using Official Mysten Labs SDK
 * 
 * This module provides a production-ready zkLogin implementation for Sui blockchain
 * using the official @mysten/sui package.
 */

const { Ed25519Keypair } = require('@mysten/sui/keypairs/ed25519');
const { Secp256k1Keypair } = require('@mysten/sui/keypairs/secp256k1');
const { 
    computeZkLoginAddressFromSeed,
    computeZkLoginAddress,
    getZkLoginSignature,
    parseZkLoginSignature,
    generateNonce,
    generateRandomness,
    getExtendedEphemeralPublicKey,
    jwtToAddress
} = require('@mysten/sui/zklogin');
const crypto = require('crypto');
const { SuiClient } = require('@mysten/sui/client');
const { Transaction } = require('@mysten/sui/transactions');

/**
 * zkLogin Provider configurations
 */
const PROVIDERS = {
    google: {
        name: 'Google',
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        scope: 'openid email profile',
        responseType: 'id_token'
    },
    facebook: {
        name: 'Facebook',
        authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
        scope: 'openid email',
        responseType: 'id_token'
    },
    twitch: {
        name: 'Twitch',
        authUrl: 'https://id.twitch.tv/oauth2/authorize',
        scope: 'openid user:read:email',
        responseType: 'id_token'
    },
    apple: {
        name: 'Apple',
        authUrl: 'https://appleid.apple.com/auth/authorize',
        scope: 'openid email name',
        responseType: 'id_token'
    }
};

/**
 * Production zkLogin Class
 */
class ZkLogin {
    constructor(config = {}) {
        this.config = {
            suiRpcUrl: config.suiRpcUrl || 'https://fullnode.devnet.sui.io:443',
            provider: config.provider || 'google',
            clientId: config.clientId,
            redirectUrl: config.redirectUrl,
            keyScheme: config.keyScheme || 'ED25519',
            oauthFlow: config.oauthFlow || 'implicit',
            maxEpoch: config.maxEpoch || 10,
            userSalt: config.userSalt || '0',
            useDatabase: config.useDatabase || false,
            dbPath: config.dbPath || './zklogin_salts.db'
        };

        // Validate required config
        if (!this.config.clientId) {
            throw new Error('clientId is required');
        }
        if (!this.config.redirectUrl) {
            throw new Error('redirectUrl is required');
        }
        if (!PROVIDERS[this.config.provider]) {
            throw new Error(`Unsupported provider: ${this.config.provider}`);
        }

        this.suiClient = new SuiClient({ url: this.config.suiRpcUrl });
        
        // Initialize database if enabled (lazy require to avoid bundling sqlite in serverless)
        if (this.config.useDatabase) {
            const { UserSaltDatabase } = require('./database');
            this.saltDatabase = new UserSaltDatabase(this.config.dbPath);
        }
        
        this.reset();
    }

    /**
     * Reset the zkLogin state
     */
    reset() {
        this.ephemeralKeyPair = null;
        this.randomness = null;
        this.nonce = null;
        this.maxEpoch = null;
        this.currentEpoch = null;
        this.jwt = null;
        this.userAddress = null;
        this.zkLoginSignature = null;
    }

    /**
     * Step 1: Generate ephemeral key pair
     */
    generateEphemeralKeyPair() {
        try {
            if (this.config.keyScheme === 'ED25519') {
                this.ephemeralKeyPair = new Ed25519Keypair();
            } else if (this.config.keyScheme === 'Secp256k1') {
                this.ephemeralKeyPair = new Secp256k1Keypair();
            } else {
                throw new Error(`Unsupported key scheme: ${this.config.keyScheme}`);
            }

            return {
                success: true,
                publicKey: this.ephemeralKeyPair.getPublicKey().toSuiAddress(),
                keyScheme: this.config.keyScheme
            };
        } catch (error) {
            throw new Error(`Failed to generate ephemeral key pair: ${error.message}`);
        }
    }

    /**
     * Step 2: Prepare for JWT acquisition
     */
    async prepareForJWT(provider, clientId, redirectUrl) {
        try {
            if (!this.ephemeralKeyPair) {
                throw new Error('Ephemeral key pair not generated. Call generateEphemeralKeyPair() first.');
            }

            // Update configuration with provided parameters
            if (provider) this.config.provider = provider;
            if (clientId) this.config.clientId = clientId;
            if (redirectUrl) this.config.redirectUrl = redirectUrl;

            // Validate required configuration
            if (!this.config.clientId) {
                throw new Error('clientId is required');
            }
            if (!this.config.provider) {
                throw new Error('provider is required');
            }
            if (!this.config.redirectUrl) {
                throw new Error('redirectUrl is required');
            }

            // Generate randomness using Sui SDK (with fallback)
            try {
                this.randomness = generateRandomness();
            } catch (error) {
                // Fallback: Generate 32-byte randomness as BigInt
                console.warn('generateRandomness not available, using fallback');
                this.randomness = BigInt('0x' + crypto.randomBytes(32).toString('hex'));
            }

            // Get current epoch from Sui network
            this.currentEpoch = await this.getCurrentEpoch();
            this.maxEpoch = this.currentEpoch + this.config.maxEpoch;

            // Get extended ephemeral public key (with fallback)
            let extendedEphemeralPublicKey;
            try {
                extendedEphemeralPublicKey = getExtendedEphemeralPublicKey(this.ephemeralKeyPair.getPublicKey());
            } catch (error) {
                console.warn('getExtendedEphemeralPublicKey not available, using public key directly');
                extendedEphemeralPublicKey = this.ephemeralKeyPair.getPublicKey();
            }

            // Generate nonce using Sui SDK (with fallback)
            try {
                this.nonce = generateNonce(extendedEphemeralPublicKey, this.maxEpoch, this.randomness);
            } catch (error) {
                console.warn('generateNonce not available, using fallback');
                // Fallback: Create nonce using SHA256 hash of components
                let ephemeralPublicKeyBase64;
                try {
                    // Try toBase64() method first
                    ephemeralPublicKeyBase64 = extendedEphemeralPublicKey.toBase64();
                } catch (e) {
                    // If toBase64() doesn't exist, try toSuiAddress() or convert from bytes
                    try {
                        ephemeralPublicKeyBase64 = extendedEphemeralPublicKey.toSuiAddress();
                    } catch (e2) {
                        // Last resort: convert bytes to base64
                        const publicKeyBytes = extendedEphemeralPublicKey.toBytes ? 
                            extendedEphemeralPublicKey.toBytes() : 
                            extendedEphemeralPublicKey;
                        ephemeralPublicKeyBase64 = Buffer.from(publicKeyBytes).toString('base64');
                    }
                }
                
                const nonceData = JSON.stringify({
                    ephemeralPublicKey: ephemeralPublicKeyBase64,
                    maxEpoch: this.maxEpoch,
                    randomness: this.randomness.toString()
                });
                this.nonce = crypto.createHash('sha256').update(nonceData).digest('base64url');
            }

            return {
                success: true,
                randomness: this.randomness.toString(),
                nonce: this.nonce,
                currentEpoch: this.currentEpoch,
                maxEpoch: this.maxEpoch
            };
        } catch (error) {
            throw new Error(`Failed to prepare for JWT: ${error.message}`);
        }
    }



    /**
     * Get current epoch from Sui network
     */
    async getCurrentEpoch() {
        try {
            const epoch = await this.suiClient.getLatestSuiSystemState();
            return parseInt(epoch.epoch);
        } catch (error) {
            console.warn('Warning: Could not fetch current epoch from Sui network, using fallback');
            return 100; // Fallback epoch
        }
    }

    /**
     * Build OAuth URL for authentication
     */
    buildOAuthUrl(sessionId = null) {
        const provider = PROVIDERS[this.config.provider];
        
        const state = sessionId || `zklogin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const isCodeFlow = (this.config.oauthFlow || 'implicit') === 'code';
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUrl,
            response_type: isCodeFlow ? 'code' : 'id_token',
            scope: 'openid email profile',
            state: state,
            // implicit uses fragment, code flow uses query
            response_mode: isCodeFlow ? 'query' : 'fragment'
        });
        if (!isCodeFlow) {
            // nonce only applies to implicit id_token flow
            params.set('nonce', this.nonce);
        }
        return `${provider.authUrl}?${params.toString()}`;
    }

    /**
     * Step 3: Process JWT token received from OAuth provider
     */
    async processJWT(jwtToken) {
        try {
            if (!this.randomness || !this.nonce) {
                throw new Error('JWT preparation not completed. Call prepareForJWT() first.');
            }

            // Validate JWT format
            if (!this.isValidJWT(jwtToken)) {
                throw new Error('Invalid JWT token format');
            }

            this.jwt = jwtToken;

            // Decode JWT completely for zkLogin signature assembly
            this.decodedJWT = this.decodeJWT(jwtToken);

            // Validate nonce in JWT matches the generated nonce
            if (this.decodedJWT.payload.nonce !== this.nonce) {
                throw new Error(`Nonce mismatch: expected ${this.nonce}, got ${this.decodedJWT.payload.nonce}`);
            }

            // Extract subject from JWT
            const subject = this.extractSubFromJWT(jwtToken);

            // Get or generate custom salt for this user
            let userSalt;
            if (this.config.useDatabase && this.saltDatabase) {
                // Use database to get/create custom salt
                userSalt = await this.saltDatabase.getOrCreateUserSalt(subject, this.config.provider);
                console.log(`Using custom salt from database for user ${subject}`);
            } else {
                // Use configured salt (legacy behavior)
                userSalt = this.config.userSalt;
                console.log(`Using configured salt: ${userSalt}`);
            }

            // Store the salt for later use
            this.userSalt = userSalt;

            // Compute zkLogin address using jwtToAddress for proper salt handling
            try {
                this.userAddress = jwtToAddress(jwtToken, userSalt);
            } catch (error) {
                console.warn('jwtToAddress failed, using fallback method:', error.message);
                // Fallback: Use computeZkLoginAddressFromSeed if jwtToAddress fails
                const decoded = this.decodeJWT(jwtToken);
                
                // Convert hex salt to BigInt for computeZkLoginAddressFromSeed
                let saltForFallback = userSalt;
                if (typeof userSalt === 'string' && /^[0-9a-fA-F]+$/.test(userSalt)) {
                    saltForFallback = BigInt('0x' + userSalt);
                }
                
                this.userAddress = computeZkLoginAddressFromSeed(
                    saltForFallback,
                    'sub',
                    decoded.payload.sub,
                    decoded.payload.aud
                );
            }

            return {
                success: true,
                jwt: jwtToken,
                userAddress: this.userAddress,
                subject: subject,
                userSalt: userSalt,
                decodedJWT: this.decodedJWT
            };
        } catch (error) {
            throw new Error(`Failed to process JWT: ${error.message}`);
        }
    }

    /**
     * Validate JWT token format
     */
    isValidJWT(jwt) {
        const parts = jwt.split('.');
        return parts.length === 3;
    }

    /**
     * Extract subject from JWT token
     */
    extractSubFromJWT(jwt) {
        try {
            const parts = jwt.split('.');
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            
            if (!payload.sub) {
                throw new Error('JWT token missing subject (sub) claim');
            }
            
            return payload.sub;
        } catch (error) {
            throw new Error(`Failed to extract subject from JWT: ${error.message}`);
        }
    }

    /**
     * Decode JWT completely (needed for assembling zkLogin signature)
     */
    decodeJWT(jwt) {
        try {
            const parts = jwt.split('.');
            if (parts.length !== 3) {
                throw new Error('Invalid JWT format');
            }

            // Decode header
            const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
            
            // Decode payload
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            
            // Extract signature (keep as base64url)
            const signature = parts[2];

            return {
                header: header,
                payload: payload,
                signature: signature,
                raw: {
                    header: parts[0],
                    payload: parts[1],
                    signature: parts[2]
                }
            };
        } catch (error) {
            throw new Error(`Failed to decode JWT: ${error.message}`);
        }
    }

    /**
     * Get JWT claims needed for zkLogin proof generation
     */
    getJWTClaims() {
        if (!this.jwt) {
            throw new Error('No JWT token available');
        }

        const decoded = this.decodeJWT(this.jwt);
        
        return {
            // Header claims
            alg: decoded.header.alg,
            typ: decoded.header.typ,
            kid: decoded.header.kid,
            
            // Payload claims
            iss: decoded.payload.iss,
            aud: decoded.payload.aud,
            sub: decoded.payload.sub,
            exp: decoded.payload.exp,
            iat: decoded.payload.iat,
            nonce: decoded.payload.nonce,
            
            // Additional claims that might be present
            email: decoded.payload.email,
            email_verified: decoded.payload.email_verified,
            name: decoded.payload.name,
            picture: decoded.payload.picture,
            
            // Raw components for proof generation
            rawHeader: decoded.raw.header,
            rawPayload: decoded.raw.payload,
            rawSignature: decoded.raw.signature
        };
    }

    /**
     * Step 4: Generate zkLogin signature for transaction
     */
    async generateZkLoginSignature(transactionBytes, zkProof) {
        try {
            if (!this.ephemeralKeyPair || !this.jwt) {
                throw new Error('zkLogin setup not completed');
            }

            // Sign transaction with ephemeral key
            const userSignature = await this.ephemeralKeyPair.signTransaction(transactionBytes);

            // Generate zkLogin signature
            this.zkLoginSignature = getZkLoginSignature({
                inputs: zkProof,
                maxEpoch: this.maxEpoch,
                userSignature: userSignature.signature
            });

            return {
                success: true,
                signature: this.zkLoginSignature
            };
        } catch (error) {
            throw new Error(`Failed to generate zkLogin signature: ${error.message}`);
        }
    }

    /**
     * Create a transaction and sign it with zkLogin
     */
    async createAndSignTransaction(transactionData, zkProof) {
        try {
            if (!this.userAddress) {
                throw new Error('User address not available. Process JWT first.');
            }

            const transaction = new Transaction();
            transaction.setSender(this.userAddress);
            
            // Add transaction data
            if (transactionData.moveCall) {
                transaction.moveCall(transactionData.moveCall);
            }
            
            if (transactionData.transferObjects) {
                transaction.transferObjects(
                    transactionData.transferObjects.objects,
                    transactionData.transferObjects.recipient
                );
            }

            // Build transaction
            const transactionBytes = await transaction.build({ client: this.suiClient });

            // Generate zkLogin signature
            const signatureResult = await this.generateZkLoginSignature(transactionBytes, zkProof);

            return {
                success: true,
                transaction: transaction,
                transactionBytes: transactionBytes,
                signature: signatureResult.signature
            };
        } catch (error) {
            throw new Error(`Failed to create and sign transaction: ${error.message}`);
        }
    }

    /**
     * Get current state of zkLogin process
     */
    getState() {
        return {
            hasEphemeralKeyPair: !!this.ephemeralKeyPair,
            hasRandomness: !!this.randomness,
            hasNonce: !!this.nonce,
            hasJWT: !!this.jwt,
            hasDecodedJWT: !!this.decodedJWT,
            hasUserAddress: !!this.userAddress,
            hasZkLoginSignature: !!this.zkLoginSignature,
            ephemeralPublicKey: this.ephemeralKeyPair ? this.ephemeralKeyPair.getPublicKey().toSuiAddress() : null,
            randomness: this.randomness ? this.randomness.toString() : null,
            nonce: this.nonce,
            currentEpoch: this.currentEpoch,
            maxEpoch: this.maxEpoch,
            jwtClaims: this.jwt ? this.getJWTClaims() : null,
            config: {
                provider: this.config.provider,
                keyScheme: this.config.keyScheme,
                suiRpcUrl: this.config.suiRpcUrl,
                clientId: this.config.clientId ? `${this.config.clientId.substring(0, 20)}...` : null,
                redirectUrl: this.config.redirectUrl
            }
        };
    }

    /**
     * Get user address (if available)
     */
    getUserAddress() {
        return this.userAddress;
    }

    /**
     * Get ephemeral public key (if available)
     */
    getEphemeralPublicKey() {
        return this.ephemeralKeyPair ? this.ephemeralKeyPair.getPublicKey().toSuiAddress() : null;
    }

    /**
     * Get nonce (if available)
     */
    getNonce() {
        return this.nonce;
    }

    /**
     * Get OAuth URL (if nonce is available)
     */
    getOAuthUrl() {
        return this.nonce ? this.buildOAuthUrl() : null;
    }

    /**
     * Get user salt (if available)
     */
    getUserSalt() {
        return this.userSalt;
    }

    /**
     * Get database statistics (if database is enabled)
     */
    async getDatabaseStats() {
        if (this.config.useDatabase && this.saltDatabase) {
            return await this.saltDatabase.getStats();
        }
        return null;
    }

    /**
     * Update user salt (if database is enabled)
     */
    async updateUserSalt(userIdentifier, provider, newSalt) {
        if (this.config.useDatabase && this.saltDatabase) {
            return await this.saltDatabase.updateUserSalt(userIdentifier, provider, newSalt);
        }
        throw new Error('Database not enabled');
    }

    /**
     * Delete user salt (if database is enabled)
     */
    async deleteUserSalt(userIdentifier, provider) {
        if (this.config.useDatabase && this.saltDatabase) {
            return await this.saltDatabase.deleteUserSalt(userIdentifier, provider);
        }
        throw new Error('Database not enabled');
    }

    /**
     * Close database connection (if database is enabled)
     */
    closeDatabase() {
        if (this.config.useDatabase && this.saltDatabase) {
            this.saltDatabase.close();
        }
    }
}

module.exports = { ZkLogin, PROVIDERS };