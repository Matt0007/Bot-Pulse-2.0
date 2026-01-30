import { createErrorEmbed, createInfoEmbed } from '../../common/embeds.js';
import { taskDataCache, updateRecap } from '../add.js';

/**
 * Gère la sélection de la priorité
 */
export async function tacheAddPrioritySelect(interaction) {
    try {
        const customId = interaction.customId;
        const messageId = customId.replace('tache_add_priority_select_', '');
        const priority = parseInt(interaction.values[0]);
        
        const taskData = taskDataCache.get(messageId);
        if (!taskData) {
            await interaction.update({ embeds: [createErrorEmbed('Session expirée. Veuillez recommencer.')], components: [] });
            return;
        }
        const loadingEmbed = createInfoEmbed('📋 Sélection de la priorité', 'Mise à jour de la priorité...');
        await interaction.update({ embeds: [loadingEmbed], components: [] });
        
        taskData.priority = priority;
        taskDataCache.set(messageId, taskData);
        
        // Remettre le récapitulatif à jour
        await updateRecap(interaction, messageId);
    } catch (error) {
        console.error('Erreur lors de la sélection de la priorité:', error);
    }
}

/**
 * Gère le bouton "Précédent" pour la priorité
 */
export async function tacheAddPriorityBack(interaction) {
    try {
        const customId = interaction.customId;
        const messageId = customId.replace('tache_add_priority_back_', '');
        
        const loadingEmbed = createInfoEmbed('📋 Récapitulatif de la tâche', 'Chargement...');
        await interaction.update({ embeds: [loadingEmbed], components: [] });
        await updateRecap(interaction, messageId);
    } catch (error) {
        console.error('Erreur lors du retour au récapitulatif (priorité):', error);
    }
}

/**
 * Gère la sélection de la catégorie
 */
export async function tacheAddCategorySelect(interaction) {
    try {
        const customId = interaction.customId;
        const messageId = customId.replace('tache_add_category_select_', '');
        const category = interaction.values[0];
        
        const taskData = taskDataCache.get(messageId);
        if (!taskData) {
            await interaction.update({ embeds: [createErrorEmbed('Session expirée. Veuillez recommencer.')], components: [] });
            return;
        }
        const loadingEmbed = createInfoEmbed('📋 Sélection de la catégorie', 'Mise à jour de la catégorie...');
        await interaction.update({ embeds: [loadingEmbed], components: [] });
        taskData.category = category;
        taskData.initialCategoryStep = false;
        taskDataCache.set(messageId, taskData);
        
        // Remettre le récapitulatif à jour
        await updateRecap(interaction, messageId);
    } catch (error) {
        console.error('Erreur lors de la sélection de la catégorie:', error);
    }
}

/**
 * Gère le bouton "Précédent" pour la catégorie
 */
export async function tacheAddCategoryBack(interaction) {
    try {
        const customId = interaction.customId;
        const messageId = customId.replace('tache_add_category_back_', '');
        
        const loadingEmbed = createInfoEmbed('📋 Récapitulatif de la tâche', 'Chargement...');
        await interaction.update({ embeds: [loadingEmbed], components: [] });
        await updateRecap(interaction, messageId);
    } catch (error) {
        console.error('Erreur lors du retour au récapitulatif (catégorie):', error);
    }
}
