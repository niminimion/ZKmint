const { SuiClient } = require('@mysten/sui/client');
const { Transaction } = require('@mysten/sui/transactions');
const axios = require('axios');
require('dotenv').config();

// Configuration
const ENOKI_API_KEY = process.env.ENOKI_API_KEY;
const ENOKI_BASE_URL = 'https://api.enoki.mystenlabs.com/v1';

const NFT_CONTRACT_CONFIG = {
    packageId: process.env.PACKAGE_ID,
    moduleName: 'photo_nft',
    functionName: 'mint_to_sender'
};

async function testMinimalAllowlist() {
    console.log('🧪 Testing minimal Enoki allowlist configuration...');
    
    try {
        // Initialize Sui client
        const suiClient = new SuiClient({
            url: 'https://fullnode.testnet.sui.io:443'
        });
        
        // Create a minimal transaction with just the move call
        const tx = new Transaction();
        
        // Add the move call that should be allowlisted
        tx.moveCall({
            target: `${NFT_CONTRACT_CONFIG.packageId}::${NFT_CONTRACT_CONFIG.moduleName}::${NFT_CONTRACT_CONFIG.functionName}`,
            arguments: [
                tx.pure.string('MinimalTest'),
                tx.pure.string('Testing allowlist'),
                tx.pure.string('https://example.com/test.jpg')
            ]
        });
        
        console.log('📝 Move call target:', `${NFT_CONTRACT_CONFIG.packageId}::${NFT_CONTRACT_CONFIG.moduleName}::${NFT_CONTRACT_CONFIG.functionName}`);
        
        // Build transaction bytes
        const transactionBlockKindBytes = await tx.build({ 
            client: suiClient,
            onlyTransactionKind: true 
        });
        
        console.log('✅ Transaction built successfully');
        console.log('📝 Transaction bytes length:', transactionBlockKindBytes.length);
        
        // Convert to base64
        const base64Bytes = Buffer.from(transactionBlockKindBytes).toString('base64');
        console.log('📝 Base64 length:', base64Bytes.length);
        console.log('📝 Base64 preview:', base64Bytes.substring(0, 50) + '...');
        
        // Test with Enoki
        console.log('📤 Testing Enoki sponsor call...');
        
        const sponsorResponse = await axios.post(
            `${ENOKI_BASE_URL}/transaction-blocks/sponsor`,
            {
                network: 'testnet',
                transactionBlockKindBytes: base64Bytes,
                sender: '0x1234567890abcdef1234567890abcdef12345678' // Test sender address
            },
            {
                headers: {
                    'Authorization': `Bearer ${ENOKI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('✅ Enoki sponsor call successful!');
        console.log('📝 Response status:', sponsorResponse.status);
        console.log('📝 Response data keys:', Object.keys(sponsorResponse.data));
        
        if (sponsorResponse.data.transactionBlockBytes) {
            console.log('✅ Received transaction block bytes');
        }
        
        if (sponsorResponse.data.digest) {
            console.log('✅ Received transaction digest:', sponsorResponse.data.digest);
        }
        
        return true;
        
    } catch (error) {
        console.log('❌ Enoki sponsor error:', error.response?.status || error.message);
        
        if (error.response?.data) {
            console.log('❌ Enoki error data:', JSON.stringify(error.response.data, null, 2));
            
            // Check for specific error messages
            if (error.response.data.errors) {
                const errors = error.response.data.errors;
                for (const err of errors) {
                    if (err.message === 'Transaction must contain at least one command') {
                        console.log('🔍 This error suggests the move call target is not allowlisted');
                        console.log('🔍 Expected allowlist entry:', `${NFT_CONTRACT_CONFIG.packageId}::${NFT_CONTRACT_CONFIG.moduleName}::${NFT_CONTRACT_CONFIG.functionName}`);
                    }
                }
            }
        }
        
        return false;
    }
}

// Run the test
testMinimalAllowlist()
    .then(success => {
        if (success) {
            console.log('🎉 Allowlist test passed! The configuration is working.');
        } else {
            console.log('❌ Allowlist test failed. Please check the configuration.');
        }
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('💥 Unexpected error:', error);
        process.exit(1);
    });