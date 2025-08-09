/**
 * zkLogin SDK Demo
 * 
 * Demonstrates the complete zkLogin flow using the official Mysten Labs SDK
 */

const { ZkLogin } = require('./zklogin');

async function main() {
    console.log('🔐 zkLogin SDK Implementation Demo');
    console.log('=====================================\n');

    // Configuration for zkLogin
    const config = {
        rpcUrl: 'https://fullnode.devnet.sui.io:443',
        keyScheme: 'ED25519', // or 'Secp256k1'
        provider: 'google',
        clientId: 'demo-client-12345',
        redirectUrl: 'http://localhost:3000/auth/callback',
        maxEpoch: 10,
        userSalt: '0' // In production, this should be unique per user
    };

    try {
        // Initialize zkLogin instance
        const zkLogin = new ZkLogin(config);

        // Run complete demonstration
        const result = await zkLogin.demonstrateCompleteFlow();

        console.log('\n📊 Final Results:');
        console.log('==================');
        console.log(`✅ Success: ${result.success}`);
        console.log(`🔑 Key Scheme: ${result.keyPair.keyScheme}`);
        console.log(`🎫 Nonce: ${result.jwtPreparation.nonce}`);
        console.log(`👤 User Address: ${result.userAddress}`);
        console.log(`📝 Has Signature: ${result.hasSignature}`);

        console.log('\n🌐 OAuth URL for real authentication:');
        console.log(result.jwtPreparation.oauthUrl);

        console.log('\n💡 Next Steps:');
        console.log('1. Use the OAuth URL to authenticate with the provider');
        console.log('2. Receive the JWT token from the OAuth callback');
        console.log('3. Use the JWT to generate zkLogin signatures for transactions');
        console.log('4. Submit transactions to the Sui network');

        // Show current state
        console.log('\n🔍 Current zkLogin State:');
        console.log(JSON.stringify(zkLogin.getState(), null, 2));

    } catch (error) {
        console.error('❌ Demo failed:', error.message);
        console.error(error.stack);
    }
}

// Run the demo
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { main };