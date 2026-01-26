import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType } from 'discord.js';
import prisma from '../../../utils/prisma.js';
import { encrypt, decrypt } from '../../../utils/encryption.js';
import { logAdminAction } from '../../../utils/history.js';
import { createBackButton, createOkButton } from '../../common/buttons.js';
import { createErrorEmbed, createInfoEmbed, createSuccessEmbed, createWarningEmbed } from '../../common/embeds.js';

const handleError = async (interaction, message) => {
    const embed = createErrorEmbed(message);
    const back = createBackButton('parametre_button');
    if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [embed], components: [back] });
    } else {
        await interaction.deferUpdate();
        await interaction.editReply({ embeds: [embed], components: [back] });
    }
};

export async function clickupButton(interaction) {
    try {
        const guildConfig = await prisma.guildConfig.findUnique({ where: { guildId: interaction.guild.id } });
        let hasApiKey = false;
        if (guildConfig?.clickupApiKey) {
            try {
                hasApiKey = !!decrypt(guildConfig.clickupApiKey)?.trim();
            } catch {
                hasApiKey = false;
            }
        }
        
        const desc = hasApiKey
            ? '✅ Une clé API est configurée.\nCliquez sur "Modifier" pour la changer.'
            : '❌ Aucune clé API configurée.\nCliquez sur "Configurer" pour en ajouter une.';
        const embed = createInfoEmbed('🔑 Clé API ClickUp', desc).setColor(hasApiKey ? 0x00FF00 : 0xFF0000);
        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('clickup_configure_button').setLabel(hasApiKey ? 'Modifier' : 'Configurer').setStyle(hasApiKey ? ButtonStyle.Secondary : ButtonStyle.Success),
            new ButtonBuilder().setCustomId('parametre_button').setLabel('Retour').setStyle(ButtonStyle.Secondary)
        );
        
        await interaction.update({ embeds: [embed], components: [buttons] });
    } catch (error) {
        console.error('Erreur lors de la récupération de la config:', error);
        await interaction.update({ embeds: [createErrorEmbed('Impossible de charger la configuration.')], components: [] });
    }
}

export async function clickupConfigure(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('clickup_api_modal')
        .setTitle('Configuration de la clé API ClickUp');
    
    const apiKeyInput = new TextInputBuilder()
        .setCustomId('clickup_api_key')
        .setLabel('Clé API ClickUp')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Entrez votre clé API ClickUp')
        .setRequired(true);
    
    const row = new ActionRowBuilder().addComponents(apiKeyInput);
    modal.addComponents(row);
    
    await interaction.showModal(modal);
}

export async function clickupApiModal(interaction) {
    try {
        const apiKey = interaction.fields.getTextInputValue('clickup_api_key');
        const encryptedApiKey = encrypt(apiKey.trim());
        if (!encryptedApiKey) throw new Error('Impossible de chiffrer la clé API');
        
        const existingConfig = await prisma.guildConfig.findUnique({ where: { guildId: interaction.guild.id } });
        
        if (existingConfig?.clickupApiKey) {
            if (!global.tempApiKeys) global.tempApiKeys = new Map();
            global.tempApiKeys.set(interaction.user.id, encryptedApiKey);
            
            const embed = createWarningEmbed(
                '⚠️ Clé API existante détectée',
                'Une clé API est déjà configurée.\n\n**Voulez-vous réinitialiser les données du bot ?**\n\nCela supprimera :\n• Tous les projets configurés\n• Tous les responsables et leurs channels\n• La catégorie "responsable"'
            );
            
            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('clickup_reset_confirm').setLabel('Oui, réinitialiser').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('clickup_reset_cancel').setLabel('Non, garder les données').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('clickup_button').setLabel('Annuler').setStyle(ButtonStyle.Secondary)
            );
            
            await interaction.deferUpdate();
            await interaction.editReply({ embeds: [embed], components: [buttons] });
            return;
        }
        
        await prisma.guildConfig.upsert({
            where: { guildId: interaction.guild.id },
            update: { clickupApiKey: encryptedApiKey },
            create: { guildId: interaction.guild.id, clickupApiKey: encryptedApiKey }
        });
        
        const embed = createSuccessEmbed('✅ Clé API ClickUp configurée', 'La clé API ClickUp a été enregistrée et chiffrée avec succès.');
        await interaction.deferUpdate();
        await interaction.editReply({ embeds: [embed], components: [createOkButton('clickup_button')] });
    } catch (error) {
        console.error('Erreur lors de la sauvegarde de la clé API:', error);
        await interaction.deferUpdate();
        await interaction.editReply({ embeds: [createErrorEmbed('Impossible de sauvegarder la clé API.')] });
    }
}

export async function clickupResetConfirm(interaction) {
    try {
        if (!global.tempApiKeys) {
            await handleError(interaction, 'Session expirée. Veuillez recommencer.');
            return;
        }
        
        const encryptedApiKey = global.tempApiKeys.get(interaction.user.id);
        if (!encryptedApiKey) {
            await handleError(interaction, 'Session expirée. Veuillez recommencer.');
            return;
        }
        
        const guildId = interaction.guild.id;
        await prisma.guildProject.deleteMany({ where: { guildId } });
        
        const responsables = await prisma.guildResponsable.findMany({ where: { guildId } });
        for (const responsable of responsables) {
            try {
                const channel = await interaction.guild.channels.fetch(responsable.channelId).catch(() => null);
                if (channel) await channel.delete(`Réinitialisation : changement de clé API ClickUp`);
            } catch (error) {
                console.error(`Erreur lors de la suppression du channel ${responsable.channelId}:`, error);
            }
        }
        
        await prisma.guildResponsable.deleteMany({ where: { guildId } });
        
        const category = interaction.guild.channels.cache.find(
            c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === 'responsable'
        );
        if (category) {
            try {
                await category.delete(`Réinitialisation : changement de clé API ClickUp`);
            } catch (error) {
                console.error('Erreur lors de la suppression de la catégorie:', error);
            }
        }
        
        await prisma.guildConfig.upsert({
            where: { guildId },
            update: { 
                clickupApiKey: encryptedApiKey,
                selectedListId: null,
                selectedListName: null,
                selectedProjectId: null,
                selectedProjectName: null
            },
            create: { guildId, clickupApiKey: encryptedApiKey }
        });
        
        // Supprimer tout l'historique et créer une nouvelle entrée
        await prisma.historyAdmin.deleteMany({ where: { guildId } });
        
        const userName = interaction.user.displayName || interaction.user.username;
        await logAdminAction(
            guildId,
            interaction.user.id,
            userName,
            `a changé la clé API et a réinitialisé les données du bot`
        );
        
        global.tempApiKeys.delete(interaction.user.id);
        
        const embed = createSuccessEmbed(
            '✅ Réinitialisation terminée',
            'La clé API ClickUp a été mise à jour et toutes les données ont été réinitialisées.\n\n**Données supprimées :**\n• Tous les projets configurés\n• Tous les responsables et leurs channels\n• La catégorie "responsable"\n• La liste d\'ajout sélectionnée\n• L\'historique (une nouvelle entrée a été créée)'
        );
        await interaction.update({ embeds: [embed], components: [createOkButton('clickup_button')] });
    } catch (error) {
        console.error('Erreur lors de la réinitialisation:', error);
        await handleError(interaction, `Impossible de réinitialiser: ${error.message}`);
        if (global.tempApiKeys) global.tempApiKeys.delete(interaction.user.id);
    }
}

export async function clickupResetCancel(interaction) {
    try {
        if (!global.tempApiKeys) {
            await handleError(interaction, 'Session expirée. Veuillez recommencer.');
            return;
        }
        
        const encryptedApiKey = global.tempApiKeys.get(interaction.user.id);
        if (!encryptedApiKey) {
            await handleError(interaction, 'Session expirée. Veuillez recommencer.');
            return;
        }
        
        // Sauvegarder la nouvelle clé API sans supprimer les données
        await prisma.guildConfig.upsert({
            where: { guildId: interaction.guild.id },
            update: { clickupApiKey: encryptedApiKey },
            create: { guildId: interaction.guild.id, clickupApiKey: encryptedApiKey }
        });
        
        // Ajouter une entrée dans l'historique (l'historique est conservé)
        const userName = interaction.user.displayName || interaction.user.username;
        await logAdminAction(
            interaction.guild.id,
            interaction.user.id,
            userName,
            `a changé la clé API et a gardé les données du bot`
        );
        
        global.tempApiKeys.delete(interaction.user.id);
        
        const embed = createSuccessEmbed('✅ Clé API mise à jour', 'La clé API ClickUp a été mise à jour. Les données existantes sont conservées.');
        await interaction.update({ embeds: [embed], components: [createOkButton('clickup_button')] });
    } catch (error) {
        console.error('Erreur lors de la mise à jour:', error);
        await handleError(interaction, `Impossible de mettre à jour la clé API: ${error.message}`);
        if (global.tempApiKeys) global.tempApiKeys.delete(interaction.user.id);
    }
}
