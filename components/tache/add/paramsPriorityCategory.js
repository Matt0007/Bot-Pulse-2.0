import { EmbedBuilder } from 'discord.js';
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
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Erreur')
                .setDescription('Session expirée. Veuillez recommencer.')
                .setColor(0xFF0000);
            await interaction.update({ embeds: [errorEmbed], components: [] });
            return;
        }
        
        // Afficher immédiatement un message de chargement
        const loadingEmbed = new EmbedBuilder()
            .setTitle('📋 Sélection de la priorité')
            .setDescription('Mise à jour de la priorité...')
            .setColor(0x5865F2);
        
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
        
        // Afficher immédiatement un message de chargement
        const loadingEmbed = new EmbedBuilder()
            .setTitle('📋 Récapitulatif de la tâche')
            .setDescription('Chargement...')
            .setColor(0x5865F2);
        
        await interaction.update({ embeds: [loadingEmbed], components: [] });
        
        // Remettre le récapitulatif à jour
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
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Erreur')
                .setDescription('Session expirée. Veuillez recommencer.')
                .setColor(0xFF0000);
            await interaction.update({ embeds: [errorEmbed], components: [] });
            return;
        }
        
        // Afficher immédiatement un message de chargement
        const loadingEmbed = new EmbedBuilder()
            .setTitle('📋 Sélection de la catégorie')
            .setDescription('Mise à jour de la catégorie...')
            .setColor(0x5865F2);
        
        await interaction.update({ embeds: [loadingEmbed], components: [] });
        
        taskData.category = category;
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
        
        // Afficher immédiatement un message de chargement
        const loadingEmbed = new EmbedBuilder()
            .setTitle('📋 Récapitulatif de la tâche')
            .setDescription('Chargement...')
            .setColor(0x5865F2);
        
        await interaction.update({ embeds: [loadingEmbed], components: [] });
        
        // Remettre le récapitulatif à jour
        await updateRecap(interaction, messageId);
    } catch (error) {
        console.error('Erreur lors du retour au récapitulatif (catégorie):', error);
    }
}
