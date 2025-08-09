const { execSync } = require('child_process');
const path = require('path');

// Published package ID
const PACKAGE_ID = '0x009205b5a1a4e85a78747bb946f70a6dd6f78d312403ab00e807e018c3a2a3ab';

async function testMinting() {
    try {
        console.log('Testing NFT minting...');
        
        // Test minting an NFT
        const mintCommand = `sui client call --package ${PACKAGE_ID} --module photo_nft --function mint_to_sender --args "Test Photo NFT" "A beautiful test photo" "https://example.com/photo.jpg" --gas-budget 10000000`;
        
        console.log('Executing mint command:', mintCommand);
        const result = execSync(mintCommand, {
            encoding: 'utf8'
        });
        
        console.log('NFT minted successfully!');
        console.log(result);
        
        return result;
    } catch (error) {
        console.error('Error minting NFT:', error.message);
        throw error;
    }
}

async function deployContract() {
    try {
        console.log('Contract already published with Package ID:', PACKAGE_ID);
        console.log('Testing minting functionality...');
        
        await testMinting();
        
        return PACKAGE_ID;
    } catch (error) {
        console.error('Error testing contract:', error.message);
        throw error;
    }
}

// Run deployment test
deployContract()
    .then(() => {
        console.log('Contract testing completed successfully!');
        console.log('Package ID:', PACKAGE_ID);
    })
    .catch((error) => {
        console.error('Contract testing failed:', error);
        process.exit(1);
    });