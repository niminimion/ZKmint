const { Transaction } = require('@mysten/sui/transactions');
const { SuiClient } = require('@mysten/sui/client');
const { toB64 } = require('@mysten/sui/utils');
const axios = require('axios');
require('dotenv').config();

async function testEnokiFlow() {
    console.log('🧪 Testing complete Enoki flow...');
    
    try {
        // Create the exact same transaction as in NFT minting
        const suiClient = new SuiClient({ url: 'https://fullnode.testnet.sui.io' });
        const txb = new Transaction();
        
        // Test WITHOUT setSender - Enoki might handle sender separately
        const testAddress = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
        // txb.setSender(testAddress);  // Comment out setSender
        console.log('🧪 Testing WITHOUT setSender - Enoki handles sender separately');
        
        // Same contract config as NFT minting
        const NFT_CONTRACT_CONFIG = {
            packageId: process.env.PACKAGE_ID,
            moduleName: 'photo_nft',
            functionName: 'mint_to_sender'
        };
        
        console.log('📦 Contract target:', `${NFT_CONTRACT_CONFIG.packageId}::${NFT_CONTRACT_CONFIG.moduleName}::${NFT_CONTRACT_CONFIG.functionName}`);
        
        // Same arguments as NFT minting
        const safeName = 'TestNFT123';
        const safeDescription = 'TestDescription123';
        const safeImage = 'https://example.com/test.jpg';
        
        // Set sender before building transaction kind bytes
        txb.setSender(testAddress);
        
        console.log('🚀 Adding moveCall...');
        const moveCallResult = txb.moveCall({
            target: `${NFT_CONTRACT_CONFIG.packageId}::${NFT_CONTRACT_CONFIG.moduleName}::${NFT_CONTRACT_CONFIG.functionName}`,
            arguments: [
                txb.pure.string(safeName),
                txb.pure.string(safeDescription),
                txb.pure.string(safeImage)
            ]
        });
        
        console.log('✅ moveCall result:', moveCallResult);
        console.log('✅ Transaction built with moveCall and sender set');
        console.log('📊 Transaction commands after moveCall:', txb.blockData?.transactions?.length || 0);
        
        if ((txb.blockData?.transactions?.length || 0) === 0) {
            throw new Error('❌ moveCall failed - no commands added');
        }
        
        console.log('🔍 Detailed transaction structure:');
        console.log('  blockData:', JSON.stringify(txb.blockData, null, 2));
        
        console.log('🔍 Building transaction kind bytes for Enoki (using provider)...');
    const serializedTx = await txb.build({ 
        client: suiClient, 
        onlyTransactionKind: true 
    });
    console.log('✅ Transaction kind bytes built, length:', serializedTx.length);
    console.log('📝 Serialized bytes (first 50):', Array.from(serializedTx.slice(0, 50)).map(b => b.toString(16).padStart(2, '0')).join(' '));
    console.log('📝 Full serialized bytes:', Array.from(serializedTx).map(b => b.toString(16).padStart(2, '0')).join(' '));
        
        const transactionBlockKindBytesBase64 = toB64(serializedTx);
        console.log('✅ Base64 length:', transactionBlockKindBytesBase64.length);
        console.log('📝 Base64 preview:', transactionBlockKindBytesBase64.substring(0, 100) + '...');
        
        // Try alternative serialization approach
        console.log('🔍 Trying alternative serialization...');
        try {
            const txBytes = await txb.build({ client: suiClient });
            console.log('✅ Alternative build successful, length:', txBytes.length);
            const altBase64 = toB64(txBytes);
            console.log('📝 Alternative base64 length:', altBase64.length);
            console.log('📝 Alternative base64 preview:', altBase64.substring(0, 100) + '...');
        } catch (altError) {
            console.log('❌ Alternative serialization failed:', altError.message);
        }
        
        // Test with the CORRECT method for Enoki: serialize() without sender
        console.log('🔧 Testing CORRECTED approach: serialize() without sender...');
        const correctTxBytes = await txb.serialize();  // Use serialize, not build
        const correctBase64 = toB64(correctTxBytes);
        console.log('✅ Correct serialize length:', correctTxBytes.length);
        console.log('📝 Correct base64 length:', correctBase64.length);
        
        // Test Enoki sponsor call with the WORKING approach from minimal test
        console.log('📤 Testing Enoki sponsor call with WORKING format (onlyTransactionKind)...');
        
        try {
            const sponsorResponse = await axios.post(`https://api.enoki.mystenlabs.com/v1/transaction-blocks/sponsor`, {
                network: 'testnet',
                transactionBlockKindBytes: transactionBlockKindBytesBase64,  // Use the WORKING base64 from onlyTransactionKind
                sender: testAddress  // Enoki handles sender separately
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.ENOKI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('✅ Enoki sponsor response status:', sponsorResponse.status);
            console.log('📊 Enoki response data:', JSON.stringify(sponsorResponse.data, null, 2));
            
        } catch (enokiError) {
            console.error('❌ Enoki sponsor error:', enokiError.response?.status);
            console.error('❌ Enoki error data:', JSON.stringify(enokiError.response?.data, null, 2));
            console.error('❌ Enoki error message:', enokiError.message);
            
            // This is likely where our "Transaction must contain at least one command" error comes from
            if (enokiError.response?.data?.message?.includes('Transaction must contain at least one command')) {
                console.error('🎯 FOUND THE ISSUE: Enoki is rejecting our transaction as empty!');
                console.error('🔍 This means either:');
                console.error('  1. Our serialization is wrong');
                console.error('  2. Enoki is not parsing our transaction correctly');
                console.error('  3. There\'s a mismatch in the transaction format');
            }
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('❌ Stack:', error.stack);
    }
}

testEnokiFlow();