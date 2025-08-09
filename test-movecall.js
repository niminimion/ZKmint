const { Transaction } = require('@mysten/sui/transactions');

async function testMoveCall() {
    console.log('🧪 Testing moveCall validation...');
    
    const txb = new Transaction();
    
    // NFT Contract Configuration
    const NFT_CONTRACT_CONFIG = {
        packageId: '0x009205b5a1a4e85a78747bb946f70a6dd6f78d312403ab00e807e018c3a2a3ab',
        moduleName: 'photo_nft',
        functionName: 'mint_to_sender'
    };
    
    const contractTarget = `${NFT_CONTRACT_CONFIG.packageId}::${NFT_CONTRACT_CONFIG.moduleName}::${NFT_CONTRACT_CONFIG.functionName}`;
    console.log('🎯 Contract target:', contractTarget);
    
    // Test values
    const safeName = "TestNFT";
    const safeDescription = "Test Description";
    const safeImage = "https://example.com/image.png";
    
    console.log('🔍 Preparing moveCall arguments:');
    const nameArg = txb.pure.string(safeName);
    const descArg = txb.pure.string(safeDescription);
    const imageArg = txb.pure.string(safeImage);
    
    console.log('  Name argument created:', !!nameArg);
    console.log('  Description argument created:', !!descArg);
    console.log('  Image argument created:', !!imageArg);
    
    console.log('🚀 Executing moveCall...');
    const moveCallResult = txb.moveCall({
        target: contractTarget,
        arguments: [
            nameArg,
            descArg,
            imageArg
        ]
    });
    
    console.log('✅ moveCall executed, result:', moveCallResult);
    console.log('🔍 Transaction block structure after moveCall:');
    console.log('  Transaction inputs:', txb.blockData?.inputs?.length || 0);
    console.log('  Transaction commands:', txb.blockData?.transactions?.length || 0);
    console.log('  Transaction blockData:', JSON.stringify(txb.blockData, null, 2));
    
    // CRITICAL: Validate that the transaction actually has commands
    const commandCount = txb.blockData?.transactions?.length || 0;
    if (commandCount === 0) {
        console.error('❌ CRITICAL ERROR: Transaction has no commands after moveCall!');
        console.error('❌ This means moveCall silently failed.');
        return false;
    } else {
        console.log(`✅ Transaction validation passed: ${commandCount} command(s) added`);
        return true;
    }
}

testMoveCall().then(success => {
    console.log('🏁 Test result:', success ? 'SUCCESS' : 'FAILED');
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('❌ Test error:', error);
    process.exit(1);
});