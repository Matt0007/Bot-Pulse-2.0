import { getClickUpApiKey, clickUpRequest } from '../../utils/clickup.js';

/**
 * Récupère récursivement toutes les sous-tâches d'une tâche
 * @param {string} apiKey - Clé API ClickUp
 * @param {string} taskId - ID de la tâche parente
 * @param {number} level - Niveau de profondeur (0 = tâche principale, 1 = sous-tâche, 2 = sous-sous-tâche)
 * @returns {Promise<Array>} - Liste des sous-tâches avec leur niveau
 */
async function getSubtasksRecursive(apiKey, taskId, level = 0) {
    try {
        const subtasksData = await clickUpRequest(apiKey, `/task/${taskId}/subtask?archived=false`);
        const subtasks = subtasksData.subtasks || [];
        
        const allSubtasks = [];
        
        for (const subtask of subtasks) {
            allSubtasks.push({
                id: subtask.id,
                name: subtask.name,
                level: level + 1
            });
            
            // Récupérer récursivement les sous-sous-tâches
            const nestedSubtasks = await getSubtasksRecursive(apiKey, subtask.id, level + 1);
            allSubtasks.push(...nestedSubtasks);
        }
        
        return allSubtasks;
    } catch (error) {
        console.error(`Erreur lors de la récupération des sous-tâches pour ${taskId}:`, error);
        return [];
    }
}

/**
 * Hook pour récupérer toutes les tâches assignées à un utilisateur Discord
 * @param {string} guildId - ID du serveur Discord
 * @param {string} userEmail - Email de l'utilisateur Discord (ou identifiant ClickUp)
 * @returns {Promise<Array>} - Liste des tâches avec leurs sous-tâches
 */
export async function useGetAllTask(guildId, userEmail) {
    const apiKey = await getClickUpApiKey(guildId);
    
    // Récupérer tous les teams
    const teamsData = await clickUpRequest(apiKey, '/team');
    if (!teamsData.teams?.length) return [];
    
    const allTasks = [];
    
    // Parcourir tous les teams
    for (const team of teamsData.teams) {
        try {
            // Récupérer toutes les tâches du team avec pagination
            let page = 0;
            let hasMore = true;
            
            while (hasMore) {
                const tasksData = await clickUpRequest(apiKey, `/team/${team.id}/task?archived=false&include_closed=false&page=${page}`);
                const tasks = tasksData.tasks || [];
                
                if (!tasks.length) {
                    hasMore = false;
                    break;
                }
                
                // Filtrer les tâches assignées à l'utilisateur
                for (const task of tasks) {
                    const isAssigned = task.assignees?.some(assignee => 
                        assignee.email?.toLowerCase() === userEmail.toLowerCase() ||
                        assignee.username?.toLowerCase() === userEmail.toLowerCase()
                    );
                    
                    if (isAssigned) {
                        allTasks.push({
                            id: task.id,
                            name: task.name,
                            level: 0
                        });
                        
                        // Récupérer récursivement les sous-tâches
                        const subtasks = await getSubtasksRecursive(apiKey, task.id, 0);
                        allTasks.push(...subtasks);
                    }
                }
                
                page++;
                // Limiter à 10 pages pour éviter les boucles infinies
                if (page >= 10) hasMore = false;
            }
        } catch (error) {
            console.error(`Erreur lors de la récupération des tâches du team ${team.id}:`, error);
            continue;
        }
    }
    
    return allTasks;
}
