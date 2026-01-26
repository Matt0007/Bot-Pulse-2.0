import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import prisma from '../../../utils/prisma.js';
import { createBackButton } from '../../common/buttons.js';
import { createErrorEmbed, createInfoEmbed, createWarningEmbed } from '../../common/embeds.js';
import { responsableAdd, responsableAddSelectClickUp, responsableAddSelectUsers, responsableAddValidate, responsableAddCancel, responsableAddBackStep1 } from './add.js';
import { responsableRemove, responsableRemoveSelectChannel, responsableRemoveSelectUsers, responsableRemoveValidate, responsableRemoveCancel, responsableRemoveBackStep1 } from './remove.js';

export const responsableHandlers = {
    responsable_button: async (interaction) => {
        try {
            const responsables = await prisma.guildResponsable.findMany({
                where: { guildId: interaction.guild.id },
                include: { users: true },
                orderBy: { responsableName: 'asc' }
            });
            let embed;
            if (!responsables || responsables.length === 0) {
                embed = createWarningEmbed('👤 Section Responsable', 'Aucun responsable configuré.\nUtilisez le bouton "Ajouter" pour configurer un responsable.');
            } else {
                const responsableListPromises = responsables.map(async (responsable, index) => {
                    const channelMention = `<#${responsable.channelId}>`;
                    const userCount = responsable.users.length;
                    let usersText = 'Aucun utilisateur';
                    if (userCount > 0) {
                        const members = [];
                        for (const user of responsable.users) {
                            try {
                                const member = await interaction.guild.members.fetch(user.userId);
                                members.push(member.displayName || member.user.username);
                            } catch (error) {
                                members.push(`<@${user.userId}> (hors serveur)`);
                            }
                        }
                        const usersList = members.map(name => `   _-_ ${name}`).join('\n');
                        usersText = `${userCount} utilisateur(s) :\n${usersList}`;
                    }
                    return `**${index + 1}.** **${responsable.responsableName}**\n   └ Channel : ${channelMention}\n    ${usersText}`;
                });
                
                const responsableList = await Promise.all(responsableListPromises);
                embed = createInfoEmbed('👤 Section Responsable', responsableList.join('\n\n')).setFooter({ text: `Total: ${responsables.length} responsable(s) configuré(s)` });
            }
            
            const buttons = new ActionRowBuilder()
                .addComponents(
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
        } catch (error) {
            console.error('Erreur lors de la récupération des responsables:', error);
            await interaction.update({ embeds: [createErrorEmbed(error.message || 'Impossible de récupérer les responsables depuis la base de données.')], components: [createBackButton('back_to_main')] });
        }
    },
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
