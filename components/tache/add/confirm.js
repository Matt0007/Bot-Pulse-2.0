import { EmbedBuilder } from 'discord.js';
import prisma from '../../../utils/prisma.js';
import { logAdminAction } from '../../../utils/history.js';
import { useAddTask } from '../../../hook/clickup/useAddTask.js';
import { taskDataCache, buildRecapDescription } from '../add.js';

/**
 * Confirme et crée la tâche après validation
 */
export async function tacheAddConfirm(interaction) {
    try {
        const guildId = interaction.guild.id;
        const customId = interaction.customId;
        
        // Extraire messageId depuis le customId
        // Format: tache_add_confirm_{messageId}
        const messageId = customId.replace('tache_add_confirm_', '');
        
        // Récupérer les données depuis le cache
        const taskData = taskDataCache.get(messageId);
        if (!taskData) {
            await interaction.update({
                embeds: [new EmbedBuilder()
                    .setTitle('❌ Erreur')
                    .setDescription('Session expirée. Veuillez recommencer.')
                    .setColor(0xFF0000)
                ],
                components: []
            });
            return;
        }
        
        // Utiliser les valeurs du cache pour l'emplacement
        const listId = taskData.listId;
        const listName = taskData.listName || 'Liste inconnue';
        const projectName = taskData.projectName || 'Projet inconnu';
        
        if (!listId) {
            await interaction.update({
                embeds: [new EmbedBuilder()
                    .setTitle('❌ Erreur')
                    .setDescription('Aucune liste sélectionnée.')
                    .setColor(0xFF0000)
                ],
                components: []
            });
            return;
        }
        
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
        
        // Enregistrer dans l'historique admin
        const userName = interaction.user.displayName || interaction.user.username;
        const responsableInfo = taskData.responsableName ? ` (Responsable: ${taskData.responsableName})` : '';
        await logAdminAction(guildId, interaction.user.id, userName, `Ajouter tâche "${taskData.taskName}" dans ${listName} (${projectName})${responsableInfo}`);
        
        // Récupérer le responsable pour la description
        const responsable = await prisma.guildResponsable.findUnique({
            where: { channelId: interaction.channel.id }
        });
        const responsableInfoText = responsable 
            ? `\n**Responsable :** ${responsable.responsableName}`
            : '';
        
        // Utiliser la même fonction que le récapitulatif pour construire la description
        const successDescription = buildRecapDescription(taskData, projectName, listName, responsableInfoText);
        
        const successEmbed = new EmbedBuilder()
            .setTitle('✅ Tâche créée avec succès')
            .setDescription(successDescription)
            .setColor(0x00FF00);
        
        // Nettoyer le cache
        taskDataCache.delete(messageId);
        
        await interaction.update({ embeds: [successEmbed], components: [] });
    } catch (error) {
        console.error('Erreur lors de la création de la tâche:', error);
        
        const errorMessage = error.message?.includes('API ClickUp') 
            ? error.message 
            : 'Impossible de créer la tâche dans ClickUp.';
        
        await interaction.update({
            embeds: [new EmbedBuilder()
                .setTitle('❌ Erreur')
                .setDescription(errorMessage)
                .setColor(0xFF0000)
            ],
            components: []
        });
    }
}
