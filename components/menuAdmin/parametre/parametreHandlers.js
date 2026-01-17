import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { clickupButton, clickupConfigure, clickupResetConfirm, clickupResetCancel } from './clickup.js';
import { helpButton } from './help.js';
import { historyButton } from './history.js';
import { listSelectionButton, listSelectionModify, listSelectionProjectSelect, listSelectionListSelect } from './listSelection.js';

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
                    .setCustomId('list_selection_button')
                    .setLabel('Liste d\'ajout')
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
    list_selection_button: listSelectionButton,
    list_selection_modify: listSelectionModify,
    list_selection_project_select: listSelectionProjectSelect,
    list_selection_list_select: listSelectionListSelect,
    history_button: historyButton,
    help_button: helpButton
};
