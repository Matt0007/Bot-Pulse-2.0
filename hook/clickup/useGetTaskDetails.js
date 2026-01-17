import { getClickUpApiKey, clickUpRequest } from '../../utils/clickup.js';

/**
 * Récupère les détails complets d'une tâche depuis ClickUp (avec ses sous-tâches)
 * @param {string} guildId - ID du serveur Discord
 * @param {string} taskId - ID de la tâche
 * @returns {Promise<object>} - Détails de la tâche avec subtasks
 */
export async function useGetTaskDetails(guildId, taskId) {
    const apiKey = await getClickUpApiKey(guildId);
    return await clickUpRequest(apiKey, `/task/${taskId}?include_subtasks=true`);
}
