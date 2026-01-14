import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, UserSelectMenuBuilder, ChannelType } from 'discord.js';
import { useGetAllResponsable } from '../../../hook/clickup/useGetAllResponsable.js';
import prisma from '../../../utils/prisma.js';

const tempSelections = new Map();

// Fonctions utilitaires
const createBackButton = (customId = 'responsable_button') => 
    new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(customId).setLabel('Retour').setStyle(ButtonStyle.Secondary)
    );

const createErrorEmbed = (message) => 
    new EmbedBuilder().setTitle('❌ Erreur').setDescription(message).setColor(0xFF0000);

const handleError = async (interaction, message, customId = 'responsable_button') => {
    await interaction.update({ 
        embeds: [createErrorEmbed(message)], 
        components: [createBackButton(customId)] 
    });
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
        const availableResponsables = responsables.filter(r => !dbResponsableNames.has(r));
        
        if (!availableResponsables.length) {
            const embed = new EmbedBuilder()
                .setTitle('✅ Tous les responsables ajoutés')
                .setDescription('Tous les responsables ClickUp sont déjà configurés.')
                .setColor(0xFFA500);
            await interaction.update({ embeds: [embed], components: [createBackButton()] });
            return;
        }
        
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('responsable_add_select_clickup')
            .setPlaceholder('Sélectionnez un responsable ClickUp')
            .addOptions(availableResponsables.slice(0, 25).map(r => ({
                label: r.length > 100 ? r.substring(0, 97) + '...' : r,
                value: r,
                description: 'Responsable ClickUp'
            })));
        
        const embed = new EmbedBuilder()
            .setTitle('➕ Ajouter un responsable')
            .setDescription('**Étape 1/2** : Sélectionnez un responsable ClickUp dans le menu ci-dessous')
            .setColor(0x5865F2);
        
        await interaction.update({ 
            embeds: [embed], 
            components: [
                new ActionRowBuilder().addComponents(selectMenu),
                createBackButton()
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
            .setMinValues(1);
        
        const embed = new EmbedBuilder()
            .setTitle('➕ Ajouter un responsable')
            .setDescription(`**Étape 2/2** : Sélectionnez les utilisateurs Discord pour le responsable **${responsableName}**`)
            .addFields({ name: 'Responsable ClickUp sélectionné', value: responsableName, inline: false })
            .setColor(0x5865F2);
        
        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('responsable_add_back_step1').setLabel('← Précédent').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('responsable_add_cancel').setLabel('Annuler').setStyle(ButtonStyle.Danger)
        );
        
        await interaction.update({ 
            embeds: [embed], 
            components: [new ActionRowBuilder().addComponents(userSelect), buttons] 
        });
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
        
        const embed = new EmbedBuilder()
            .setTitle('📋 Récapitulatif')
            .setDescription('Vérifiez les informations avant de valider')
            .addFields(
                { name: 'Responsable ClickUp', value: tempData.responsableName, inline: false },
                { name: `Utilisateurs Discord (${validMembers.length})`, value: usersList || 'Aucun', inline: false },
                { name: 'Channel à créer', value: channelName, inline: false }
            )
            .setColor(0x5865F2)
            .setFooter({ text: 'Cliquez sur "Valider" pour créer le channel et sauvegarder' });
        
        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('responsable_add_validate').setLabel('✅ Valider').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('responsable_add_cancel').setLabel('❌ Annuler').setStyle(ButtonStyle.Danger)
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
            }
        });
        
        if (existing) {
            const embed = new EmbedBuilder()
                .setTitle('⚠️ Déjà ajouté')
                .setDescription(`Le responsable "${responsableName}" est déjà configuré.`)
                .setColor(0xFFA500);
            await interaction.update({ embeds: [embed], components: [createBackButton()] });
            tempSelections.delete(userId);
            return;
        }
        
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
        const channel = await interaction.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: category.id,
            reason: `Création du channel pour le responsable ${responsableName} par ${interaction.user.tag}`
        });
        
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: false });
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
        
        tempSelections.delete(userId);
        
        const members = await Promise.all(userIds.map(id => interaction.guild.members.fetch(id)));
        const usersList = members.map(m => `• ${m.displayName || m.user.username}`).join('\n');
        
        const embed = new EmbedBuilder()
            .setTitle('✅ Responsable ajouté')
            .setDescription(`Le responsable **${responsableName}** a été configuré avec succès.`)
            .addFields(
                { name: 'Channel créé', value: `<#${channel.id}>`, inline: false },
                { name: `Utilisateurs (${members.length})`, value: usersList, inline: false }
            )
            .setColor(0x00FF00);
        
        await interaction.update({ embeds: [embed], components: [createBackButton()] });
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
    const embed = new EmbedBuilder()
        .setTitle('❌ Annulé')
        .setDescription('L\'ajout du responsable a été annulé.')
        .setColor(0xFFA500);
    await interaction.update({ embeds: [embed], components: [createBackButton()] });
}
