import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createInfoEmbed } from '../../common/embeds.js';
import { clickupButton, clickupConfigure, clickupResetConfirm, clickupResetCancel } from './clickup.js';
import { helpButton } from './help.js';
import { historyButton } from './history.js';
export const parametreHandlers = {
    parametre_button: async (interaction) => {
        const embed = createInfoEmbed('⚙️ Section Paramètre', 'Gestion des paramètres')
            .setFooter({ text: 'v2.6.1' }); 
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('clickup_button')
                    .setLabel('ClickUp API')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('history_button')
                    .setLabel('Historique')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('help_button')
                    .setLabel('Help')
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
    clickup_reset_cancel: clickupResetCancel,
    history_button: historyButton,
    help_button: helpButton
};
