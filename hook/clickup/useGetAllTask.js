import { getClickUpApiKey, clickUpRequest } from '../../utils/clickup.js';
import { getTomorrowParisTimestamp } from '../../utils/date.js';

/**
 * Fonction helper pour traiter une tâche et ses sous-tâches
 * @param {boolean} [ignoreStartDate=false] - Si true, n'exclut pas les tâches dont la date de début est future (pour rappels échéances)
 */
function processTask(task, allTasks, responsableName, isSubtask = false, listId = null, ignoreStartDate = false) {
    const responsableField = task.custom_fields?.find(f => {
        const name = f?.name?.toLowerCase().trim();
        return name === 'responsable';
    });
    
    const responsable = responsableField && responsableField.value !== undefined 
        ? responsableField.type_config?.options?.[responsableField.value]?.name 
        : undefined;
    
    const statut = task.status?.status?.toLowerCase() || '';

    // Vérifier si c'est une sous-tâche (soit passé en paramètre, soit détecté via le champ parent)
    const isActuallySubtask = isSubtask || !!task.parent;

    // Filtrer: responsable correspond et statut = "à faire" ou "en cours"
    if (responsable && responsable.toUpperCase() === responsableName.toUpperCase() && 
        (statut.includes('faire') || statut.includes('en cours'))) {
        
        // Ne pas afficher si la date de début est demain ou plus tard (Paris) — sauf si ignoreStartDate
        if (!ignoreStartDate && task.start_date) {
            const startTs = Number(task.start_date);
            const todayParis = getTomorrowParisTimestamp();
            if (Number.isFinite(startTs) && startTs >= todayParis) {
                return; // Ne pas ajouter cette tâche
            }
        }
        
        // Déterminer le statut formaté
        let statutFormate = 'À faire';
        if (statut.includes('en cours') || statut.includes('cours')) {
            statutFormate = 'En cours';
        } else if (statut.includes('à faire') || statut.includes('a faire') || statut.includes('faire')) {
            statutFormate = 'À faire';
        }
        
        allTasks.push({
            id: task.id,
            nom: task.name,
            statut: statutFormate,
            isSubtask: isActuallySubtask,
            listId: listId || task.list?.id,
            statusId: task.status?.id,
            statusName: task.status?.status,
            due_date: task.due_date || null
        });
    }

    // Traiter les sous-tâches si elles existent
    if (task.subtasks && Array.isArray(task.subtasks)) {
        for (const subtask of task.subtasks) {
            processTask(subtask, allTasks, responsableName, true, listId, ignoreStartDate);
        }
    }
}

/**
 * Hook pour récupérer toutes les tâches d'un responsable depuis ClickUp
 * @param {string} guildId - ID du serveur Discord
 * @param {string} responsableName - Nom du responsable dans ClickUp
 * @param {Array<string>} configuredProjectIds - Liste des IDs de projets (spaces) configurés
 * @param {{ ignoreStartDate?: boolean }} [options] - Si ignoreStartDate=true, inclut les tâches dont la date de début est future (pour rappels)
 * @returns {Promise<Array>} - Liste des tâches du responsable
 */
export async function useGetAllTask(guildId, responsableName, configuredProjectIds, options = {}) {
    try {
        // Si aucun projet n'est configuré, retourner une liste vide
        if (!configuredProjectIds || configuredProjectIds.length === 0) {
            return [];
        }

        const apiKey = await getClickUpApiKey(guildId);
        const ignoreStartDate = options.ignoreStartDate === true;
        const allTasks = [];

        // Fonction helper pour récupérer et traiter les tâches d'une liste
        const processListTasks = async (listId) => {
            try {
                const tasksData = await clickUpRequest(apiKey, `/list/${listId}/task?archived=false&include_markdown_description=true&subtasks=true`);
                const tasks = tasksData.tasks || [];

                for (const task of tasks) {
                    processTask(task, allTasks, responsableName, false, listId, ignoreStartDate);
                }
            } catch (error) {
                console.error(`Erreur lors de la récupération des tâches de la liste ${listId}:`, error.message);
            }
        };

        // Parcourir uniquement les spaces configurés
        for (const spaceId of configuredProjectIds) {
            try {
                // Récupérer les folders
                const foldersData = await clickUpRequest(apiKey, `/space/${spaceId}/folder?archived=false`);
                const folders = foldersData.folders || [];

                // Récupérer les listes dans les folders
                for (const folder of folders) {
                    const folderListsData = await clickUpRequest(apiKey, `/folder/${folder.id}/list?archived=false`);
                    const lists = folderListsData.lists || [];

                    for (const list of lists) {
                        await processListTasks(list.id);
                    }
                }

                // Récupérer les listes directement dans le space (sans folder)
                const listsData = await clickUpRequest(apiKey, `/space/${spaceId}/list?archived=false`);
                const lists = listsData.lists || [];

                for (const list of lists) {
                    await processListTasks(list.id);
                }
            } catch (error) {
                console.error(`Erreur lors du traitement du space ${spaceId}:`, error.message);
            }
        }

        // Inverser l'ordre pour afficher de haut en bas (comme dans ClickUp)
        return allTasks.reverse();
    } catch (error) {
        console.error('Erreur lors de la récupération des tâches:', error);
        throw error;
    }
}
