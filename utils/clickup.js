import prisma from './prisma.js';
import { decrypt } from './encryption.js';

/**
 * Récupère la clé API ClickUp déchiffrée pour un serveur
 * @param {string} guildId - ID du serveur Discord
 * @returns {Promise<string>} - Clé API déchiffrée
 * @throws {Error} - Si la clé API n'est pas configurée
 */
export async function getClickUpApiKey(guildId) {
    const guildConfig = await prisma.guildConfig.findUnique({
        where: { guildId }
    });

    if (!guildConfig?.clickupApiKey) {
        throw new Error('Clé API ClickUp non configurée');
    }

    return decrypt(guildConfig.clickupApiKey);
}

/**
 * Effectue une requête à l'API ClickUp
 * @param {string} apiKey - Clé API ClickUp
 * @param {string} endpoint - Endpoint de l'API (ex: '/team')
 * @param {object} options - Options de la requête (method, body, etc.)
 * @returns {Promise<object>} - Réponse de l'API
 * @throws {Error} - Si la requête échoue
 */
export async function clickUpRequest(apiKey, endpoint, options = {}) {
    const { method = 'GET', body = null } = options;
    const baseUrl = 'https://api.clickup.com/api/v2';
    const url = `${baseUrl}${endpoint}`;

    const requestOptions = {
        method,
        headers: {
            'Authorization': apiKey,
            'Content-Type': 'application/json'
        }
    };

    if (body) {
        requestOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, requestOptions);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erreur API ClickUp: ${response.status} - ${errorData.err || response.statusText}`);
    }

    return await response.json();
}