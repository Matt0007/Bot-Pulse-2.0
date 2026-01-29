import { getClickUpApiKey, clickUpRequest } from '../../utils/clickup.js';

/**
 * Hook pour créer une tâche dans ClickUp
 * @param {string} guildId - ID du serveur Discord
 * @param {string} listId - ID de la liste ClickUp où créer la tâche
 * @param {string} taskName - Nom de la tâche à créer
 * @param {string} responsableName - Nom du responsable à assigner (optionnel)
 * @param {number} dueDate - Timestamp de la date d'échéance (optionnel)
 * @param {number} startDate - Timestamp de la date de début (optionnel)
 * @param {string} category - Nom de la catégorie (optionnel)
 * @param {number} priority - Priorité (1=Urgent, 2=High, 3=Normal, 4=Low) (optionnel, défaut: 3)
 * @returns {Promise<object>} - Tâche créée avec son ID et autres informations
 * @throws {Error} - Si la création échoue
 */
export async function useAddTask(guildId, listId, taskName, responsableName = null, dueDate = null, startDate = null, category = null, priority = 3) {
    try {
        const apiKey = await getClickUpApiKey(guildId);
        
        const taskData = {
            name: taskName,
            priority: priority // 1 = Urgent, 2 = High, 3 = Normal, 4 = Low
        };
        
        // Ajouter les dates si fournies (ClickUp attend des timestamps en millisecondes)
        const validTimestamp = (ts) => typeof ts === 'number' && Number.isFinite(ts) && ts > 0;
        if (validTimestamp(dueDate)) {
            taskData.due_date = dueDate;
        }
        if (validTimestamp(startDate)) {
            taskData.start_date = startDate;
        }
        
        // Récupérer une tâche existante pour obtenir les custom fields
        let sampleTask = null;
        try {
            const tasksData = await clickUpRequest(apiKey, `/list/${listId}/task?archived=false&limit=1`);
            if (tasksData.tasks && tasksData.tasks.length > 0) {
                sampleTask = tasksData.tasks[0];
            }
        } catch (error) {
            console.warn('Impossible de récupérer une tâche existante pour les custom fields:', error);
        }
        
        const customFields = [];
        
        // Si un responsable est fourni, récupérer le champ personnalisé et l'assigner
        if (responsableName && sampleTask) {
            try {
                // Récupérer une tâche existante de la liste pour obtenir les custom fields
                // (les custom fields ne sont pas directement dans /list/{listId})
                const tasksData = await clickUpRequest(apiKey, `/list/${listId}/task?archived=false&limit=1`);
                
                if (tasksData.tasks && tasksData.tasks.length > 0) {
                    const sampleTask = tasksData.tasks[0];
                    
                    // Trouver le champ "Responsable" dans les custom fields de la tâche
                    const responsableField = sampleTask.custom_fields?.find(f => {
                        const name = f?.name?.toLowerCase().trim();
                        return name === 'responsable';
                    });
                    
                    if (responsableField && responsableField.type === 'drop_down' && responsableField.type_config?.options) {
                        // Trouver l'index de l'option correspondant au responsable
                        const optionIndex = responsableField.type_config.options.findIndex(opt => 
                            opt.name?.toLowerCase().trim() === responsableName.toLowerCase().trim()
                        );
                        
                        if (optionIndex !== -1) {
                            // Pour les drop_down, utiliser l'index de l'option (comme dans useGetAllTask)
                            customFields.push({
                                id: responsableField.id,
                                value: optionIndex
                            });
                            console.log(`Responsable "${responsableName}" assigné avec l'index ${optionIndex}`);
                        } else {
                            console.warn(`Option "${responsableName}" non trouvée dans le champ Responsable. Options disponibles:`, 
                                responsableField.type_config.options.map(o => o.name));
                        }
                    }
                }
            } catch (error) {
                console.error('Erreur lors de l\'assignation du responsable:', error);
            }
        }
        
        // Si une catégorie est fournie, récupérer le champ personnalisé et l'assigner
        if (category && sampleTask) {
            try {
                const categoryField = sampleTask.custom_fields?.find(f => {
                    const name = f?.name?.toLowerCase().trim();
                    return name === 'catégorie' || name === 'categorie' || name === 'category';
                });
                
                if (categoryField && categoryField.type === 'drop_down' && categoryField.type_config?.options) {
                    const optionIndex = categoryField.type_config.options.findIndex(opt => 
                        opt.name?.toLowerCase().trim() === category.toLowerCase().trim()
                    );
                    
                    if (optionIndex !== -1) {
                        customFields.push({
                            id: categoryField.id,
                            value: optionIndex
                        });
                        console.log(`Catégorie "${category}" assignée avec l'index ${optionIndex}`);
                    } else {
                        console.warn(`Option "${category}" non trouvée dans le champ Catégorie. Options disponibles:`, 
                            categoryField.type_config.options.map(o => o.name));
                    }
                }
            } catch (error) {
                console.error('Erreur lors de l\'assignation de la catégorie:', error);
            }
        }
        
        // Ajouter les custom fields si présents
        if (customFields.length > 0) {
            taskData.custom_fields = customFields;
        }
        
        const createdTask = await clickUpRequest(apiKey, `/list/${listId}/task`, {
            method: 'POST',
            body: taskData
        });
        
        return createdTask;
    } catch (error) {
        console.error('Erreur lors de la création de la tâche:', error);
        throw error;
    }
}
