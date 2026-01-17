import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getValidCache, replySessionExpired } from './cache.js';

/**
 * Gère la sélection d'une tâche depuis le menu select
 */
export async function handleTacheSelect(interaction) {
    try {
        const userId = interaction.user.id;
        const cachedData = getValidCache(userId);

        if (!cachedData) {
            await replySessionExpired(interaction);
            return;
        }

        const { tasks } = cachedData;
        const selectedIndex = parseInt(interaction.values[0]);
        const selectedTask = tasks[selectedIndex];

        if (!selectedTask) {
            await interaction.reply({
                content: '❌ Tâche non trouvée.',
                ephemeral: true
            });
            return;
        }

        const statutEmoji = selectedTask.statut === 'En cours' ? '🟦' : selectedTask.statut === 'Achevée' ? '✅' : '⬜';
        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`tache-status-${selectedIndex}-a-faire`).setLabel('À faire').setStyle(ButtonStyle.Secondary).setDisabled(selectedTask.statut === 'À faire'),
            new ButtonBuilder().setCustomId(`tache-status-${selectedIndex}-en-cours`).setLabel('En cours').setStyle(ButtonStyle.Primary).setDisabled(selectedTask.statut === 'En cours'),
            new ButtonBuilder().setCustomId(`tache-status-${selectedIndex}-acheve`).setLabel('Achevée').setStyle(ButtonStyle.Success).setDisabled(false)
        );

        await interaction.reply({
            embeds: [new EmbedBuilder().setTitle(`📋 **${selectedTask.nom}**`).setDescription(`${statutEmoji} **Statut :** ${selectedTask.statut}`).setColor(0x5865F2)],
            components: [buttons]
        });

    } catch (error) {
        console.error('Erreur lors de la sélection de la tâche:', error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ Erreur lors de la sélection. Veuillez réessayer.',
                ephemeral: true
            });
        }
    }
}
