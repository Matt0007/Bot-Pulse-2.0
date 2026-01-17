import { getClickUpApiKey, clickUpRequest } from '../../utils/clickup.js';

/**
 * Hook pour récupérer toutes les listes d'un projet ClickUp (space)
 * @param {string} guildId - ID du serveur Discord
 * @param {string} projectId - ID du projet (space) ClickUp
 * @returns {Promise<Array>} - Liste des listes avec leur ID, nom et folder (si applicable)
 */
export async function useGetAllLists(guildId, projectId) {
    try {
        const apiKey = await getClickUpApiKey(guildId);
        const allLists = [];

        // Récupérer les folders
        const foldersData = await clickUpRequest(apiKey, `/space/${projectId}/folder?archived=false`);
        const folders = foldersData.folders || [];

        // Récupérer les listes dans les folders
        for (const folder of folders) {
            try {
                const folderListsData = await clickUpRequest(apiKey, `/folder/${folder.id}/list?archived=false`);
                const lists = folderListsData.lists || [];

                for (const list of lists) {
                    allLists.push({
                        id: list.id,
                        name: list.name,
                        folderName: folder.name,
                        folderId: folder.id
                    });
                }
            } catch (error) {
                console.error(`Erreur lors de la récupération des listes du folder ${folder.id}:`, error.message);
            }
        }

        // Récupérer les listes directement dans le space (sans folder)
        try {
            const listsData = await clickUpRequest(apiKey, `/space/${projectId}/list?archived=false`);
            const lists = listsData.lists || [];

            for (const list of lists) {
                allLists.push({
                    id: list.id,
                    name: list.name,
                    folderName: null,
                    folderId: null
                });
            }
        } catch (error) {
            console.error(`Erreur lors de la récupération des listes du space ${projectId}:`, error.message);
        }

        return allLists;
    } catch (error) {
        console.error('Erreur lors de la récupération des listes:', error);
        throw error;
    }
}
