module custom_nft::photo_nft {
    use std::string;
    use std::ascii;
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::url::{Self, Url};
    use sui::event;

    /// A custom NFT for photo minting with zkLogin integration
    public struct PhotoNFT has key, store {
        id: UID,
        name: string::String,
        description: string::String,
        image_url: Url,
        creator: address,
    }

    /// Event emitted when a PhotoNFT is minted
    public struct PhotoNFTMinted has copy, drop {
        object_id: object::ID,
        creator: address,
        name: string::String,
    }

    /// Create a new PhotoNFT and transfer to sender
    public entry fun mint_to_sender(
        name: string::String,
        description: string::String,
        image_url: string::String,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        
        let nft = PhotoNFT {
            id: object::new(ctx),
            name: name,
            description: description,
            image_url: url::new_unsafe(string::to_ascii(image_url)),
            creator: sender,
        };

        event::emit(PhotoNFTMinted {
            object_id: object::id(&nft),
            creator: sender,
            name: nft.name,
        });

        transfer::public_transfer(nft, sender);
    }

    /// Create a new PhotoNFT and transfer to specified recipient
    public entry fun mint_nft(
        recipient: address,
        name: string::String,
        description: string::String,
        image_url: string::String,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        
        let nft = PhotoNFT {
            id: object::new(ctx),
            name: name,
            description: description,
            image_url: url::new_unsafe(string::to_ascii(image_url)),
            creator: sender,
        };

        event::emit(PhotoNFTMinted {
            object_id: object::id(&nft),
            creator: sender,
            name: nft.name,
        });

        transfer::public_transfer(nft, recipient);
    }

    /// Get the NFT's name
    public fun name(nft: &PhotoNFT): &string::String {
        &nft.name
    }

    /// Get the NFT's description
    public fun description(nft: &PhotoNFT): &string::String {
        &nft.description
    }

    /// Get the NFT's image URL
    public fun image_url(nft: &PhotoNFT): &Url {
        &nft.image_url
    }

    /// Get the NFT's creator
    public fun creator(nft: &PhotoNFT): address {
        nft.creator
    }
}