import { getClickUpApiKey, clickUpRequest } from '../../utils/clickup.js';

const CATEGORY_FIELD_NAMES = ['catégorie', 'categorie', 'category'];

/**
 * Trouve le champ custom "catégorie" sur une tâche
 * @param {object} task - Tâche ClickUp
 * @returns {object|undefined} - Le champ custom ou undefined
 */
function getCategoryField(task) {
    return task.custom_fields?.find(f => {
        const name = f?.name?.toLowerCase().trim();
        return CATEGORY_FIELD_NAMES.includes(name);
    });
}

/**
 * Récupère le nom de catégorie à partir du champ et de sa valeur
 * @param {object} categoryField - Champ custom catégorie
 * @returns {string|null} - Nom de la catégorie ou null
 */
function getCategoryNameFromField(categoryField) {
    if (!categoryField || categoryField.type !== 'drop_down') return null;
    const options = categoryField.type_config?.options;
    if (!options || !Array.isArray(options)) return null;
    const value = categoryField.value;
    if (value === undefined || value === null) return null;
    const option = options[value];
    return option?.name ?? null;
}

/**
 * Hook pour récupérer les catégories effectivement utilisées dans une liste ClickUp
 * (valeurs du champ catégorie sur les tâches existantes)
 * @param {string} guildId - ID du serveur Discord
 * @param {string} listId - ID de la liste ClickUp
 * @returns {Promise<{ categoriesUsed: string[], hasCategory: (name: string) => boolean }>}
 */
export async function useGetCategoriesInList(guildId, listId) {
    const categoriesUsed = new Set();
    let apiKey;

    try {
        apiKey = await getClickUpApiKey(guildId);
    } catch (err) {
        console.error('useGetCategoriesInList: clé API non disponible', err);
        return { categoriesUsed: [], hasCategory: () => false };
    }

    let page = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
        try {
            const tasksData = await clickUpRequest(
                apiKey,
                `/list/${listId}/task?archived=false&limit=${limit}&page=${page}`
            );
            const tasks = tasksData.tasks || [];
            if (tasks.length === 0) break;

            for (const task of tasks) {
                const categoryField = getCategoryField(task);
                const name = getCategoryNameFromField(categoryField);
                if (name) categoriesUsed.add(name);
            }

            hasMore = tasks.length === limit;
            page += 1;
        } catch (error) {
            console.error(`useGetCategoriesInList: erreur liste ${listId}`, error);
            break;
        }
    }

    const list = Array.from(categoriesUsed);
    return {
        categoriesUsed: list,
        hasCategory(name) {
            if (!name || typeof name !== 'string') return false;
            return list.some(c => c.trim().toLowerCase() === name.trim().toLowerCase());
        }
    };
}
