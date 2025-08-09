const { SuiClient } = require('@mysten/sui/client');

async function verifyContract() {
    const client = new SuiClient({ url: 'https://fullnode.testnet.sui.io' });
    const packageId = '0x009205b5a1a4e85a78747bb946f70a6dd6f78d312403ab00e807e018c3a2a3ab';
    
    try {
        console.log('🔍 Checking if package exists:', packageId);
        const packageObject = await client.getObject({
            id: packageId,
            options: {
                showType: true,
                showContent: true,
                showOwner: true
            }
        });
        
        console.log('✅ Package found:', JSON.stringify(packageObject, null, 2));
        
        // Also try to get the package's modules
        console.log('🔍 Getting package modules...');
        const normalizedPackage = await client.getNormalizedMoveModulesByPackage({
            package: packageId
        });
        
        console.log('📦 Package modules:', Object.keys(normalizedPackage));
        
        if (normalizedPackage.photo_nft) {
            console.log('✅ photo_nft module found');
            console.log('📋 Functions in photo_nft:', Object.keys(normalizedPackage.photo_nft.exposedFunctions || {}));
        } else {
            console.log('❌ photo_nft module NOT found');
            console.log('Available modules:', Object.keys(normalizedPackage));
        }
        
    } catch (error) {
        console.error('❌ Error checking package:', error.message);
        
        if (error.message.includes('not found') || error.message.includes('does not exist')) {
            console.error('❌ CRITICAL: Package does not exist on testnet!');
            console.error('   This explains why moveCall is silently failing.');
            console.error('   The package needs to be deployed first.');
        }
    }
}

verifyContract().catch(console.error);