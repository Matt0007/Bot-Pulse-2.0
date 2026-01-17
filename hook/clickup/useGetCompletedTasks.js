import { getClickUpApiKey, clickUpRequest } from '../../utils/clickup.js';

/**
 * Normalise un nom (enlève les accents, normalise les espaces)
 */
function normalizeName(name) {
    return name?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim() || '';
}

/**
 * Vérifie si une date correspond à aujourd'hui
 */
function isToday(timestamp) {
    if (!timestamp) return false;
    
    const date = new Date(Number(timestamp));
    const today = new Date();
    
    // Comparer jour, mois et année
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
}

/**
 * Fonction helper pour traiter une tâche complétée et ses sous-tâches
 */
function processCompletedTask(task, allTasks, responsableName, closedStatusIds, isSubtask = false, addedTaskIds = new Set()) {
    const responsableField = task.custom_fields?.find(f => normalizeName(f.name) === 'responsable');
    const responsable = responsableField && responsableField.value !== undefined 
        ? responsableField.type_config?.options?.[responsableField.value]?.name 
        : undefined;
    
    // Vérifier si le statut est "closed" (utiliser status.type au lieu du nom)
    const isClosed = task.status?.type === 'closed' || closedStatusIds.has(task.status?.id);
    
    // Utiliser uniquement date_closed (date de fermeture réelle)
    // Si date_closed n'existe pas, la tâche n'a pas été fermée ou l'API ne fournit pas cette info
    if (!task.date_closed) {
        // Traiter quand même les sous-tâches
        if (task.subtasks && Array.isArray(task.subtasks)) {
            for (const subtask of task.subtasks) {
                processCompletedTask(subtask, allTasks, responsableName, closedStatusIds, true, addedTaskIds);
            }
        }
        return;
    }
    
    const closedToday = isToday(task.date_closed);
    const isResponsableMatch = normalizeName(responsable || '') === normalizeName(responsableName);
    const isActuallySubtask = isSubtask || !!task.parent;
    
    // Ajouter la tâche si elle est fermée, fermée aujourd'hui, et correspond au responsable
    if (isClosed && closedToday && isResponsableMatch && !addedTaskIds.has(task.id)) {
        allTasks.push({
            id: task.id,
            nom: task.name,
            statut: task.status?.status || 'Complété',
            isSubtask: isActuallySubtask,
            listId: task.list?.id,
            statusId: task.status?.id,
            statusName: task.status?.status,
            dateClosed: new Date(Number(task.date_closed)),
            dateUpdated: task.date_updated ? new Date(Number(task.date_updated)) : null
        });
        addedTaskIds.add(task.id);
    }

    // Traiter les sous-tâches si elles existent
    if (task.subtasks && Array.isArray(task.subtasks)) {
        for (const subtask of task.subtasks) {
            processCompletedTask(subtask, allTasks, responsableName, closedStatusIds, true, addedTaskIds);
        }
    }
}

/**
 * Hook pour récupérer toutes les tâches complétées de la journée d'un responsable depuis ClickUp
 * @param {string} guildId - ID du serveur Discord
 * @param {string} responsableName - Nom du responsable dans ClickUp
 * @param {Array<string>} configuredProjectIds - Liste des IDs de projets (spaces) configurés
 * @returns {Promise<Array>} - Liste des tâches complétées du responsable aujourd'hui
 */
export async function useGetCompletedTasks(guildId, responsableName, configuredProjectIds) {
    try {
        // Si aucun projet n'est configuré, retourner une liste vide
        if (!configuredProjectIds || configuredProjectIds.length === 0) {
            return [];
        }

        const apiKey = await getClickUpApiKey(guildId);
        const allTasks = [];
        const closedStatusIds = new Set();
        const addedTaskIds = new Set();

        // Étape 1: Récupérer tous les statuts "closed" de toutes les listes
        for (const spaceId of configuredProjectIds) {
            try {
                // Récupérer les folders
                const foldersData = await clickUpRequest(apiKey, `/space/${spaceId}/folder?archived=false`);
                const folders = foldersData.folders || [];

                // Récupérer les statuts des listes dans les folders
                for (const folder of folders) {
                    const folderListsData = await clickUpRequest(apiKey, `/folder/${folder.id}/list?archived=false`);
                    const lists = folderListsData.lists || [];

                    for (const list of lists) {
                        try {
                            const listData = await clickUpRequest(apiKey, `/list/${list.id}`);
                            (listData.statuses || []).filter(s => s.type === 'closed').forEach(s => closedStatusIds.add(s.id));
                        } catch (error) {
                            console.error(`Erreur lors de la récupération des statuts de la liste ${list.id}:`, error.message);
                        }
                    }
                }

                // Récupérer les statuts des listes directement dans le space (sans folder)
                const listsData = await clickUpRequest(apiKey, `/space/${spaceId}/list?archived=false`);
                const lists = listsData.lists || [];

                for (const list of lists) {
                    try {
                        const listData = await clickUpRequest(apiKey, `/list/${list.id}`);
                        (listData.statuses || []).filter(s => s.type === 'closed').forEach(s => closedStatusIds.add(s.id));
                    } catch (error) {
                        console.error(`Erreur lors de la récupération des statuts de la liste ${list.id}:`, error.message);
                    }
                }
            } catch (error) {
                console.error(`Erreur lors de la récupération des statuts pour le space ${spaceId}:`, error.message);
            }
        }

        // Étape 2: Récupérer toutes les tâches de toutes les listes avec include_closed=true
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
                        try {
                            const tasksData = await clickUpRequest(apiKey, `/list/${list.id}/task?archived=false&include_closed=true&subtasks=true`);
                            const tasks = tasksData.tasks || [];

                            for (const task of tasks) {
                                processCompletedTask(task, allTasks, responsableName, closedStatusIds, false, addedTaskIds);
                            }
                        } catch (error) {
                            console.error(`Erreur lors de la récupération des tâches complétées de la liste ${list.id}:`, error.message);
                        }
                    }
                }

                // Récupérer les listes directement dans le space (sans folder)
                const listsData = await clickUpRequest(apiKey, `/space/${spaceId}/list?archived=false`);
                const lists = listsData.lists || [];

                for (const list of lists) {
                    try {
                        const tasksData = await clickUpRequest(apiKey, `/list/${list.id}/task?archived=false&include_closed=true&subtasks=true`);
                        const tasks = tasksData.tasks || [];

                        for (const task of tasks) {
                            processCompletedTask(task, allTasks, responsableName, closedStatusIds, false, addedTaskIds);
                        }
                    } catch (error) {
                        console.error(`Erreur lors de la récupération des tâches complétées de la liste ${list.id}:`, error.message);
                    }
                }
            } catch (error) {
                console.error(`Erreur lors du traitement du space ${spaceId} pour les tâches complétées:`, error.message);
            }
        }

        return allTasks;
    } catch (error) {
        console.error('Erreur lors de la récupération des tâches complétées:', error);
        throw error;
    }
}
