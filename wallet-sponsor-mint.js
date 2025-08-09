const { SuiClient } = require('@mysten/sui/client');
const { Transaction } = require('@mysten/sui/transactions');
const { Ed25519Keypair } = require('@mysten/sui/keypairs/ed25519');
const { fromBase64 } = require('@mysten/sui/utils');
require('dotenv').config();

// Wallet sponsoring configuration
const SPONSOR_PRIVATE_KEY = process.env.SPONSOR_PRIVATE_KEY; // Add this to your .env file
const SPONSOR_ADDRESS = process.env.SPONSOR_ADDRESS; // Add this to your .env file

const NFT_CONTRACT_CONFIG = {
    packageId: process.env.PACKAGE_ID,
    moduleName: 'photo_nft',
    functionName: 'mint_nft'
};

async function mintNFTWithWalletSponsor(userAddress, nftMetadata) {
    console.log('🏦 Minting NFT with wallet sponsoring...');
    
    try {
        // Validate package ID
        if (!NFT_CONTRACT_CONFIG.packageId) {
            throw new Error('PACKAGE_ID not found in environment variables. Please check your .env file.');
        }
        
        console.log('📦 Using package ID:', NFT_CONTRACT_CONFIG.packageId);
        // Initialize Sui client
        const suiClient = new SuiClient({
            url: 'https://fullnode.testnet.sui.io:443'
        });
        
        // Create sponsor keypair from private key
        if (!SPONSOR_PRIVATE_KEY) {
            throw new Error('SPONSOR_PRIVATE_KEY not found in environment variables');
        }
        
        // Handle different private key formats
        let sponsorKeypair;
        if (SPONSOR_PRIVATE_KEY.startsWith('suiprivkey1')) {
            // Sui format private key
            sponsorKeypair = Ed25519Keypair.fromSecretKey(SPONSOR_PRIVATE_KEY);
        } else {
            // Base64 format private key
            sponsorKeypair = Ed25519Keypair.fromSecretKey(fromBase64(SPONSOR_PRIVATE_KEY));
        }
        const sponsorAddress = sponsorKeypair.getPublicKey().toSuiAddress();
        
        console.log('🏦 Sponsor address:', sponsorAddress);
        console.log('👤 User address:', userAddress);
        
        // Create transaction
        const tx = new Transaction();
        
        // Set gas budget
        tx.setGasBudget(10000000); // 0.01 SUI
        
        // Add the NFT minting move call
        // Function signature: mint_nft(recipient: address, name: string::String, description: string::String, image_url: string::String, ctx: &mut TxContext)
        tx.moveCall({
            target: `${NFT_CONTRACT_CONFIG.packageId}::${NFT_CONTRACT_CONFIG.moduleName}::${NFT_CONTRACT_CONFIG.functionName}`,
            arguments: [
                tx.pure.address(userAddress),        // recipient (first parameter)
                tx.pure.string(nftMetadata.name),    // name
                tx.pure.string(nftMetadata.description), // description
                tx.pure.string(nftMetadata.image)    // image_url
            ]
        });
        
        // Transfer the minted NFT to the user (if needed)
        // The mint_to_sender function should handle this automatically
        
        console.log('📝 Transaction created with move call');
        
        // Sign and execute transaction with sponsor wallet
        const result = await suiClient.signAndExecuteTransaction({
            transaction: tx,
            signer: sponsorKeypair,
            options: {
                showEffects: true,
                showObjectChanges: true,
                showEvents: true
            }
        });
        
        console.log('✅ Transaction executed successfully');
        console.log('📝 Transaction digest:', result.digest);
        
        // Extract NFT object ID from object changes
        let nftObjectId = null;
        if (result.objectChanges) {
            for (const change of result.objectChanges) {
                if (change.type === 'created' && change.objectType?.includes('PhotoNFT')) {
                    nftObjectId = change.objectId;
                    break;
                }
            }
        }
        
        return {
            success: true,
            digest: result.digest,
            nftObjectId: nftObjectId,
            sponsored: true,
            sponsorAddress: sponsorAddress,
            recipient: userAddress,
            nftMetadata: nftMetadata
        };
        
    } catch (error) {
        console.error('❌ Wallet-sponsored minting error:', error);
        throw error;
    }
}

module.exports = { mintNFTWithWalletSponsor };