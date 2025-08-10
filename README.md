# zkLogin NFT Platform

A complete zkLogin implementation with NFT minting capabilities on the Sui blockchain. This platform allows users to authenticate using Google OAuth and mint photo NFTs without needing to manage private keys directly.

live web: https://zkmint-niminimions-projects.vercel.app
youtube demo: https://youtu.be/xB8K3CxaZSA

## 🚀 Features

Deploy-ready on Vercel with secure handling of environment variables and image uploads:
- Uses Vercel Blob in production to avoid disk writes and prevent sensitive data exposure
- `.env`/`.env.*` files are ignored from Git; configure envs in Vercel dashboard
- Local development continues to write uploaded images to `uploads/`

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

## 🛠️ Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Sui CLI (for contract deployment)
- Google OAuth credentials

### Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd zklogin-nft-platform
```

2. **Install dependencies**
```bash
npm install
```

## Usage

### Basic Key Generation

```javascript
const { generateEphemeralKeyPair } = require('./ephemeralKeys');

// Generate Ed25519 key pair (recommended)
const ed25519Keys = generateEphemeralKeyPair('ed25519');
console.log('Private Key:', ed25519Keys.privateKey);
console.log('Public Key:', ed25519Keys.publicKey);

// Generate secp256k1 key pair
const secp256k1Keys = generateEphemeralKeyPair('secp256k1');
console.log('Private Key:', secp256k1Keys.privateKey);
console.log('Public Key:', secp256k1Keys.publicKey);
```

### Key Validation

```javascript
const { validateKeyPair } = require('./ephemeralKeys');

const isValid = validateKeyPair(keyPair);
console.log('Key pair is valid:', isValid);
```

### Format Conversion

```javascript
const { convertKeyPairFormat } = require('./ephemeralKeys');

// Convert to Base64
const base64Keys = convertKeyPairFormat(keyPair, 'base64');

// Convert to Buffer
const bufferKeys = convertKeyPairFormat(keyPair, 'buffer');
```

## Running the Demo

```bash
npm start
```

## Running Tests

```bash
npm test
```

## Key Pair Structure

Generated key pairs have the following structure:

```javascript
{
  algorithm: 'ed25519' | 'secp256k1',
  privateKey: 'hex_string',
  publicKey: 'hex_string',
  keyLength: 32
}
```

## Security Considerations

- **Ephemeral Nature**: These keys are designed to be temporary and should not be stored long-term
- **Secure Random Generation**: Uses cryptographically secure random number generation
- **Algorithm Choice**: Ed25519 is recommended for most use cases due to its performance and security properties
- **Key Storage**: Private keys should be handled securely and never logged or transmitted in plain text

## Next Steps

This is the foundation for zkLogin implementation. The next steps will include:
1. JWT token handling
2. Zero-knowledge proof generation
3. Signature verification
4. Complete zkLogin flow integration

## Dependencies

- `@noble/ed25519`: Ed25519 cryptographic operations
- `@noble/secp256k1`: secp256k1 cryptographic operations
- `crypto`: Node.js built-in cryptographic functions