const axios = require('axios');
require('dotenv').config();

async function testEnokiAPI() {
    console.log('🔍 Testing Enoki API configuration...');
    console.log('🔑 API Key (first 10 chars):', process.env.ENOKI_API_KEY?.substring(0, 10) + '...');
    
    try {
        // Test 1: Try to make a simple request to test API key validity
        console.log('📋 Testing API key with sponsor endpoint...');
        
        // Try a minimal sponsor request to test authentication
        const testPayload = {
            transactionBlockKindBytes: "test",
            network: "testnet"
        };
        
        const testResponse = await axios.post('https://api.enoki.mystenlabs.com/v1/sponsor', testPayload, {
            headers: {
                'Authorization': `Bearer ${process.env.ENOKI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Enoki API response:', testResponse.status);
        console.log('📊 Response:', testResponse.data);
        
    } catch (error) {
        console.error('❌ Enoki API test failed:', error.message);
        
        if (error.response) {
            console.error('❌ Error details:', {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data
            });
            
            // Analyze the error
            if (error.response.status === 401) {
                console.error('🔑 Authentication failed - check your ENOKI_API_KEY');
            } else if (error.response.status === 403) {
                console.error('🚫 Forbidden - API key might not have required permissions');
            } else if (error.response.status === 400) {
                console.log('✅ API key is valid (400 error expected for test payload)');
                console.log('📋 Error details show API is responding correctly');
            }
        }
    }
}

testEnokiAPI();