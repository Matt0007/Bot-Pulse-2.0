import { adminHandlers } from './admin/adminHandlers.js';
import { parametreHandlers } from './parametre/parametreHandlers.js';
import { projetHandlers } from './projet/projetHandlers.js';
import { responsableHandlers } from './responsable/responsableHandlers.js';
import { hourHandlers } from './hour/hourHandlers.js';
import { clickupApiModal } from './parametre/clickup.js';
import { historyPagination } from './parametre/history.js';
import { AdminMenuButton } from '../../commands/admin.js';

const buttonHandlers = {
    ...adminHandlers,
    ...parametreHandlers,
    ...projetHandlers,
    ...responsableHandlers,
    ...hourHandlers,
    clickup_api_modal: clickupApiModal,
    back_to_main: async (interaction) => {
        const userName = interaction.user.displayName || interaction.user.username;
        const { embed, row } = AdminMenuButton(userName);
        await interaction.update({ embeds: [embed], components: [row] });
    }
};

export async function handleButton(interaction) {
    try {
        // Vérifier que l'interaction se fait dans le channel bot-pulse
        if (interaction.channel.name !== 'bot-pulse') {
            if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Cette interaction ne peut être utilisée que dans le channel `bot-pulse`.',
                    ephemeral: true
                });
            }
            return;
        }
        
        // Gérer la pagination de l'historique
        if (interaction.customId === 'history_page_prev' || interaction.customId === 'history_page_next') {
            await historyPagination(interaction);
            return;
        }
        
        const handler = buttonHandlers[interaction.customId];
        if (handler) {
            await handler(interaction);
        } else {
            console.error(`Aucun handler trouvé pour: ${interaction.customId}`);
            if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Cette action n\'est pas reconnue.', ephemeral: true });
            }
        }
    } catch (error) {
        console.error('Erreur lors du traitement de l\'interaction:', error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
                content: '❌ Erreur lors du traitement!', 
                ephemeral: true 
            });
        }
    }
}
