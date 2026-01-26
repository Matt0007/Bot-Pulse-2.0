import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, UserSelectMenuBuilder, ChannelType } from 'discord.js';
import { useGetAllResponsable } from '../../../hook/clickup/useGetAllResponsable.js';
import prisma from '../../../utils/prisma.js';
import { logAdminAction } from '../../../utils/history.js';
import { createBackButton, createOkButton } from '../../common/buttons.js';
import { createErrorEmbed, createInfoEmbed, createSuccessEmbed, createWarningEmbed } from '../../common/embeds.js';

const tempSelections = new Map();

const handleError = async (interaction, message, customId = 'responsable_button') => {
    await interaction.update({ embeds: [createErrorEmbed(message)], components: [createBackButton(customId)] });
};

export async function responsableAdd(interaction) {
    try {
        const responsables = await useGetAllResponsable(interaction.guild.id);
        
        if (!responsables?.length) {
            return handleError(interaction, 'Aucun responsable trouvé dans ClickUp.\nVérifiez que le champ personnalisé "Responsable" est configuré dans votre workspace ClickUp.');
        }
        
        const dbResponsables = await prisma.guildResponsable.findMany({
            where: { guildId: interaction.guild.id }
        });
        const dbResponsableNames = new Set(dbResponsables.map(r => r.responsableName));
        
        // Afficher tous les responsables
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('responsable_add_select_clickup')
            .setPlaceholder('Sélectionnez un responsable ClickUp')
            .addOptions(responsables.slice(0, 25).map(r => ({
                label: r.length > 100 ? r.substring(0, 97) + '...' : r,
                value: r
            })));
        
        const embed = createInfoEmbed('➕ Ajouter un responsable', '**Étape 1/2** : Sélectionnez un responsable ClickUp dans le menu ci-dessous\n\n*Vous pouvez ajouter des utilisateurs à un channel existant ou créer un nouveau channel.*');
        await interaction.update({ 
            embeds: [embed], 
            components: [
                new ActionRowBuilder().addComponents(selectMenu),
                createBackButton('responsable_button')
            ] 
        });
    } catch (error) {
        console.error('Erreur lors de l\'ajout d\'un responsable:', error);
        await handleError(interaction, error.message || 'Impossible de charger les responsables.');
    }
}

export async function responsableAddSelectClickUp(interaction) {
    try {
        const responsableName = interaction.values[0];
        tempSelections.set(interaction.user.id, { responsableName, step: 1 });
        
        const userSelect = new UserSelectMenuBuilder()
            .setCustomId('responsable_add_select_users')
            .setPlaceholder('Sélectionnez les utilisateurs Discord (multiple)')
            .setMaxValues(25)
            .setMinValues(1)
            .setDisabled(true); // Désactiver temporairement
        
        const embed = createInfoEmbed('➕ Ajouter un responsable', `**Étape 2/2** : Sélectionnez les utilisateurs Discord pour le responsable **${responsableName}**`).addFields({ name: 'Responsable ClickUp sélectionné', value: responsableName, inline: false });
        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('responsable_add_back_step1').setLabel('← Précédent').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('responsable_add_cancel').setLabel('Annuler').setStyle(ButtonStyle.Danger)
        );
        
        const message = await interaction.update({ 
            embeds: [embed], 
            components: [new ActionRowBuilder().addComponents(userSelect), buttons],
            fetchReply: true
        });
        
        // Réactiver le select menu après un court délai
        setTimeout(async () => {
            try {
                const enabledSelect = new UserSelectMenuBuilder()
                    .setCustomId('responsable_add_select_users')
                    .setPlaceholder('Sélectionnez les utilisateurs Discord (multiple)')
                    .setMaxValues(25)
                    .setMinValues(1)
                    .setDisabled(false);
                
                await message.edit({ 
                    embeds: [embed], 
                    components: [new ActionRowBuilder().addComponents(enabledSelect), buttons] 
                });
            } catch (error) {
                console.error('Erreur lors de la réactivation du select menu:', error);
            }
        }, 50);
    } catch (error) {
        console.error('Erreur lors de la sélection du responsable:', error);
        await handleError(interaction, 'Impossible de traiter la sélection.');
    }
}

export async function responsableAddSelectUsers(interaction) {
    try {
        const userId = interaction.user.id;
        const tempData = tempSelections.get(userId);
        
        if (!tempData || tempData.step !== 1) {
            await handleError(interaction, 'Session expirée. Veuillez recommencer.');
            return;
        }
        
        const members = await Promise.all(interaction.values.map(id => interaction.guild.members.fetch(id)));
        const validMembers = members.filter(m => !m.user.bot);
        
        if (!validMembers.length) {
            await handleError(interaction, 'Aucun utilisateur valide sélectionné. Les bots ne peuvent pas être ajoutés.');
            tempSelections.delete(userId);
            return;
        }
        
        tempSelections.set(userId, {
            ...tempData,
            userIds: validMembers.map(m => m.id),
            step: 2
        });
        
        const usersList = validMembers.map(m => `• ${m.displayName || m.user.username}`).join('\n');
        const channelName = `responsable-${tempData.responsableName.toLowerCase().replace(/\s+/g, '-')}`;
        
        // Vérifier si le responsable existe déjà
        const existing = await prisma.guildResponsable.findUnique({
            where: {
                guildId_responsableName: {
                    guildId: interaction.guild.id,
                    responsableName: tempData.responsableName
                }
            },
            include: { users: true }
        });
        
        const embed = createInfoEmbed('📋 Récapitulatif', 'Vérifiez les informations avant de valider')
            .addFields(
                { name: 'Responsable ClickUp', value: tempData.responsableName, inline: false },
                { name: `Utilisateurs Discord (${validMembers.length})`, value: usersList || 'Aucun', inline: false },
                { name: existing ? 'Channel existant' : 'Channel à créer', value: existing ? `<#${existing.channelId}>` : channelName, inline: false }
            )
            .setFooter({ text: existing ? 'Cliquez sur "Valider" pour ajouter les utilisateurs au channel existant' : 'Cliquez sur "Valider" pour créer le channel et sauvegarder' });
        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('responsable_add_validate').setLabel('Valider').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('responsable_add_cancel').setLabel('Annuler').setStyle(ButtonStyle.Danger)
        );
        
        await interaction.update({ embeds: [embed], components: [buttons] });
    } catch (error) {
        console.error('Erreur lors de la sélection des utilisateurs:', error);
        await handleError(interaction, 'Impossible de traiter la sélection.');
        tempSelections.delete(interaction.user.id);
    }
}

export async function responsableAddValidate(interaction) {
    try {
        const userId = interaction.user.id;
        const tempData = tempSelections.get(userId);
        
        if (!tempData || tempData.step !== 2 || !tempData.userIds) {
            await handleError(interaction, 'Session expirée. Veuillez recommencer.');
            tempSelections.delete(userId);
            return;
        }
        
        const { responsableName, userIds } = tempData;
        
        const existing = await prisma.guildResponsable.findUnique({
            where: {
                guildId_responsableName: {
                    guildId: interaction.guild.id,
                    responsableName
                }
            },
            include: { users: true }
        });
        
        let channel;
        let isNewChannel = false;
        
        if (existing) {
            // Ajouter des utilisateurs à un channel existant
            channel = await interaction.guild.channels.fetch(existing.channelId);
            if (!channel) {
                await handleError(interaction, 'Le channel associé n\'existe plus.');
                tempSelections.delete(userId);
                return;
            }
            
            // Filtrer les utilisateurs qui ne sont pas déjà dans le channel
            const existingUserIds = new Set(existing.users.map(u => u.userId));
            const newUserIds = userIds.filter(id => !existingUserIds.has(id));
            
            if (newUserIds.length === 0) {
                const embed = createWarningEmbed('⚠️ Utilisateurs déjà ajoutés', 'Tous les utilisateurs sélectionnés sont déjà dans ce channel.');
                await interaction.update({ embeds: [embed], components: [createOkButton('responsable_button')] });
                tempSelections.delete(userId);
                return;
            }
            
            // Récupérer le rôle admin
            const adminRole = interaction.guild.roles.cache.find(r => r.name === 'Bot Pulse Admin');
            
            // S'assurer que le rôle admin a les permissions
            if (adminRole) {
                await channel.permissionOverwrites.edit(adminRole, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true
                });
            }
            
            // Ajouter les permissions pour les nouveaux utilisateurs
            for (const newUserId of newUserIds) {
                await channel.permissionOverwrites.edit(newUserId, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true
                });
            }
            
            // Ajouter les nouveaux utilisateurs à la base de données
            await prisma.guildResponsableUser.createMany({
                data: newUserIds.map(userId => ({
                    responsableId: existing.id,
                    userId
                })),
                skipDuplicates: true
            });
            
            const members = await Promise.all(newUserIds.map(id => interaction.guild.members.fetch(id)));
            const mentions = members.map(m => `<@${m.id}>`).join(' ');
            
            // Envoyer un message de bienvenue dans le channel
            const welcomeEmbed = createInfoEmbed('👋 Bienvenue !', `${mentions}\n\nVous avez été ajouté(e)(s) au channel du responsable **${responsableName}**.`);
            await channel.send({ embeds: [welcomeEmbed] });
            
            tempSelections.delete(userId);
            const usersList = members.map(m => `• ${m.displayName || m.user.username}`).join('\n');
            
            const userName = interaction.user.displayName || interaction.user.username;
            const usersNames = members.map(m => m.displayName || m.user.username).join(', ');
            await logAdminAction(interaction.guild.id, interaction.user.id, userName, `Ajouter ${usersNames} a responsable ${responsableName}`);
            
            const embed = createSuccessEmbed('✅ Utilisateurs ajoutés', `**${newUserIds.length}** utilisateur(s) ajouté(s) au channel du responsable **${responsableName}**.`)
                .addFields(
                    { name: 'Channel', value: `<#${channel.id}>`, inline: false },
                    { name: `Nouveaux utilisateurs (${members.length})`, value: usersList, inline: false }
                );
            await interaction.update({ embeds: [embed], components: [createOkButton('responsable_button')] });
            return;
        }
        
        // Créer un nouveau channel ou utiliser un existant
        let category = interaction.guild.channels.cache.find(
            c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === 'responsable'
        );
        if (!category) {
            category = await interaction.guild.channels.create({
                name: 'responsable',
                type: ChannelType.GuildCategory,
                reason: `Création de la catégorie pour les responsables par ${interaction.user.tag}`
            });
        }
        
        const channelName = `responsable-${responsableName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
        const existingChannel = interaction.guild.channels.cache.find(
            c => c.type === ChannelType.GuildText && c.name.toLowerCase() === channelName.toLowerCase()
        );
        
        if (existingChannel) {
            const channelInDb = await prisma.guildResponsable.findUnique({ where: { channelId: existingChannel.id } });
            if (channelInDb) {
                const embed = createWarningEmbed('⚠️ Channel déjà utilisé', `Le channel <#${existingChannel.id}> est déjà associé à un autre responsable.`);
                await interaction.update({ embeds: [embed], components: [createOkButton('responsable_button')] });
                tempSelections.delete(userId);
                return;
            }
            channel = existingChannel;
            // S'assurer que le channel existant a les bonnes permissions
            await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: false });
        } else {
            channel = await interaction.guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: category.id,
                reason: `Création du channel pour le responsable ${responsableName} par ${interaction.user.tag}`
            });
        }
        
        // Récupérer le rôle admin
        const adminRole = interaction.guild.roles.cache.find(r => r.name === 'Bot Pulse Admin');
        
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: false });
        
        // Ajouter les permissions pour le rôle admin
        if (adminRole) {
            await channel.permissionOverwrites.edit(adminRole, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            });
        }
        
        for (const userId of userIds) {
            await channel.permissionOverwrites.edit(userId, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            });
        }
        
        await prisma.guildResponsable.create({
            data: {
                guildId: interaction.guild.id,
                responsableName,
                channelId: channel.id,
                users: { create: userIds.map(userId => ({ userId })) }
            }
        });
        
        const members = await Promise.all(userIds.map(id => interaction.guild.members.fetch(id)));
        const mentions = members.map(m => `<@${m.id}>`).join(' ');
        
        // Envoyer un message de bienvenue dans le channel
        const welcomeEmbed = createInfoEmbed('👋 Bienvenue !', `${mentions}\n\nVous avez été ajouté(e)(s) au channel du responsable **${responsableName}**.`);
        await channel.send({ embeds: [welcomeEmbed] });
        
        tempSelections.delete(userId);
        const usersList = members.map(m => `• ${m.displayName || m.user.username}`).join('\n');
        
        const userName = interaction.user.displayName || interaction.user.username;
        const usersNames = members.map(m => m.displayName || m.user.username).join(', ');
        await logAdminAction(interaction.guild.id, interaction.user.id, userName, `Ajouter ${usersNames} a responsable ${responsableName}`);
        
        const embed = createSuccessEmbed('✅ Responsable ajouté', `Le responsable **${responsableName}** a été configuré avec succès.`)
            .addFields(
                { name: existingChannel ? 'Channel utilisé' : 'Channel créé', value: `<#${channel.id}>`, inline: false },
                { name: `Utilisateurs (${members.length})`, value: usersList, inline: false }
            );
        await interaction.update({ embeds: [embed], components: [createOkButton('responsable_button')] });
    } catch (error) {
        console.error('Erreur lors de la validation:', error);
        await handleError(interaction, `Impossible de créer le responsable: ${error.message}`);
        tempSelections.delete(interaction.user.id);
    }
}

export async function responsableAddBackStep1(interaction) {
    tempSelections.delete(interaction.user.id);
    await responsableAdd(interaction);
}

export async function responsableAddCancel(interaction) {
    tempSelections.delete(interaction.user.id);
    const embed = createWarningEmbed('❌ Annulé', 'L\'ajout du responsable a été annulé.');
    await interaction.update({ embeds: [embed], components: [createOkButton('responsable_button')] });
}
