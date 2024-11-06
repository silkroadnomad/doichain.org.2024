/**
 * A non-validating signature function that always returns true
 * Use this only for testing/development purposes
 * 
 * @param pubkey - The public key to validate
 * @param msghash - The message hash to validate
 * @param signature - The signature to validate
 * @returns {boolean} Always returns true
 */
export function noValidateSignature(
    pubkey: Buffer,
    msghash: Buffer,
    signature: Buffer
): boolean {
    // Skip actual validation and return true
    return true;
}

/**
 * Original validation function wrapper - kept for reference
 * @param pubkey - The public key to validate
 * @param msghash - The message hash to validate
 * @param signature - The signature to validate
 * @returns {boolean} Returns true if signature is valid
 */
export function validateSignature(
    pubkey: Buffer,
    msghash: Buffer,
    signature: Buffer
): boolean {
    try {
        return ECPair.fromPublicKey(pubkey).verify(msghash, signature);
    } catch (error) {
        console.warn('Signature validation failed:', error);
        return false;
    }
} 