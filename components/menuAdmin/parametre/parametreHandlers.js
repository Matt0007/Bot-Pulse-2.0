import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { clickupButton, clickupConfigure, clickupResetConfirm, clickupResetCancel } from './clickup.js';

export const parametreHandlers = {
    parametre_button: async (interaction) => {
        const embed = new EmbedBuilder()
            .setTitle('⚙️ Section Paramètre')
            .setDescription('Gestion des paramètres')
            .setColor(0x5865F2);
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('clickup_button')
                    .setLabel('ClickUp API')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('back_to_main')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.update({ embeds: [embed], components: [buttons] });
    },
    clickup_button: clickupButton,
    clickup_configure_button: clickupConfigure,
    clickup_reset_confirm: clickupResetConfirm,
    clickup_reset_cancel: clickupResetCancel
};
