/**
 * Test script for NFT minting and wallet registration
 * 
 * This script demonstrates how to use the new NFT mint and registration API
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Test configuration
const testConfig = {
    // Optional: Custom NFT metadata
    nftMetadata: {
        name: 'My zkLogin Wallet NFT',
        description: 'A unique NFT representing my zkLogin wallet registration',
        image: 'https://via.placeholder.com/400x400/4ade80/ffffff?text=My+zkLogin+Wallet',
        attributes: [
            { trait_type: 'Registration Date', value: new Date().toISOString() },
            { trait_type: 'Provider', value: 'Google' },
            { trait_type: 'Wallet Type', value: 'zkLogin' },
            { trait_type: 'Custom Attribute', value: 'Test Wallet' }
        ]
    }
};

async function testNFTMintAndRegistration() {
    try {
        console.log('🧪 Testing NFT Mint and Wallet Registration...\n');

        // Note: In a real scenario, you would have:
        // 1. A valid sessionId from the zkLogin flow
        // 2. A valid zkProof from the generate-zkproof endpoint
        // 3. Valid sponsor address and private key

        const testData = {
            sessionId: 'test_session_id', // Replace with actual session ID
            zkProof: {
                // Replace with actual zkProof from generate-zkproof endpoint
                proofPoints: {
                    a: ["0", "0"],
                    b: [["0", "0"], ["0", "0"]],
                    c: ["0", "0"]
                },
                issBase64Details: {
                    value: "wiaXNzIjoiaHR0cHM6Ly9hY2NvdW50cy5nb29nbGUuY29t",
                    indexMod4: 1
                },
                headerBase64: "eyJhbGciOiJSUzI1NiIsImtpZCI6IjI3ZjJkZjZhMzNhOGI5OGNmZjY3MjcwOGI2NjY4NjU4MzM5YzMzNjAiLCJ0eXAiOiJKV1QifQ"
            },
            nftMetadata: testConfig.nftMetadata
        };

        console.log('📤 Sending NFT mint and registration request with Enoki sponsor...');
        console.log('NFT Metadata:', JSON.stringify(testData.nftMetadata, null, 2));

        const response = await axios.post(`${BASE_URL}/api/mint-nft-register`, testData);

        if (response.data.success) {
            console.log('\n✅ NFT Mint and Registration Successful!');
            console.log('Transaction Digest:', response.data.transactionDigest);
            console.log('NFT Object ID:', response.data.nftObjectId);
            console.log('User Address:', response.data.userAddress);
            console.log('Sponsor Address:', response.data.sponsorAddress);
            console.log('Gas Used:', response.data.gasUsed);
            console.log('Registration Date:', response.data.registrationDate);
            
            // Test registration status endpoint
            console.log('\n🔍 Checking registration status...');
            const statusResponse = await axios.get(`${BASE_URL}/api/registration-status/${testData.sessionId}`);
            
            if (statusResponse.data.success) {
                console.log('Registration Status:', statusResponse.data);
            }
        } else {
            console.log('❌ NFT Mint and Registration Failed:', response.data.error);
        }

    } catch (error) {
        console.error('❌ Test Error:', error.response?.data || error.message);
        
        if (error.response?.data?.details) {
            console.error('Details:', error.response.data.details);
        }
    }
}

// Usage instructions
console.log('📋 NFT Mint and Registration Test Script');
console.log('==========================================\n');

console.log('⚠️  Before running this test, you need to:');
console.log('1. Complete the zkLogin flow to get a valid sessionId');
console.log('2. Generate a zkProof using the /api/generate-zkproof endpoint');
console.log('3. Ensure ENOKI_API_KEY is set in your .env file\n');

console.log('🔧 Configuration needed:');
console.log('- Enoki API Key: Already set in .env file');
console.log('- Network: Using testnet (automatic with Enoki)');
console.log('- Gas Sponsor: Handled automatically by Enoki\n');

console.log('🚀 To run the actual test, uncomment the line below:');
console.log('// testNFTMintAndRegistration();\n');

// Uncomment to run the test (after providing valid configuration)
// testNFTMintAndRegistration();

module.exports = {
    testNFTMintAndRegistration,
    testConfig
};