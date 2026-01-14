import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { responsableList } from './List.js';
import { responsableAdd, responsableAddSelectClickUp, responsableAddSelectUsers, responsableAddValidate, responsableAddCancel, responsableAddBackStep1 } from './add.js';
import { responsableRemove, responsableRemoveSelectChannel, responsableRemoveSelectUsers, responsableRemoveValidate, responsableRemoveCancel, responsableRemoveBackStep1 } from './remove.js';

export const responsableHandlers = {
    responsable_button: async (interaction) => {
        const embed = new EmbedBuilder()
            .setTitle('👤 Section Responsable')
            .setDescription('Gestion des responsables')
            .setColor(0x5865F2);
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('responsable_list_button')
                    .setLabel('Liste')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('responsable_add_button')
                    .setLabel('Ajouter')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('responsable_remove_button')
                    .setLabel('Retirer')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('back_to_main')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.update({ embeds: [embed], components: [buttons] });
    },
    responsable_list_button: responsableList,
    responsable_add_button: responsableAdd,
    responsable_add_select_clickup: responsableAddSelectClickUp,
    responsable_add_select_users: responsableAddSelectUsers,
    responsable_add_validate: responsableAddValidate,
    responsable_add_back_step1: responsableAddBackStep1,
    responsable_add_cancel: responsableAddCancel,
    responsable_remove_button: responsableRemove,
    responsable_remove_select_channel: responsableRemoveSelectChannel,
    responsable_remove_select_users: responsableRemoveSelectUsers,
    responsable_remove_validate: responsableRemoveValidate,
    responsable_remove_back_step1: responsableRemoveBackStep1,
    responsable_remove_cancel: responsableRemoveCancel,
};
