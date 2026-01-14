import { getClickUpApiKey, clickUpRequest } from '../../utils/clickup.js';

/**
 * Hook pour récupérer tous les responsables depuis le champ personnalisé "Responsable" dans ClickUp
 * Le champ "Responsable" est un champ global du workspace, accessible depuis n'importe quelle tâche
 * @param {string} guildId - ID du serveur Discord
 * @returns {Promise<Array>} - Liste des responsables uniques
 */
export async function useGetAllResponsable(guildId) {
    const apiKey = await getClickUpApiKey(guildId);
    
    // Récupérer le premier team et space
    const teamsData = await clickUpRequest(apiKey, '/team');
    if (!teamsData.teams?.length) return [];
    
    const spacesData = await clickUpRequest(apiKey, `/team/${teamsData.teams[0].id}/space`);
    if (!spacesData.spaces?.length) return [];

    const spaceId = spacesData.spaces[0].id;

 

    // Si pas trouvé, chercher dans les folders
    try {
        const foldersData = await clickUpRequest(apiKey, `/space/${spaceId}/folder`);
        if (foldersData.folders?.length) {
            const listsData = await clickUpRequest(apiKey, `/folder/${foldersData.folders[0].id}/list`);
            if (listsData.lists?.length) {
                const taskData = await clickUpRequest(apiKey, `/list/${listsData.lists[0].id}/task?archived=false&limit=1`);
                if (taskData.tasks?.[0]?.custom_fields) {
                    const field = taskData.tasks[0].custom_fields.find(f => {
                        const name = f?.name?.toLowerCase().trim();
                        return name === 'responsable';
                    });
                    if (field?.type === 'drop_down' && field?.type_config?.options) {
                        return field.type_config.options.map(o => o.name).filter(Boolean).map(n => n.trim()).sort();
                    }
                }
            }
        }
    } catch (error) {
        // Si erreur, retourner vide
    }

    return [];
}
