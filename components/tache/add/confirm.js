import prisma from '../../../utils/prisma.js';
import { useAddTask } from '../../../hook/clickup/useAddTask.js';
import { createErrorEmbed, createInfoEmbed, createSuccessEmbed } from '../../common/embeds.js';
import { taskDataCache, buildRecapDescription } from '../add.js';

/**
 * Confirme et crée la tâche après validation
 */
export async function tacheAddConfirm(interaction) {
    try {
        // Différer l'interaction immédiatement pour éviter l'expiration pendant le traitement
        await interaction.deferUpdate();
        
        const guildId = interaction.guild.id;
        const customId = interaction.customId;
        
        // Extraire messageId depuis le customId
        // Format: tache_add_confirm_{messageId}
        const messageId = customId.replace('tache_add_confirm_', '');
        
        // Récupérer les données depuis le cache
        const taskData = taskDataCache.get(messageId);
        if (!taskData) {
            await interaction.editReply({ embeds: [createErrorEmbed('Session expirée. Veuillez recommencer.')], components: [] });
            return;
        }
        
        // Utiliser les valeurs du cache pour l'emplacement 
        const listId = taskData.listId;
        const listName = taskData.listName || 'Liste inconnue';
        const projectName = taskData.projectName || 'Projet inconnu';
        
        if (!listId) {
            await interaction.editReply({ embeds: [createErrorEmbed('Aucune liste sélectionnée.')], components: [] });
            return;
        }
        
        await interaction.editReply({ embeds: [createInfoEmbed('⏳ Création de la tâche...', 'Veuillez patienter pendant la création de la tâche dans ClickUp.')], components: [] });
        
        // Créer la tâche dans ClickUp avec tous les paramètres
        await useAddTask(
            guildId,
            listId,
            taskData.taskName,
            taskData.responsableName,
            taskData.dueDate,
            taskData.startDate,
            taskData.category,
            taskData.priority
        );
        
        // Récupérer le responsable pour la description
        const responsable = await prisma.guildResponsable.findUnique({
            where: { channelId: interaction.channel.id }
        });
        const responsableInfoText = responsable 
            ? `\n**Responsable :** ${responsable.responsableName}`
            : '';
        
        // Utiliser la même fonction que le récapitulatif pour construire la description
        const successDescription = buildRecapDescription(taskData, projectName, listName, responsableInfoText);
        
        const successEmbed = createSuccessEmbed('✅ Tâche créée avec succès', successDescription);
        // Nettoyer le cache
        taskDataCache.delete(messageId);
        
        await interaction.editReply({ embeds: [successEmbed], components: [] });
    } catch (error) {
        console.error('Erreur lors de la création de la tâche:', error);
        
        const errorMessage = error.message?.includes('API ClickUp') 
            ? error.message 
            : 'Impossible de créer la tâche dans ClickUp.';
        
        // Utiliser editReply puisque l'interaction a été différée

        await interaction.editReply({ embeds: [createErrorEmbed(errorMessage)], components: [] });
    }
}
