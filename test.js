/**
 * Test Suite for zkLogin SDK Implementation
 */

const { ZkLogin } = require('./zklogin');

async function runTests() {
    console.log('🧪 zkLogin SDK Test Suite');
    console.log('==========================\n');

    let passedTests = 0;
    let totalTests = 0;

    function test(name, testFn) {
        totalTests++;
        try {
            const result = testFn();
            if (result === true || (result && result.then)) {
                if (result.then) {
                    return result.then(res => {
                        if (res) {
                            console.log(`✅ ${name}`);
                            passedTests++;
                        } else {
                            console.log(`❌ ${name}`);
                        }
                    }).catch(err => {
                        console.log(`❌ ${name} - ${err.message}`);
                    });
                } else {
                    console.log(`✅ ${name}`);
                    passedTests++;
                }
            } else {
                console.log(`❌ ${name}`);
            }
        } catch (error) {
            console.log(`❌ ${name} - ${error.message}`);
        }
    }

    // Test 1: zkLogin initialization
    await test('zkLogin initialization', async () => {
        const zkLogin = new ZkLogin({
            keyScheme: 'ED25519',
            provider: 'google',
            clientId: 'test-client',
            redirectUrl: 'http://localhost:3000/callback'
        });
        return zkLogin instanceof ZkLogin;
    });

    // Test 2: Ephemeral key pair generation (Ed25519)
    await test('Ephemeral key pair generation (Ed25519)', async () => {
        const zkLogin = new ZkLogin({ keyScheme: 'ED25519' });
        const result = zkLogin.generateEphemeralKeyPair();
        return result && result.publicKey && result.keyScheme === 'ED25519';
    });

    // Test 3: Ephemeral key pair generation (Secp256k1)
    await test('Ephemeral key pair generation (Secp256k1)', async () => {
        const zkLogin = new ZkLogin({ keyScheme: 'Secp256k1' });
        const result = zkLogin.generateEphemeralKeyPair();
        return result && result.publicKey && result.keyScheme === 'Secp256k1';
    });

    // Test 4: JWT preparation
    await test('JWT preparation', async () => {
        const zkLogin = new ZkLogin({
            keyScheme: 'ED25519',
            provider: 'google',
            clientId: 'test-client',
            redirectUrl: 'http://localhost:3000/callback'
        });
        zkLogin.generateEphemeralKeyPair();
        const result = await zkLogin.prepareForJWT();
        return result && result.randomness && result.nonce && result.oauthUrl;
    });

    // Test 5: OAuth URL generation for different providers
    await test('OAuth URL generation for different providers', async () => {
        const providers = ['google', 'facebook', 'twitch', 'apple'];
        let allValid = true;
        
        for (const provider of providers) {
            const zkLogin = new ZkLogin({
                keyScheme: 'ED25519',
                provider: provider,
                clientId: 'test-client',
                redirectUrl: 'http://localhost:3000/callback'
            });
            zkLogin.generateEphemeralKeyPair();
            const result = await zkLogin.prepareForJWT();
            
            if (!result.oauthUrl || !result.oauthUrl.includes(provider === 'apple' ? 'appleid.apple.com' : provider)) {
                allValid = false;
                break;
            }
        }
        
        return allValid;
    });

    // Test 6: JWT processing
    await test('JWT processing', async () => {
        const zkLogin = new ZkLogin({
            keyScheme: 'ED25519',
            provider: 'google',
            clientId: 'test-client',
            redirectUrl: 'http://localhost:3000/callback'
        });
        zkLogin.generateEphemeralKeyPair();
        await zkLogin.prepareForJWT();
        
        const simulatedJWT = zkLogin.createSimulatedJWT();
        const result = await zkLogin.processJWT(simulatedJWT);
        
        return result && result.jwt && result.userAddress;
    });

    // Test 7: State management
    await test('State management', async () => {
        const zkLogin = new ZkLogin({ keyScheme: 'ED25519' });
        let state = zkLogin.getState();
        
        if (state.hasEphemeralKeyPair) return false;
        
        zkLogin.generateEphemeralKeyPair();
        state = zkLogin.getState();
        
        return state.hasEphemeralKeyPair && !state.hasNonce;
    });

    // Test 8: Complete flow simulation
    await test('Complete flow simulation', async () => {
        const zkLogin = new ZkLogin({
            keyScheme: 'ED25519',
            provider: 'google',
            clientId: 'test-client',
            redirectUrl: 'http://localhost:3000/callback'
        });
        
        const result = await zkLogin.demonstrateCompleteFlow();
        return result && result.success && result.userAddress;
    });

    // Test 9: Error handling for invalid key scheme
    await test('Error handling for invalid key scheme', async () => {
        try {
            const zkLogin = new ZkLogin({ keyScheme: 'INVALID' });
            zkLogin.generateEphemeralKeyPair();
            return false;
        } catch (error) {
            return error.message.includes('Unsupported key scheme');
        }
    });

    // Test 10: Error handling for missing configuration
    await test('Error handling for missing configuration', async () => {
        try {
            const zkLogin = new ZkLogin({});
            zkLogin.generateEphemeralKeyPair();
            await zkLogin.prepareForJWT();
            return false;
        } catch (error) {
            return true; // Any error is expected
        }
    });

    // Wait for all async tests to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log(`\n=== Test Results ===`);
    console.log(`Passed: ${passedTests}/${totalTests}`);
    console.log(`Success Rate: ${((passedTests/totalTests) * 100).toFixed(1)}%`);
    
    if (passedTests === totalTests) {
        console.log(`🎉 All tests passed!`);
    } else {
        console.log(`⚠️ Some tests failed. Please check the implementation.`);
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = { runTests };