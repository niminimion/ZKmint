const axios = require('axios');

async function testMintAPI() {
    console.log('🧪 Testing NFT minting API...');
    
    try {
        const response = await axios.post('http://localhost:3000/api/mint-nft-register', {
            name: 'Test NFT',
            description: 'Testing Enoki integration',
            imageUrl: 'https://example.com/test.jpg'
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Cookie': 'sessionId=test-session-123'
            }
        });
        
        console.log('✅ API Response Status:', response.status);
        console.log('📊 API Response Data:', JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.error('❌ API Error:', error.response?.status || error.message);
        if (error.response?.data) {
            console.error('❌ Error Data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testMintAPI();