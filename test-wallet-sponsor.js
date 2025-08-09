const { mintNFTWithWalletSponsor } = require('./wallet-sponsor-mint');
require('dotenv').config();

async function testWalletSponsor() {
    console.log('🧪 Testing wallet-sponsored NFT minting...');
    
    try {
        // Test recipient address (you can use any valid Sui address)
        const testRecipient = '0x009205b5a1a4e85a78747bb946f70a6dd6f78d312403ab00e807e018c3a2a3ab';
        
        // Test NFT metadata
        const nftMetadata = {
            name: 'Test Wallet Sponsored NFT',
            description: 'This NFT was minted using wallet sponsoring instead of Enoki',
            image: 'https://example.com/test-image.jpg'
        };
        
        console.log('🔍 Test configuration:');
        console.log('  Recipient:', testRecipient);
        console.log('  NFT Name:', nftMetadata.name);
        console.log('  Sponsor configured:', !!process.env.SPONSOR_PRIVATE_KEY);
        
        // Call the wallet sponsor mint function
        const result = await mintNFTWithWalletSponsor(testRecipient, nftMetadata);
        
        console.log('✅ Wallet-sponsored minting successful!');
        console.log('📝 Result:', JSON.stringify(result, null, 2));
        
    } catch (error) {
        console.error('❌ Wallet-sponsored minting failed:', error);
        console.error('Error details:', error.message);
        
        if (error.message?.includes('SPONSOR_PRIVATE_KEY')) {
            console.log('💡 Make sure SPONSOR_PRIVATE_KEY and SPONSOR_ADDRESS are set in .env file');
        }
    }
}

testWalletSponsor();