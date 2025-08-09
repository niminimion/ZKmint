# zkLogin NFT Platform

A complete zkLogin implementation with NFT minting capabilities on the Sui blockchain. This platform allows users to authenticate using Google OAuth and mint photo NFTs without needing to manage private keys directly.

## 🚀 Features

### Core zkLogin Functionality
- **Google OAuth Integration**: Seamless authentication using Google accounts
- **Zero-Knowledge Proofs**: Secure authentication without revealing sensitive information
- **Ephemeral Key Management**: Automatic generation and management of temporary key pairs
- **Multiple Key Schemes**: Support for Ed25519 and secp256k1 cryptographic algorithms
- **Session Management**: Secure session handling for multi-step authentication flow

### NFT Capabilities
- **Photo NFT Minting**: Upload and mint images as NFTs on Sui blockchain
- **Custom Smart Contract**: Purpose-built Move contract for photo NFTs
- **Image Upload**: Support for multiple image formats with file validation
- **Metadata Management**: Rich NFT metadata including name, description, and image URL

### Production-Ready Features
- **Enoki Integration**: Official Mysten Labs SDK for zkProof generation
- **Wallet Sponsoring**: Fallback mechanism for transaction sponsoring
- **Database Storage**: SQLite database for user salt management
- **RESTful API**: Complete API endpoints for frontend integration
- **Error Handling**: Comprehensive error handling and validation
- **CORS Support**: Cross-origin resource sharing for web applications

## 📁 Project Structure

```
├── contracts/                 # Move smart contracts
│   ├── sources/
│   │   └── photo_nft.move    # PhotoNFT smart contract
│   ├── Move.toml             # Move package configuration
│   └── build/                # Compiled contracts
├── uploads/                  # Uploaded NFT images
├── server.js                 # Main production server
├── zklogin.js               # zkLogin implementation
├── database.js              # Database utilities
├── deploy-contract.js       # Contract deployment script
├── wallet-sponsor-mint.js   # Wallet sponsoring utilities
├── test-*.js               # Test files
├── demo.html               # Frontend demo
└── user_salts.db           # SQLite database
```

## 🛠️ Complete Setup Guide

### 📋 Prerequisites

Before starting, ensure you have:

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **npm** or **yarn** (comes with Node.js)
- **Sui CLI** - [Installation guide](https://docs.sui.io/guides/developer/getting-started/sui-install)
- **Google OAuth credentials** - [Setup guide](https://developers.google.com/identity/protocols/oauth2)

### 🚀 Step-by-Step Setup

#### Step 1: Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd zklogin-nft-platform

# Install all dependencies
npm install
```

#### Step 2: Set Up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Set application type to "Web application"
6. Add authorized redirect URI: `http://localhost:3000/callback`
7. Copy the **Client ID** (you'll need this for `.env`)

#### Step 3: Get Enoki API Key

1. Visit [Enoki Dashboard](https://enoki.mystenlabs.com/)
2. Sign up/Login with your account
3. Create a new project
4. Copy your **API Key** from the dashboard

#### Step 4: Configure Environment Variables

```bash
# Copy the example file
cp .env.example .env
```

Open `.env` file and fill in your credentials:

```env
# zkLogin Configuration
GOOGLE_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
REDIRECT_URL=http://localhost:3000/callback
KEY_SCHEME=ED25519
SUI_RPC_URL=https://fullnode.devnet.sui.io:443
PORT=3000

# Enoki API Configuration (Required)
ENOKI_API_KEY=enoki_private_1234567890abcdef...

# Wallet Sponsoring (Optional - for fallback)
SPONSOR_PRIVATE_KEY=your-base64-private-key-here
SPONSOR_ADDRESS=your-sponsor-wallet-address-here

# NFT Package Configuration (Will be updated after deployment)
NFT_PACKAGE_ID=0x1
```

#### Step 5: Set Up Sui CLI and Deploy Contract

```bash
# Initialize Sui CLI (first time only)
sui client

# Switch to devnet
sui client switch --env devnet

# Create a new address (if you don't have one)
sui client new-address ed25519

# Get testnet SUI tokens
sui client faucet

# Navigate to contracts directory
cd contracts

# Build the Move contract
sui move build

# Deploy to Sui devnet
sui client publish --gas-budget 20000000
```

**Important**: After deployment, copy the **Package ID** from the output and update your `.env` file:

```env
NFT_PACKAGE_ID=0x1234567890abcdef...  # Replace with your actual package ID
```

#### Step 6: (Optional) Set Up Wallet Sponsoring

If you want wallet sponsoring as a fallback:

```bash
# Create a sponsor wallet
sui client new-address ed25519

# Fund it with testnet SUI
sui client faucet --address YOUR_SPONSOR_ADDRESS

# Export the private key
sui keytool export --key-identity YOUR_SPONSOR_ADDRESS --json
```

Add the sponsor details to your `.env`:

```env
SPONSOR_PRIVATE_KEY=AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyAhIiM=
SPONSOR_ADDRESS=0x1234567890abcdef...
```

#### Step 7: Start the Application

```bash
# Start the server
npm run server

# Or use the demo
npm start
```

The server will start at `http://localhost:3000`

#### Step 8: Test the Setup

1. Open your browser and go to `http://localhost:3000`
2. Open `demo.html` to test the full flow
3. Try minting an NFT to verify everything works

### ✅ Verification Checklist

- [ ] Node.js and npm installed
- [ ] Sui CLI installed and configured
- [ ] Google OAuth credentials obtained
- [ ] Enoki API key obtained
- [ ] `.env` file configured with all credentials
- [ ] Smart contract deployed successfully
- [ ] Package ID updated in `.env`
- [ ] Server starts without errors
- [ ] Demo page loads correctly
- [ ] NFT minting works end-to-end

### 🆘 Troubleshooting

**"GOOGLE_CLIENT_ID not found"**
- Make sure you copied the Client ID correctly from Google Cloud Console
- Ensure there are no extra spaces in the `.env` file

**"Contract deployment failed"**
- Check you have enough SUI in your wallet: `sui client balance`
- Get more testnet SUI: `sui client faucet`
- Increase gas budget: `--gas-budget 30000000`

**"Enoki API error"**
- Verify your API key is correct
- Check your Enoki project is active
- Ensure you're using the correct environment (devnet/testnet)

**"Server won't start"**
- Check all required environment variables are set
- Verify port 3000 is not already in use
- Check Node.js version: `node --version`

## 🚀 Usage

### Start the Server
```bash
npm run server
```

The server will start on `http://localhost:3000`

### API Endpoints

#### Authentication Flow
```bash
# Initialize zkLogin session
POST /api/init

# Generate ephemeral keys
POST /api/generate-keys

# Complete authentication with JWT
POST /api/complete-auth

# Get user address
POST /api/get-address
```

#### NFT Operations
```bash
# Upload and mint NFT
POST /api/mint-nft

# Get user NFTs
GET /api/user-nfts/:address

# Get NFT details
GET /api/nft/:objectId
```

#### Utility Endpoints
```bash
# Health check
GET /health

# Get supported providers
GET /api/providers

# Serve uploaded images
GET /uploads/:filename
```

### Frontend Integration

Use the demo HTML file as a reference:
```bash
open demo.html
```

Or integrate with your frontend framework:

```javascript
// Initialize zkLogin session
const response = await fetch('/api/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
});
const { sessionId } = await response.json();

// Generate keys and get OAuth URL
const keysResponse = await fetch('/api/generate-keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId })
});
const { oauthUrl } = await keysResponse.json();

// Redirect to OAuth
window.location.href = oauthUrl;
```

## 🔧 Smart Contract

The PhotoNFT contract provides the following functionality:

```move
// Mint NFT to sender
public entry fun mint_to_sender(
    name: string::String,
    description: string::String,
    image_url: string::String,
    ctx: &mut TxContext,
)

// Mint NFT to specific recipient
public entry fun mint_nft(
    recipient: address,
    name: string::String,
    description: string::String,
    image_url: string::String,
    ctx: &mut TxContext,
)
```

## 🧪 Testing

Run the test suite:
```bash
# Run all tests
npm test

# Test specific functionality
node test-zklogin.js
node test-nft-mint.js
node test-enoki-flow.js
node test-wallet-sponsor.js
```

## 🔐 Security Features

- **Ephemeral Keys**: Temporary key pairs that expire automatically
- **Zero-Knowledge Proofs**: Authentication without revealing private information
- **Secure Salt Management**: User-specific salts stored securely in database
- **Input Validation**: Comprehensive validation of all inputs
- **File Upload Security**: Image validation and size limits
- **CORS Protection**: Configurable cross-origin policies

## 📚 Architecture

### zkLogin Flow
1. **Initialization**: Generate ephemeral key pair and nonce
2. **OAuth**: Redirect user to Google OAuth
3. **JWT Processing**: Receive and validate JWT token
4. **Proof Generation**: Create zero-knowledge proof using Enoki
5. **Address Derivation**: Calculate user's Sui address
6. **Transaction Execution**: Execute transactions with zkLogin signature

### NFT Minting Flow
1. **Image Upload**: User uploads image file
2. **Metadata Input**: User provides NFT name and description
3. **Transaction Building**: Construct Move call transaction
4. **Signing**: Sign transaction with zkLogin credentials
5. **Execution**: Submit transaction to Sui network
6. **Confirmation**: Return NFT object ID and transaction digest

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:
1. Check the existing documentation
2. Review test files for usage examples
3. Open an issue on GitHub
4. Consult Sui and Enoki documentation

## 🔗 Related Documentation

- [Sui zkLogin Documentation](https://docs.sui.io/concepts/cryptography/zklogin)
- [Enoki SDK Documentation](https://docs.enoki.mystenlabs.com/)
- [Move Language Documentation](https://move-language.github.io/move/)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)