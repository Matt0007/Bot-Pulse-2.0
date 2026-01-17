import prisma from './prisma.js';

const MAX_HISTORY_DAYS = 180; // Garder 6 mois d'historique
const MAX_HISTORY_ENTRIES = 500; // Maximum 500 entrées par serveur

/**
 * Nettoie l'historique ancien pour un serveur
 * @param {string} guildId - ID du serveur
 */
async function cleanOldHistory(guildId) {
    try {
        // Supprimer les entrées de plus de 6 mois
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        await prisma.historyAdmin.deleteMany({
            where: {
                guildId,
                createdAt: { lt: sixMonthsAgo }
            }
        });
        
        // Si on a encore plus de 500 entrées, supprimer les plus anciennes
        const count = await prisma.historyAdmin.count({ where: { guildId } });
        if (count > MAX_HISTORY_ENTRIES) {
            const toDelete = count - MAX_HISTORY_ENTRIES;
            const oldestEntries = await prisma.historyAdmin.findMany({
                where: { guildId },
                orderBy: { createdAt: 'asc' },
                take: toDelete,
                select: { id: true }
            });
            
            if (oldestEntries.length > 0) {
                await prisma.historyAdmin.deleteMany({
                    where: {
                        id: { in: oldestEntries.map(e => e.id) }
                    }
                });
            }
        }
    } catch (error) {
        console.error('Erreur lors du nettoyage de l\'historique:', error);
    }
}

/**
 * Enregistre une action dans l'historique admin
 * @param {string} guildId - ID du serveur
 * @param {string} userId - ID de l'utilisateur qui a effectué l'action
 * @param {string} userName - Nom de l'utilisateur
 * @param {string} action - Description de l'action (ex: "Ajouter Matt a responsable Gab")
 */
export async function logAdminAction(guildId, userId, userName, action) {
    try {
        await prisma.historyAdmin.create({
            data: {
                guildId,
                userId,
                userName,
                action
            }
        });
        
        // Nettoyer l'historique ancien (de manière asynchrone pour ne pas ralentir)
        cleanOldHistory(guildId).catch(err => console.error('Erreur nettoyage historique:', err));
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement de l\'historique:', error);
    }
}
