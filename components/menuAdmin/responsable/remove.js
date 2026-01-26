import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType } from 'discord.js';
import prisma from '../../../utils/prisma.js';
import { logAdminAction } from '../../../utils/history.js';
import { createBackButton, createOkButton } from '../../common/buttons.js';
import { createErrorEmbed, createInfoEmbed, createSuccessEmbed, createWarningEmbed } from '../../common/embeds.js';

const tempSelections = new Map();

const handleError = async (interaction, message, customId = 'responsable_button') => {
    await interaction.update({ embeds: [createErrorEmbed(message)], components: [createBackButton(customId)] });
};

export async function responsableRemove(interaction) {
    try {
        // Récupérer les responsables configurés dans la BDD
        const responsables = await prisma.guildResponsable.findMany({
            where: { guildId: interaction.guild.id },
            include: {
                users: true
            },
            orderBy: {
                responsableName: 'asc'
            }
        });
        
        if (!responsables?.length) {
            await interaction.update({ embeds: [createWarningEmbed('➖ Retirer des utilisateurs', 'Aucun responsable configuré.')], components: [createOkButton('responsable_button')] });
            return;
        }
        
        // Créer le select menu avec les channels responsables
        const selectOptions = responsables.slice(0, 25).map(responsable => ({
            label: responsable.responsableName.length > 100 
                ? responsable.responsableName.substring(0, 97) + '...' 
                : responsable.responsableName,
            value: responsable.id,
            description: `${responsable.users.length} utilisateur(s)`
        }));
        
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('responsable_remove_select_channel')
            .setPlaceholder('Sélectionnez un channel responsable')
            .addOptions(selectOptions);
        
        const embed = createInfoEmbed('➖ Retirer des utilisateurs', '**Étape 1/2** : Sélectionnez un channel responsable dans le menu ci-dessous');
        await interaction.update({ 
            embeds: [embed], 
            components: [
                new ActionRowBuilder().addComponents(selectMenu),
                createBackButton('responsable_button')
            ] 
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des responsables:', error);
        await handleError(interaction, error.message || 'Impossible de charger les responsables.');
    }
}

export async function responsableRemoveSelectChannel(interaction) {
    try {
        const responsableId = interaction.values[0];
        
        // Récupérer le responsable avec ses utilisateurs
        const responsable = await prisma.guildResponsable.findUnique({
            where: { id: responsableId },
            include: { users: true }
        });
        
        if (!responsable) {
            await handleError(interaction, 'Responsable non trouvé.');
            return;
        }
        
        if (!responsable.users?.length) {
            await interaction.update({ embeds: [createWarningEmbed('⚠️ Aucun utilisateur', `Le channel responsable "${responsable.responsableName}" n'a aucun utilisateur à retirer.`)], components: [createOkButton('responsable_button')] });
            return;
        }
        
        // Récupérer les membres pour le select
        const members = await Promise.all(
            responsable.users.map(u => interaction.guild.members.fetch(u.userId).catch(() => null))
        );
        const validMembers = members.filter(m => m !== null);
        
        if (!validMembers.length) {
            await interaction.update({ embeds: [createWarningEmbed('⚠️ Utilisateurs introuvables', 'Les utilisateurs associés ne sont plus sur le serveur.')], components: [createOkButton('responsable_button')] });
            return;
        }
        
        // Stocker temporairement la sélection
        const validUserIds = validMembers.map(m => m.id);
        tempSelections.set(interaction.user.id, { 
            responsableId, 
            channelId: responsable.channelId,
            responsableName: responsable.responsableName,
            validUserIds,
            step: 1 
        });
        
        // Créer le StringSelectMenu avec uniquement les utilisateurs du channel
        const userSelect = new StringSelectMenuBuilder()
            .setCustomId('responsable_remove_select_users')
            .setPlaceholder('Sélectionnez les utilisateurs à retirer (multiple)')
            .setMaxValues(Math.min(validMembers.length, 25))
            .setMinValues(1)
            .addOptions(validMembers.slice(0, 25).map(member => ({
                label: (member.displayName || member.user.username).length > 100 
                    ? (member.displayName || member.user.username).substring(0, 97) + '...' 
                    : (member.displayName || member.user.username),
                value: member.id
            })));
        
        const embed = createInfoEmbed('➖ Retirer des utilisateurs', `**Étape 2/2** : Sélectionnez les utilisateurs à retirer du channel **${responsable.responsableName}**`)
            .addFields(
                { name: 'Channel responsable', value: `<#${responsable.channelId}>`, inline: false },
                { name: 'Utilisateurs actuels', value: `${responsable.users.length} utilisateur(s)`, inline: false }
            );
        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('responsable_remove_back_step1').setLabel('← Précédent').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('responsable_remove_cancel').setLabel('Annuler').setStyle(ButtonStyle.Danger)
        );
        
        await interaction.update({ 
            embeds: [embed], 
            components: [new ActionRowBuilder().addComponents(userSelect), buttons] 
        });
    } catch (error) {
        console.error('Erreur lors de la sélection du channel:', error);
        await handleError(interaction, 'Impossible de traiter la sélection.');
    }
}

export async function responsableRemoveSelectUsers(interaction) {
    try {
        const userId = interaction.user.id;
        const tempData = tempSelections.get(userId);
        
        if (!tempData || tempData.step !== 1) {
            await handleError(interaction, 'Session expirée. Veuillez recommencer.');
            return;
        }
        
        const selectedUserIds = interaction.values;
        const validUserIds = tempData.validUserIds || [];
        const filteredUserIds = selectedUserIds.filter(id => validUserIds.includes(id));
        
        if (filteredUserIds.length !== selectedUserIds.length) {
            await handleError(interaction, `Certains utilisateurs sélectionnés ne sont pas dans le channel. Veuillez sélectionner uniquement les utilisateurs du channel **${tempData.responsableName}**.`);
            return;
        }
        
        if (!filteredUserIds.length) {
            await handleError(interaction, 'Aucun utilisateur valide sélectionné.');
            tempSelections.delete(userId);
            return;
        }
        
        const members = await Promise.all(
            filteredUserIds.map(id => interaction.guild.members.fetch(id).catch(() => null))
        );
        const validMembers = members.filter(m => m !== null);
        
        if (!validMembers.length) {
            await handleError(interaction, 'Aucun utilisateur valide sélectionné.');
            tempSelections.delete(userId);
            return;
        }
        
        // Mettre à jour les données temporaires
        tempSelections.set(userId, {
            ...tempData,
            userIdsToRemove: validMembers.map(m => m.id),
            step: 2
        });
        
        // Créer le récapitulatif
        const usersList = validMembers.map(m => `• ${m.displayName || m.user.username}`).join('\n');
        
        const embed = createInfoEmbed('📋 Récapitulatif', 'Vérifiez les informations avant de valider')
            .addFields(
                { name: 'Channel responsable', value: `<#${tempData.channelId}>`, inline: false },
                { name: 'Responsable', value: tempData.responsableName, inline: false },
                { name: `Utilisateurs à retirer (${validMembers.length})`, value: usersList || 'Aucun', inline: false }
            )
            .setFooter({ text: 'Cliquez sur "Valider" pour retirer les utilisateurs' });
        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('responsable_remove_validate').setLabel('Valider').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('responsable_remove_cancel').setLabel('Annuler').setStyle(ButtonStyle.Danger)
        );
        
        await interaction.update({ embeds: [embed], components: [buttons] });
    } catch (error) {
        console.error('Erreur lors de la sélection des utilisateurs:', error);
        await handleError(interaction, 'Impossible de traiter la sélection.');
        tempSelections.delete(interaction.user.id);
    }
}

export async function responsableRemoveValidate(interaction) {
    try {
        const userId = interaction.user.id;
        const tempData = tempSelections.get(userId);
        
        if (!tempData || tempData.step !== 2 || !tempData.userIdsToRemove) {
            await handleError(interaction, 'Session expirée. Veuillez recommencer.');
            tempSelections.delete(userId);
            return;
        }
        
        const { responsableId, channelId, responsableName, userIdsToRemove } = tempData;
        
        // Récupérer le responsable actuel
        const responsable = await prisma.guildResponsable.findUnique({
            where: { id: responsableId },
            include: { users: true }
        });
        
        if (!responsable) {
            await handleError(interaction, 'Responsable non trouvé.');
            tempSelections.delete(userId);
            return;
        }
        
        // Supprimer les utilisateurs de la BDD
        await prisma.guildResponsableUser.deleteMany({
            where: {
                responsableId,
                userId: { in: userIdsToRemove }
            }
        });
        
        // Retirer les permissions du channel pour les utilisateurs
        const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
        if (channel) {
            for (const userId of userIdsToRemove) {
                try {
                    await channel.permissionOverwrites.delete(userId);
                } catch (error) {
                    console.error(`Erreur lors de la suppression des permissions pour ${userId}:`, error);
                }
            }
        }
        
        // Vérifier s'il reste des utilisateurs
        const remainingUsers = await prisma.guildResponsableUser.findMany({
            where: { responsableId }
        });
        
        let channelDeleted = false;
        let categoryDeleted = false;
        
        // Si plus personne dans le channel, le supprimer
        if (!remainingUsers.length) {
            if (channel) {
                try {
                    await channel.delete(`Suppression automatique : plus d'utilisateurs dans le channel responsable ${responsableName}`);
                    channelDeleted = true;
                } catch (error) {
                    console.error('Erreur lors de la suppression du channel:', error);
                }
            }
            
            // Supprimer le responsable de la BDD
            await prisma.guildResponsable.delete({
                where: { id: responsableId }
            });
            
            // Vérifier s'il reste des channels dans la catégorie "responsable"
            const category = interaction.guild.channels.cache.find(
                c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === 'responsable'
            );
            
            if (category) {
                const channelsInCategory = category.children.cache.size;
                if (channelsInCategory === 0) {
                    try {
                        await category.delete(`Suppression automatique : plus de channels dans la catégorie responsable`);
                        categoryDeleted = true;
                    } catch (error) {
                        console.error('Erreur lors de la suppression de la catégorie:', error);
                    }
                }
            }
        }
        
        tempSelections.delete(userId);
        
        // Récupérer les membres pour l'affichage
        const members = await Promise.all(
            userIdsToRemove.map(id => interaction.guild.members.fetch(id).catch(() => null))
        );
        const validMembers = members.filter(m => m !== null);
        const usersList = validMembers.map(m => `• ${m.displayName || m.user.username}`).join('\n');
        
        const userName = interaction.user.displayName || interaction.user.username;
        const usersNames = validMembers.map(m => m.displayName || m.user.username).join(', ');
        await logAdminAction(interaction.guild.id, interaction.user.id, userName, `Retirer ${usersNames} de responsable ${responsableName}`);
        
        let description = `Les utilisateurs ont été retirés du channel **${responsableName}**.`;
        if (channelDeleted) {
            description += `\n\nLe channel a été supprimé car il ne contenait plus d'utilisateurs.`;
        }
        if (categoryDeleted) {
            description += `\n\nLa catégorie "responsable" a été supprimée car elle ne contenait plus de channels.`;
        }
        
        const embed = createSuccessEmbed('✅ Utilisateurs retirés', description)
            .addFields({ name: `Utilisateurs retirés (${validMembers.length})`, value: usersList || 'Aucun', inline: false });
        await interaction.update({ embeds: [embed], components: [createOkButton('responsable_button')] });
    } catch (error) {
        console.error('Erreur lors de la validation:', error);
        await handleError(interaction, `Impossible de retirer les utilisateurs: ${error.message}`);
        tempSelections.delete(interaction.user.id);
    }
}

export async function responsableRemoveBackStep1(interaction) {
    tempSelections.delete(interaction.user.id);
    await responsableRemove(interaction);
}

export async function responsableRemoveCancel(interaction) {
    tempSelections.delete(interaction.user.id);
    const embed = createWarningEmbed('❌ Annulé', 'La suppression des utilisateurs a été annulée.');
    await interaction.update({ embeds: [embed], components: [createOkButton('responsable_button')] });
}
