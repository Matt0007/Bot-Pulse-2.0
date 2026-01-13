import { getClickUpApiKey, clickUpRequest } from '../../utils/clickup.js';

/**
 * Hook pour récupérer tous les projets ClickUp (spaces)
 * @param {string} guildId - ID du serveur Discord
 * @returns {Promise<Array>} - Liste des projets (spaces)
 */
export async function useGetAllProject(guildId) {
    // Récupérer la clé API
    const apiKey = await getClickUpApiKey(guildId);

    // Récupérer tous les teams
    const teamsData = await clickUpRequest(apiKey, '/team');
    const teams = teamsData.teams || [];

    // Récupérer tous les spaces de tous les teams
    const projects = [];

    for (const team of teams) {
        try {
            const spacesData = await clickUpRequest(apiKey, `/team/${team.id}/space`);
            const spaces = spacesData.spaces || [];

            for (const space of spaces) {
                projects.push({
                    id: space.id,
                    name: space.name
                });
            }
        } catch (error) {
            // Continuer si un team échoue
            console.error(`Erreur lors de la récupération des spaces du team ${team.id}:`, error);
            continue;
        }
    }

    return projects;
}
