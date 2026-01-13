import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { adminHandlers } from './admin/adminHandlers.js';
import { parametreHandlers } from './parametre/parametreHandlers.js';
import { projetHandlers } from './projet/projetHandlers.js';
import { responsableHandlers } from './responsable/responsableHandlers.js';
import { hourHandlers } from './hour/hourHandlers.js';
import { clickupApiModal } from './parametre/clickup.js';

const buttonHandlers = {
    ...adminHandlers,
    ...parametreHandlers,
    ...projetHandlers,
    ...responsableHandlers,
    ...hourHandlers,
    clickup_api_modal: clickupApiModal,
    back_to_main: async (interaction) => {
        const userName = interaction.user.displayName || interaction.user.username;
        
        const embed = new EmbedBuilder()
            .setTitle('👋 Bienvenue dans le panneau admin')
            .setDescription(`Bonjour ${userName} !\nQue puis-je faire pour vous ?`)
            .setColor(0x5865F2);
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_button')
                    .setLabel('Admin')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('projet_button')
                    .setLabel('Projet')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('responsable_button')
                    .setLabel('Responsable')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('hour_button')
                    .setLabel('Heure')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('parametre_button')
                    .setLabel('Paramètre')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.update({ embeds: [embed], components: [row] });
    }
};

export async function handleButton(interaction) {
    try {
        // Vérifier que l'interaction se fait dans le channel bot-pulse-admin
        if (interaction.channel.name !== 'bot-pulse-admin') {
            if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Cette interaction ne peut être utilisée que dans le channel `bot-pulse-admin`.',
                    ephemeral: true
                });
            }
            return;
        }
        
        const handler = buttonHandlers[interaction.customId];
        if (handler) {
            await handler(interaction);
        } else {
            console.error(`Aucun handler trouvé pour: ${interaction.customId}`);
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
