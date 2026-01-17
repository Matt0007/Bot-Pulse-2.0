// Cache des tâches par utilisateur (pour les interactions de pagination)
export const tasksCache = new Map();

/**
 * Vérifie si la session de cache est valide
 * @param {string} userId - L'ID de l'utilisateur
 * @returns {Object|null} Les données en cache ou null si invalide
 */
export function getValidCache(userId) {
    const cachedData = tasksCache.get(userId);
    
    if (!cachedData) {
        return null;
    }

    // Vérifier que la session n'est pas trop ancienne (30 minutes)
    const sessionTimeout = 30 * 60 * 1000; // 30 minutes
    if (Date.now() - cachedData.timestamp > sessionTimeout) {
        tasksCache.delete(userId);
        return null;
    }

    return cachedData;
}

/**
 * Répond avec un message d'erreur de session expirée
 * @param {import('discord.js').Interaction} interaction - L'interaction Discord
 */
export async function replySessionExpired(interaction) {
    await interaction.reply({
        content: '❌ La session a expiré. Utilisez `/tache list` pour rafraîchir.',
        ephemeral: true
    });
}
