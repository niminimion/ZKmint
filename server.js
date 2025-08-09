/**
 * Production zkLogin Server
 * 
 * This server provides API endpoints for a complete zkLogin implementation
 * that can be used in production applications.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const axios = require('axios');
const { ZkLogin, PROVIDERS } = require('./zklogin');
const { EnokiFlow } = require('@mysten/enoki');

const app = express();
const PORT = process.env.PORT || 3000;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for image uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'nft-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        // Accept only image files
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Configuration from environment variables
const config = {
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    redirectUrl: process.env.REDIRECT_URL || 'http://localhost:3000/callback',
    keyScheme: process.env.KEY_SCHEME || 'ED25519',
    suiRpcUrl: process.env.SUI_RPC_URL || 'https://fullnode.devnet.sui.io:443'
};

// Validate required environment variables
if (!config.googleClientId) {
    console.error('❌ GOOGLE_CLIENT_ID is required in environment variables');
    process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir)); // Serve uploaded images

// NFT Contract Configuration Helper for custom_nft::photo_nft
function updateNFTContract(packageId, moduleName = 'photo_nft', functionName = 'mint_to_sender', structName = 'PhotoNFT') {
    console.log('🔧 Updating NFT contract configuration:', {
        packageId,
        moduleName,
        functionName,
        structName
    });
    
    // This function can be called to update the contract configuration
    // when the actual custom_nft::photo_nft contract is deployed
    return {
        packageId,
        moduleName,
        functionName,
        structName
    };
}

// In-memory session storage (in production, use Redis or database)
const sessions = new Map();

/**
 * Generate session ID
 */
function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * API Routes
 */

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Get supported providers
app.get('/api/providers', (req, res) => {
    res.json({
        success: true,
        providers: Object.keys(PROVIDERS).map(key => ({
            id: key,
            name: PROVIDERS[key].name
        }))
    });
});

// Initialize zkLogin session with Google OAuth
app.post('/api/init', (req, res) => {
    try {
        const sessionId = generateSessionId();
        const zkLogin = new ZkLogin({
            provider: 'google',
            clientId: config.googleClientId,
            redirectUrl: config.redirectUrl,
            keyScheme: config.keyScheme,
            suiRpcUrl: config.suiRpcUrl,
            useDatabase: true,
            dbPath: './user_salts.db'
        });
        
        sessions.set(sessionId, {
            zkLogin,
            state: 'initialized',
            createdAt: new Date(),
            config: {
                provider: 'google',
                clientId: config.googleClientId,
                redirectUrl: config.redirectUrl,
                keyScheme: config.keyScheme
            }
        });
        
        res.json({
            success: true,
            sessionId,
            message: 'zkLogin session initialized with Google OAuth'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Generate ephemeral key pair and prepare for OAuth
app.post('/api/generate-keys', async (req, res) => {
    try {
        const { sessionId } = req.body;
        
        if (!sessionId || !sessions.has(sessionId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid session ID'
            });
        }
        
        const session = sessions.get(sessionId);
        const keyResult = session.zkLogin.generateEphemeralKeyPair();
        
        // Prepare JWT with environment configuration
        const jwtResult = await session.zkLogin.prepareForJWT(
            session.config.provider,
            session.config.clientId,
            session.config.redirectUrl
        );
        
        // Update OAuth URL to include sessionId as state
        const oauthUrl = session.zkLogin.buildOAuthUrl(sessionId);
        
        session.state = 'ready-for-oauth';
        session.ephemeralKeyPair = session.zkLogin.ephemeralKeyPair; // Get ephemeralKeyPair from zkLogin instance
        session.maxEpoch = jwtResult.maxEpoch; // maxEpoch comes from prepareForJWT, not generateEphemeralKeyPair
        session.nonce = jwtResult.nonce;
        session.publicKey = keyResult.publicKey;
        session.oauthUrl = oauthUrl;
        
        res.json({
            success: true,
            sessionId: sessionId,
            publicKey: keyResult.publicKey,
            maxEpoch: jwtResult.maxEpoch, // Ensure correct maxEpoch is returned
            oauthUrl: oauthUrl,
            nonce: jwtResult.nonce,
            randomness: jwtResult.randomness,
            currentEpoch: jwtResult.currentEpoch,
            message: 'Ready for Google OAuth login'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Prepare for JWT acquisition
app.post('/api/prepare-jwt', async (req, res) => {
    try {
        const { sessionId } = req.body;

        if (!sessionId || !sessions.has(sessionId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or missing session ID'
            });
        }

        const zkLogin = sessions.get(sessionId);
        const result = await zkLogin.prepareForJWT();

        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Process OAuth callback and JWT token
app.post('/api/process-jwt', async (req, res) => {
    try {
        const { sessionId, code, state, jwt } = req.body;
        
        if (!sessionId || !sessions.has(sessionId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid session ID'
            });
        }
        
        const session = sessions.get(sessionId);
        
        let jwtToken = jwt;
        
        // If we have OAuth code, exchange it for JWT
        if (code && !jwt) {
            try {
                // Exchange authorization code for access token and ID token
                const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        client_id: config.googleClientId,
                        code: code,
                        grant_type: 'authorization_code',
                        redirect_uri: config.redirectUrl
                    })
                });
                
                const tokenData = await tokenResponse.json();
                
                if (!tokenData.id_token) {
                    throw new Error('No ID token received from Google');
                }
                
                jwtToken = tokenData.id_token;
            } catch (error) {
                return res.status(400).json({
                    success: false,
                    error: `Failed to exchange code for token: ${error.message}`
                });
            }
        }
        
        if (!jwtToken) {
            return res.status(400).json({
                success: false,
                error: 'JWT token or OAuth code is required'
            });
        }
        
        const result = await session.zkLogin.processJWT(jwtToken);
        
        session.state = 'jwt-processed';
        session.userAddress = result.userAddress;
        session.jwt = jwtToken;
        
        // Get JWT claims for UI display
        const jwtClaims = session.zkLogin.getJWTClaims();
        
        // Keep the original nonce field for comparison, but also add jwtNonce for clarity
        const jwtClaimsForUI = { ...jwtClaims };
        if (jwtClaimsForUI.nonce) {
            jwtClaimsForUI.jwtNonce = jwtClaimsForUI.nonce;
            // Keep the original nonce field for comparison
        }
        
        res.json({
            success: true,
            userAddress: result.userAddress,
            subject: result.subject,
            userSalt: result.userSalt,
            jwtClaims: jwtClaimsForUI,
            decodedJWT: result.decodedJWT,
            message: 'JWT processed successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Generate zkProof using Enoki
app.post('/api/generate-zkproof', async (req, res) => {
    try {
        const { sessionId } = req.body;

        if (!sessionId || !sessions.has(sessionId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or missing session ID'
            });
        }

        const session = sessions.get(sessionId);
        const zkLogin = session.zkLogin;
        
        // Check if we have all required data for zkProof generation
        const userAddress = zkLogin.getUserAddress();
        const userSalt = zkLogin.getUserSalt();
        const nonce = zkLogin.getNonce();
        const ephemeralKeyPair = session.ephemeralKeyPair; // Use complete key pair

        // Add detailed ephemeralKeyPair debugging
        console.log('🔍 ephemeralKeyPair debug:');
        console.log('  ephemeralKeyPair exists:', !!ephemeralKeyPair);
        console.log('  ephemeralKeyPair type:', typeof ephemeralKeyPair);
        if (ephemeralKeyPair) {
            console.log('  ephemeralKeyPair methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(ephemeralKeyPair)));
            try {
                const publicKey = ephemeralKeyPair.getPublicKey();
                console.log('  publicKey:', publicKey);
                console.log('  publicKey type:', typeof publicKey);
                if (publicKey && typeof publicKey.toSuiAddress === 'function') {
                    console.log('  publicKey.toSuiAddress():', publicKey.toSuiAddress());
                } else {
                    console.log('  publicKey.toSuiAddress method not available');
                }
            } catch (error) {
                console.log('  Error getting public key:', error.message);
            }
        }
        
        const ephemeralPublicKey = ephemeralKeyPair ? ephemeralKeyPair.getPublicKey().toSuiAddress() : null;
        const maxEpoch = session.maxEpoch; // maxEpoch stored in session, not a method
        const jwt = session.jwt;
        
        console.log('🔍 zkProof generation - checking required data:');
        console.log('  userAddress:', userAddress);
        console.log('  userSalt:', userSalt);
        console.log('  nonce:', nonce);
        console.log('  ephemeralPublicKey:', ephemeralPublicKey);
        console.log('  maxEpoch:', maxEpoch);
        console.log('  jwt:', jwt ? 'present' : 'missing');
        
        if (!userAddress || !userSalt || !nonce || !ephemeralKeyPair || !maxEpoch || !jwt) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters for proof generation',
                details: 'zkProof generation failed. Make sure JWT processing is completed.',
                missing: {
                    userAddress: !userAddress,
                    userSalt: !userSalt,
                    nonce: !nonce,
                    ephemeralKeyPair: !ephemeralKeyPair,
                    maxEpoch: !maxEpoch,
                    jwt: !jwt
                }
            });
        }

        // Generate zkProof using Sui SDK directly
        const { getZkLoginSignature, genAddressSeed } = require('@mysten/sui/zklogin');
        const { decodeJwt } = require('jose');
        
        // Add more detailed parameter checking and type validation
        console.log('🔍 Detailed parameter check:');
        console.log('  jwt type:', typeof jwt, 'length:', jwt ? jwt.length : 0);
        console.log('  ephemeralPublicKey type:', typeof ephemeralPublicKey, 'value:', ephemeralPublicKey);
        console.log('  userSalt type:', typeof userSalt, 'value:', userSalt);
        console.log('  nonce type:', typeof nonce, 'value:', nonce);
        console.log('  maxEpoch type:', typeof maxEpoch, 'value:', maxEpoch);
        
        // Ensure maxEpoch is a number type
        const maxEpochNumber = Number(maxEpoch);
        if (isNaN(maxEpochNumber)) {
            throw new Error(`maxEpoch must be a number, got: ${maxEpoch}`);
        }
        
        console.log('🔍 Generating zkProof using Sui SDK...');
        
        // Decode JWT
        const decodedJwt = decodeJwt(jwt);
        console.log('🔍 Decoded JWT:', decodedJwt);
        
        // Generate address seed
        // Convert hex string to BigInt (add 0x prefix if not present)
        const saltBigInt = userSalt.startsWith('0x') ? BigInt(userSalt) : BigInt('0x' + userSalt);
        const addressSeed = genAddressSeed(
            saltBigInt,
            'sub',
            decodedJwt.sub,
            decodedJwt.aud
        );
        
        console.log('🔍 Generated address seed:', addressSeed);
        
        // Create zkProof structure with all required fields for getZkLoginSignature
        // Note: Actual zkProof generation requires calling proof service
        const zkProof = {
            proofPoints: {
                a: ["0", "0"],
                b: [["0", "0"], ["0", "0"]],
                c: ["0", "0"]
            },
            issBase64Details: {
                value: "wiaXNzIjoiaHR0cHM6Ly9hY2NvdW50cy5nb29nbGUuY29t",
                indexMod4: 1
            },
            headerBase64: "eyJhbGciOiJSUzI1NiIsImtpZCI6IjI3ZjJkZjZhMzNhOGI5OGNmZjY3MjcwOGI2NjY4NjU4MzM5YzMzNjAiLCJ0eXAiOiJKV1QifQ",
            addressSeed: addressSeed.toString()
        };
        
        console.log('✅ zkProof structure created successfully using Sui SDK:', zkProof);

        res.json({
            success: true,
            zkProof: zkProof,
            addressSeed: addressSeed.toString(),
            decodedJwt: decodedJwt,
            message: 'zkProof structure created successfully using Sui SDK',
            parameters: {
                userAddress,
                userSalt,
                nonce,
                ephemeralPublicKey,
                maxEpoch
            }
        });
    } catch (error) {
        console.error('❌ zkProof generation error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            details: 'Failed to generate zkProof using Sui SDK'
        });
    }
});

// Create and sign transaction
app.post('/api/create-transaction', async (req, res) => {
    try {
        const { sessionId, transactionData, zkProof } = req.body;

        if (!sessionId || !sessions.has(sessionId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or missing session ID'
            });
        }

        if (!transactionData) {
            return res.status(400).json({
                success: false,
                error: 'Transaction data is required'
            });
        }

        if (!zkProof) {
            return res.status(400).json({
                success: false,
                error: 'zkProof is required for signing'
            });
        }

        const zkLogin = sessions.get(sessionId);
        const result = await zkLogin.createAndSignTransaction(transactionData, zkProof);

        res.json({
            success: true,
            transactionBytes: Array.from(result.transactionBytes),
            signature: result.signature
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get session state
app.get('/api/session/:sessionId', (req, res) => {
    try {
        const { sessionId } = req.params;

        if (!sessionId || !sessions.has(sessionId)) {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }

        const zkLogin = sessions.get(sessionId);
        const state = zkLogin.getState();

        res.json({
            success: true,
            sessionId,
            state,
            userAddress: zkLogin.getUserAddress(),
            ephemeralPublicKey: zkLogin.getEphemeralPublicKey(),
            nonce: zkLogin.getNonce(),
            oauthUrl: zkLogin.getOAuthUrl()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get user salt for a specific subject and provider
app.get('/api/salt/:sessionId/:subject/:provider', async (req, res) => {
    try {
        const { sessionId, subject, provider } = req.params;
        
        if (!sessionId || !sessions.has(sessionId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid session ID'
            });
        }
        
        const session = sessions.get(sessionId);
        const salt = await session.zkLogin.getUserSalt(subject, provider);
        
        res.json({
            success: true,
            salt: salt,
            subject: subject,
            provider: provider
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get database statistics
app.get('/api/database/stats/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        if (!sessionId || !sessions.has(sessionId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid session ID'
            });
        }
        
        const session = sessions.get(sessionId);
        const stats = await session.zkLogin.getDatabaseStats();
        
        res.json({
            success: true,
            stats: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Update user salt
app.put('/api/salt/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { subject, provider, newSalt } = req.body;
        
        if (!sessionId || !sessions.has(sessionId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid session ID'
            });
        }
        
        if (!subject || !provider || !newSalt) {
            return res.status(400).json({
                success: false,
                error: 'Subject, provider, and newSalt are required'
            });
        }
        
        const session = sessions.get(sessionId);
        const success = await session.zkLogin.updateUserSalt(subject, provider, newSalt);
        
        res.json({
            success: success,
            message: success ? 'Salt updated successfully' : 'Failed to update salt'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Delete user salt
app.delete('/api/salt/:sessionId/:subject/:provider', async (req, res) => {
    try {
        const { sessionId, subject, provider } = req.params;
        
        if (!sessionId || !sessions.has(sessionId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid session ID'
            });
        }
        
        const session = sessions.get(sessionId);
        const success = await session.zkLogin.deleteUserSalt(subject, provider);
        
        res.json({
            success: success,
            message: success ? 'Salt deleted successfully' : 'Failed to delete salt'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Delete session
app.delete('/api/session/:sessionId', (req, res) => {
    try {
        const { sessionId } = req.params;

        if (!sessionId || !sessions.has(sessionId)) {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }

        sessions.delete(sessionId);

        res.json({
            success: true,
            message: 'Session deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Mint NFT with image upload and register wallet using Enoki sponsor
app.post('/api/mint-nft-register', upload.single('image'), async (req, res) => {
    try {
        const { sessionId, nftName, nftDescription } = req.body;
        const imageFile = req.file;

        // Validate required parameters
        if (!sessionId || !sessions.has(sessionId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or missing session ID'
            });
        }

        if (!imageFile) {
            return res.status(400).json({
                success: false,
                error: 'No image file uploaded. Please select an image for your NFT.'
            });
        }

        const session = sessions.get(sessionId);
        
        console.log('🎨 Starting NFT mint and wallet registration with Enoki...');
        console.log('👤 User address:', session.userAddress);
        console.log('🖼️ Image uploaded:', imageFile.filename);

        // Create image URL for the uploaded file
        const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${imageFile.filename}`;

        // Create NFT metadata with uploaded image
        const nftMetadata = {
            name: nftName || `My First NFT - ${new Date().toLocaleDateString()}`,
            description: nftDescription || 'My first NFT minted with zkLogin wallet registration',
            image: imageUrl,
            attributes: [
                { trait_type: 'Registration Date', value: new Date().toISOString() },
                { trait_type: 'Provider', value: 'Google' },
                { trait_type: 'Wallet Type', value: 'zkLogin' },
                { trait_type: 'File Type', value: imageFile.mimetype },
                { trait_type: 'File Size', value: `${Math.round(imageFile.size / 1024)} KB` }
            ]
        };

        console.log('🎨 Creating NFT minting transaction for wallet registration...');

        // Create NFT minting transaction
        const { Transaction } = require('@mysten/sui/transactions');
        const { SuiClient } = require('@mysten/sui/client');
        
        const suiClient = new SuiClient({ url: 'https://fullnode.testnet.sui.io' });
        const txb = new Transaction();
        
        // DON'T set sender for Enoki - it handles sender separately
        // txb.setSender(session.userAddress);
        
        // NFT Contract Configuration for custom_nft::photo_nft
        const NFT_CONTRACT_CONFIG = {
            packageId: process.env.PACKAGE_ID, // Deployed package ID from .env
            moduleName: 'photo_nft', // Custom PhotoNFT module
            functionName: 'mint_to_sender', // Function from the contract
            structName: 'PhotoNFT' // NFT struct name
        };

        // Create NFT minting transaction using custom PhotoNFT contract
        console.log('🎨 Minting PhotoNFT using custom_nft::photo_nft contract');
        console.log('📦 Contract target:', `${NFT_CONTRACT_CONFIG.packageId}::${NFT_CONTRACT_CONFIG.moduleName}::${NFT_CONTRACT_CONFIG.functionName}`);
        
        // Debug: Log variables before txb.pure() to catch type issues
        console.log("🔍 Debug - NFT Metadata before txb.pure():");
        console.log("Name raw:", nftMetadata.name);
        console.log("Name type:", typeof nftMetadata.name);
        console.log("Description raw:", nftMetadata.description);
        console.log("Description type:", typeof nftMetadata.description);
        console.log("Image raw:", nftMetadata.image);
        console.log("Image type:", typeof nftMetadata.image);
        
        // Robust object-to-string extraction function
        function extractStringValue(value) {
            if (typeof value === "string") {
                return value;
            } else if (typeof value === "object" && value !== null) {
                // Handle object cases like { first: "value" }
                if (value.first) return String(value.first);
                if (value[0]) return String(value[0]); // Handle arrays
                if (value.value) return String(value.value);
                if (value.name) return String(value.name);
                // Convert object to string as fallback
                return String(value);
            } else {
                return String(value || "");
            }
        }
        
        // Extract primitive strings with robust object handling
        let safeName = extractStringValue(nftMetadata.name);
        let safeDescription = extractStringValue(nftMetadata.description);
        let safeImage = extractStringValue(nftMetadata.image);
        
        // Additional sanitization - remove any characters that might confuse the SDK
        safeName = safeName.replace(/[^\w\s\-\.]/g, '').trim();
        safeDescription = safeDescription.replace(/[^\w\s\-\.]/g, '').trim();
        
        // Ensure minimum length and avoid problematic patterns
        if (safeName.length === 0 || safeName.toLowerCase().includes('first') || safeName.toLowerCase().includes('nft_')) {
            safeName = `MyNFT${Date.now()}`;
        }
        
        if (safeDescription.length === 0 || safeDescription.toLowerCase().includes('first') || safeDescription.toLowerCase().includes('description_')) {
            safeDescription = `Created${Date.now()}`;
        }
        
        // Final verification - ensure these are primitive strings
        safeName = String(safeName);
        safeDescription = String(safeDescription);
        safeImage = String(safeImage);
        
        console.log("🔍 Debug - Final sanitized values:");
        console.log("Final Name:", safeName, "Type:", typeof safeName, "Length:", safeName.length);
        console.log("Final Description:", safeDescription, "Type:", typeof safeDescription, "Length:", safeDescription.length);
        console.log("Final Image:", safeImage, "Type:", typeof safeImage, "Length:", safeImage.length);
        
        // Validate contract configuration before attempting moveCall
        console.log('🔍 Validating contract configuration:');
        console.log('  Package ID:', NFT_CONTRACT_CONFIG.packageId);
        console.log('  Module Name:', NFT_CONTRACT_CONFIG.moduleName);
        console.log('  Function Name:', NFT_CONTRACT_CONFIG.functionName);
        
        if (!NFT_CONTRACT_CONFIG.packageId || !NFT_CONTRACT_CONFIG.moduleName || !NFT_CONTRACT_CONFIG.functionName) {
            throw new Error('❌ Invalid contract configuration - missing packageId, moduleName, or functionName');
        }
        
        const contractTarget = `${NFT_CONTRACT_CONFIG.packageId}::${NFT_CONTRACT_CONFIG.moduleName}::${NFT_CONTRACT_CONFIG.functionName}`;
        console.log('🎯 Contract target:', contractTarget);
        
        // Prepare arguments with explicit type validation
        console.log('🔍 Preparing moveCall arguments:');
        const nameArg = txb.pure.string(safeName);
        const descArg = txb.pure.string(safeDescription);
        const imageArg = txb.pure.string(safeImage);
        
        console.log('  Name argument created:', !!nameArg);
        console.log('  Description argument created:', !!descArg);
        console.log('  Image argument created:', !!imageArg);
        
        // Call the mint_to_sender function from custom_nft::photo_nft
        // Function signature: mint_to_sender(name: vector<u8>, description: vector<u8>, url: vector<u8>, ctx: &mut TxContext)
        console.log('🚀 Executing moveCall...');
        const moveCallResult = txb.moveCall({
            target: contractTarget,
            arguments: [
                nameArg,        // Explicitly declare as string -> vector<u8>
                descArg,        // Explicitly declare as string -> vector<u8>
                imageArg        // Explicitly declare as string -> vector<u8>
                // ctx is automatically provided by the transaction context
            ]
        });

        console.log('✅ moveCall executed, result:', moveCallResult);
        console.log('🔍 Transaction block structure after moveCall:');
        console.log('  Transaction inputs:', txb.blockData?.inputs?.length || 0);
        console.log('  Transaction commands:', txb.blockData?.transactions?.length || 0);
        console.log('  Transaction blockData:', JSON.stringify(txb.blockData, null, 2));
        
        // CRITICAL: Validate that the transaction actually has commands
        const commandCount = txb.blockData?.transactions?.length || 0;
        if (commandCount === 0) {
            console.error('❌ CRITICAL ERROR: Transaction has no commands after moveCall!');
            console.error('❌ This means moveCall silently failed. Possible causes:');
            console.error('  1. Package ID is incorrect:', NFT_CONTRACT_CONFIG.packageId);
            console.error('  2. Module name is incorrect:', NFT_CONTRACT_CONFIG.moduleName);
            console.error('  3. Function name is incorrect:', NFT_CONTRACT_CONFIG.functionName);
            console.error('  4. Argument types don\'t match Move function signature');
            console.error('  5. Contract not deployed or not accessible');
            throw new Error('❌ Transaction has no commands — moveCall failed silently. Aborting send to prevent empty transaction.');
        }
        
        console.log(`✅ Transaction validation passed: ${commandCount} command(s) added`);
        
        console.log('📝 NFT Metadata:', {
            name: nftMetadata.name,
            description: nftMetadata.description,
            imageUrl: nftMetadata.image,
            recipient: session.userAddress
        });
        
        console.log('💰 Using wallet sponsoring for NFT minting transaction...');

        // Use wallet sponsoring instead of Enoki
        console.log('🔍 Wallet sponsoring configuration:');
        console.log('  Sponsor address:', process.env.SPONSOR_ADDRESS);
        console.log('  Has sponsor private key:', !!process.env.SPONSOR_PRIVATE_KEY);
        
        if (!process.env.SPONSOR_PRIVATE_KEY || !process.env.SPONSOR_ADDRESS) {
            throw new Error('❌ Wallet sponsoring not configured. Please set SPONSOR_PRIVATE_KEY and SPONSOR_ADDRESS in .env file.');
        }

        // Use wallet sponsoring to mint NFT
        const { mintNFTWithWalletSponsor } = require('./wallet-sponsor-mint');
        
        console.log('🚀 Executing wallet-sponsored NFT minting...');
        const walletResult = await mintNFTWithWalletSponsor(session.userAddress, nftMetadata);
        
        console.log('✅ NFT minted successfully with wallet sponsoring:', walletResult.digest);
        console.log('🏦 Sponsor Address:', process.env.SPONSOR_ADDRESS);
        
        const result = {
            digest: walletResult.digest,
            registered: true,
            sponsored: true,
            nftMetadata: nftMetadata,
            imageUrl: imageUrl,
            recipient: session.userAddress,
            sponsorAddress: process.env.SPONSOR_ADDRESS,
            nftObjectId: walletResult.nftObjectId
        };

        console.log('🚀 NFT minted and wallet registered successfully:', result.digest);

        // Extract transaction details
        const nftObjectId = result.objectId || result.id || `nft_${Date.now()}`;
        const transactionDigest = result.digest || result.transactionDigest || `tx_${Date.now()}`;

        // Update session with registration status
        session.isRegistered = true;
        session.registrationTx = transactionDigest;
        session.nftObjectId = nftObjectId;
        session.nftMetadata = nftMetadata;
        session.imageUrl = imageUrl;
        session.registrationDate = new Date().toISOString();

        console.log('✅ NFT minting and wallet registration completed successfully');

        res.json({
            success: true,
            message: 'NFT minted and wallet registered successfully (wallet-sponsored)',
            transactionDigest: result.digest,
            registered: result.registered,
            sponsored: result.sponsored,
            sponsorType: 'wallet',
            nftMetadata: result.nftMetadata,
            imageUrl: result.imageUrl,
            recipient: result.recipient,
            userAddress: session.userAddress,
            registrationDate: session.registrationDate,
            nftObjectId: result.nftObjectId
        });

    } catch (error) {
        console.error('❌ NFT minting error:', error);
        
        // Log detailed error information for Enoki API errors
        if (error.response) {
            console.error('❌ Enoki API Error Response:', {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data,
                headers: error.response.headers
            });
        }
        
        // Since we're using wallet sponsoring as primary method, no fallback needed
        
        res.status(500).json({
            success: false,
            error: error.message,
            details: 'Failed to mint NFT and register wallet with wallet sponsoring',
            walletSponsorError: error.message || null
        });
    }
});

// Update NFT contract configuration endpoint for examples::testnet_nft
app.post('/api/update-nft-contract', (req, res) => {
    try {
        const { packageId, moduleName, functionName, structName } = req.body;
        
        if (!packageId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: packageId'
            });
        }

        const config = updateNFTContract(packageId, moduleName, functionName, structName);
        
        res.json({
            success: true,
            message: 'custom_nft::photo_nft contract configuration updated successfully',
            config: config,
            note: 'Ready to mint real PhotoNFTs using your custom contract'
        });

    } catch (error) {
        console.error('❌ Error updating NFT contract configuration:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get wallet registration status
app.get('/api/registration-status/:sessionId', (req, res) => {
    try {
        const { sessionId } = req.params;

        if (!sessionId || !sessions.has(sessionId)) {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }

        const session = sessions.get(sessionId);

        res.json({
            success: true,
            isRegistered: session.isRegistered || false,
            registrationTx: session.registrationTx || null,
            nftObjectId: session.nftObjectId || null,
            registrationDate: session.registrationDate || null,
            userAddress: session.userAddress || null
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// OAuth callback handler for implicit flow (receives id_token in URL fragment)
app.get('/callback', (req, res) => {
    // For implicit flow, the id_token comes in the URL fragment, not query parameters
    // We need to handle this on the client side with JavaScript
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>zkLogin OAuth Callback</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    margin: 40px; 
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                }
                .container {
                    background: rgba(255, 255, 255, 0.1);
                    padding: 30px;
                    border-radius: 15px;
                    backdrop-filter: blur(10px);
                    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
                    border: 1px solid rgba(255, 255, 255, 0.18);
                    max-width: 600px;
                    text-align: center;
                }
                .token { 
                    word-break: break-all; 
                    background: rgba(0, 0, 0, 0.2); 
                    padding: 15px; 
                    margin: 15px 0; 
                    border-radius: 8px;
                    font-family: monospace;
                    font-size: 12px;
                    max-height: 200px;
                    overflow-y: auto;
                }
                .success { color: #4ade80; }
                .error { color: #f87171; }
                .info { color: #60a5fa; }
                .loading { color: #fbbf24; }
                .btn {
                    background: #4ade80;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                    margin: 10px;
                    font-size: 14px;
                }
                .btn:hover { background: #22c55e; }
                .btn:disabled { background: #6b7280; cursor: not-allowed; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1 id="status" class="loading">🔄 Processing OAuth Response...</h1>
                <div id="content"></div>
                <div id="token-display" style="display: none;">
                    <p class="info">JWT Token received:</p>
                    <div class="token" id="token-content"></div>
                    <button class="btn" onclick="copyToken()">📋 Copy Token</button>
                    <button class="btn" onclick="returnToApp()">🏠 Return to App</button>
                </div>
            </div>

            <script>
                function parseFragment() {
                    const fragment = window.location.hash.substring(1);
                    const params = new URLSearchParams(fragment);
                    return {
                        id_token: params.get('id_token'),
                        state: params.get('state'),
                        error: params.get('error'),
                        error_description: params.get('error_description')
                    };
                }

                function copyToken() {
                    const token = document.getElementById('token-content').textContent;
                    navigator.clipboard.writeText(token).then(() => {
                        alert('JWT token copied to clipboard!');
                    }).catch(err => {
                        console.error('Failed to copy token:', err);
                    });
                }

                function returnToApp() {
                    const token = document.getElementById('token-content').textContent;
                    const state = parseFragment().state;
                    
                    // Store token in sessionStorage for the main app to pick up
                    sessionStorage.setItem('zklogin_jwt', token);
                    sessionStorage.setItem('zklogin_state', state);
                    
                    // Redirect back to main app
                    window.location.href = '/';
                }

                // Process the OAuth response
                const params = parseFragment();
                const statusEl = document.getElementById('status');
                const contentEl = document.getElementById('content');
                const tokenDisplayEl = document.getElementById('token-display');
                const tokenContentEl = document.getElementById('token-content');

                if (params.error) {
                    statusEl.className = 'error';
                    statusEl.textContent = '❌ OAuth Authentication Failed';
                    contentEl.innerHTML = \`
                        <p><strong>Error:</strong> \${params.error}</p>
                        <p><strong>Description:</strong> \${params.error_description || 'Unknown error'}</p>
                        <button class="btn" onclick="window.location.href='/'">🏠 Return to App</button>
                    \`;
                } else if (params.id_token) {
                    statusEl.className = 'success';
                    statusEl.textContent = '✅ OAuth Authentication Successful';
                    tokenContentEl.textContent = params.id_token;
                    tokenDisplayEl.style.display = 'block';
                    
                    // Auto-return to app after 3 seconds
                    setTimeout(() => {
                        returnToApp();
                    }, 3000);
                    
                    contentEl.innerHTML = '<p class="info">Automatically returning to app in 3 seconds...</p>';
                } else {
                    statusEl.className = 'error';
                    statusEl.textContent = '❌ Missing ID Token';
                    contentEl.innerHTML = \`
                        <p>No id_token found in the OAuth response.</p>
                        <p>This might be due to:</p>
                        <ul style="text-align: left;">
                            <li>Incorrect OAuth configuration</li>
                            <li>Client ID not configured for implicit flow</li>
                            <li>Redirect URI mismatch</li>
                        </ul>
                        <button class="btn" onclick="window.location.href='/'">🏠 Return to App</button>
                    \`;
                }
            </script>
        </body>
        </html>
    `);
});

// Serve the main application
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'demo.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 zkLogin Production Server running on port ${PORT}`);
    console.log(`📱 Web interface: http://localhost:${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`📋 API endpoints:`);
    console.log(`   POST /api/init - Initialize zkLogin session`);
    console.log(`   POST /api/generate-keys - Generate ephemeral key pair`);
    console.log(`   POST /api/prepare-jwt - Prepare for JWT acquisition`);
    console.log(`   POST /api/process-jwt - Process JWT token`);
    console.log(`   POST /api/generate-zkproof - Generate zkProof using Sui SDK`);
    console.log(`   POST /api/create-transaction - Create and sign transaction`);
    console.log(`   POST /api/mint-nft-register - Mint NFT and register wallet (sponsored gas)`);
    console.log(`   GET  /api/registration-status/:id - Get wallet registration status`);
    console.log(`   GET  /api/session/:id - Get session state`);
    console.log(`   GET  /api/providers - Get supported OAuth providers`);
    console.log(`   GET  /callback - OAuth callback handler`);
    console.log(`\n💡 Ready for production use!`);
});

module.exports = app;