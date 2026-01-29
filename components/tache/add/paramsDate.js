import { taskDataCache, updateRecap } from '../add.js';

/**
 * Gère la soumission du modal de date
 */
export async function tacheAddDateModal(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });
        
        const customId = interaction.customId;
        // Format: tache_add_date_modal_{messageId}_{start_date|due_date}
        // Le messageId peut contenir des underscores, donc on doit extraire différemment
        const prefix = 'tache_add_date_modal_';
        const afterPrefix = customId.replace(prefix, '');
        
        // Chercher '_start_date' ou '_due_date' à la fin
        let messageId, dateType;
        if (afterPrefix.endsWith('_start_date')) {
            dateType = 'start_date';
            messageId = afterPrefix.replace('_start_date', '');
        } else if (afterPrefix.endsWith('_due_date')) {
            dateType = 'due_date';
            messageId = afterPrefix.replace('_due_date', '');
        } else {
            console.error('Format de customId invalide pour le modal de date:', customId);
            await interaction.editReply({ content: '❌ Erreur: format invalide.' });
            return;
        }
        
        const dateValue = interaction.fields.getTextInputValue('date_value').trim();
        
        // Récupérer les données du cache d'abord pour vérifier
        const taskData = taskDataCache.get(messageId);
        if (!taskData || !taskData.messageId) {
            console.error('TaskData non trouvé ou messageId manquant:', { messageId, taskData, allKeys: Array.from(taskDataCache.keys()) });
            await interaction.editReply({ content: '❌ Session expirée. Veuillez recommencer.' });
            return;
        }
        
        // Parser la date (format JJ/MM/AAAA)
        const dateParts = dateValue.split('/');
        if (dateParts.length !== 3) {
            await interaction.editReply({ content: '❌ Format de date invalide. Utilisez JJ/MM/AAAA' });
            return;
        }
        
        const day = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1; // Les mois commencent à 0
        const year = parseInt(dateParts[2], 10);

        // Minuit UTC pour ce jour : même date partout (Paris, Indonésie, etc.)
        const timestamp = Date.UTC(year, month, day, 0, 0, 0, 0);
        if (Number.isNaN(timestamp) || timestamp < 0) {
            await interaction.editReply({ content: '❌ Date invalide' });
            return;
        }
        
        // S'assurer qu'on ne perd pas les autres données
        const updatedTaskData = {
            ...taskData,
            [dateType === 'start_date' ? 'startDate' : 'dueDate']: timestamp
        };
        
        taskDataCache.set(messageId, updatedTaskData);
        
        // Mettre à jour le récapitulatif
        try {
            await updateRecap(interaction, messageId);
            // Ne pas afficher de message de succès, juste fermer le modal
            await interaction.deleteReply();
        } catch (error) {
            console.error('Erreur lors de la mise à jour du récapitulatif:', error);
            await interaction.editReply({ content: '❌ Erreur lors de la mise à jour du récapitulatif' });
        }
    } catch (error) {
        console.error('Erreur lors de la définition de la date:', error);
    }
}
