import CryptoJS from 'crypto-js';
import 'dotenv/config';

/**
 * Récupère la clé de chiffrement depuis les variables d'environnement
 */
function getEncryptionKey() {
    const key = process.env.ENCRYPTION_KEY || process.env.DISCORD_TOKEN;
    
    if (!key) {
        throw new Error('ENCRYPTION_KEY or DISCORD_TOKEN must be set in environment variables');
    }
    
    return key;
}

/**
 * Chiffre une chaîne de caractères avec AES-256
 * @param {string} text - Texte à chiffrer
 * @returns {string} - Texte chiffré
 */
export function encrypt(text) {
    if (!text) return null;
    
    try {
        const encrypted = CryptoJS.AES.encrypt(text, getEncryptionKey()).toString();
        return encrypted;
    } catch (error) {
        console.error('Erreur lors du chiffrement:', error);
        throw new Error('Impossible de chiffrer les données');
    }
}

/**
 * Déchiffre une chaîne de caractères
 * @param {string} encryptedText - Texte chiffré
 * @returns {string} - Texte déchiffré
 */
export function decrypt(encryptedText) {
    if (!encryptedText) return null;
    
    try {
        const bytes = CryptoJS.AES.decrypt(encryptedText, getEncryptionKey());
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        return decrypted;
    } catch (error) {
        console.error('Erreur lors du déchiffrement:', error);
        throw new Error('Impossible de déchiffrer les données');
    }
}
