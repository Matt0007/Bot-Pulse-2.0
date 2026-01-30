import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import prisma from '../../../utils/prisma.js';
import { useAddTask } from '../../../hook/clickup/useAddTask.js';
import { useGetCategoriesInList } from '../../../hook/clickup/useGetCategoriesInList.js';
import { createErrorEmbed, createInfoEmbed, createSuccessEmbed, createWarningEmbed } from '../../common/embeds.js';
import { taskDataCache, buildRecapDescription, updateRecap } from '../add.js';

const toTitleCase = (s) => (s || '').trim().replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

function buildConfirmButtons(messageId) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`tache_add_confirm_final_${messageId}`)
                .setLabel('Confirmer')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`tache_add_confirm_back_${messageId}`)
                .setLabel('Retour')
                .setStyle(ButtonStyle.Secondary)
        );
}

/**
 * Premier clic sur "Valider" : vérifie la catégorie, puis affiche "Êtes-vous sûr ?" (avec avertissement + select des catégories de la liste si besoin)
 */
export async function tacheAddConfirm(interaction) {
    try {
        await interaction.deferUpdate();
        
        const guildId = interaction.guild.id;
        const customId = interaction.customId;
        const messageId = customId.replace('tache_add_confirm_', '');
        
        const taskData = taskDataCache.get(messageId);
        if (!taskData) {
            await interaction.editReply({ embeds: [createErrorEmbed('Session expirée. Veuillez recommencer.')], components: [] });
            return;
        }
        
        if (!taskData.category) {
            await interaction.editReply({
                embeds: [createErrorEmbed('Veuillez sélectionner une catégorie avant de valider (menu « Ajouter des paramètres » > Catégorie).')],
                components: interaction.message.components
            }).catch(() => {});
            return;
        }
        
        const listId = taskData.listId;
        if (!listId) {
            await interaction.editReply({ embeds: [createErrorEmbed('Aucune liste sélectionnée.')], components: [] });
            return;
        }
        
        const { categoriesUsed, hasCategory } = await useGetCategoriesInList(guildId, listId);
        const categoryInList = hasCategory(taskData.category);
        
        if (categoryInList) {
            await doCreateTask(interaction, messageId);
            return;
        }
        
        const listName = taskData.listName || 'Liste inconnue';
        const categoriesText = categoriesUsed.length > 0
            ? categoriesUsed.map(c => `• ${toTitleCase(c)}`).join('\n')
            : 'Aucune autre catégorie utilisée dans cette liste.';
        const confirmEmbed = createWarningEmbed(
            '⚠️ Êtes-vous sûr ?',
            `**Aucune tâche de la catégorie « ${taskData.category} »** n'existe dans la liste **${listName}**.\n\n` +
            `**Catégories déjà utilisées dans cette liste :**\n${categoriesText}\n\n` +
            `Choisissez une catégorie ci-dessous pour l'utiliser, ou confirmez pour garder « ${taskData.category} ».`
        );
        const components = [];
        if (categoriesUsed.length > 0) {
            const categorySelect = new StringSelectMenuBuilder()
                .setCustomId(`tache_add_confirm_category_select_${messageId}`)
                .setPlaceholder('Utiliser une catégorie de la liste...')
                .addOptions(categoriesUsed.slice(0, 25).map(c => 
                    new StringSelectMenuOptionBuilder().setLabel(toTitleCase(c)).setValue(c)
                ));
            components.push(new ActionRowBuilder().addComponents(categorySelect));
        }
        components.push(buildConfirmButtons(messageId));
        
        await interaction.editReply({ embeds: [confirmEmbed], components });
    } catch (error) {
        console.error('Erreur lors de l\'affichage de la confirmation:', error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Erreur lors de la confirmation.', ephemeral: true });
        } else {
            await interaction.editReply({ embeds: [createErrorEmbed('Erreur lors de la confirmation.')], components: [] }).catch(() => {});
        }
    }
}

/**
 * Sélection d'une catégorie depuis la liste (écran d'avertissement) : met à jour la catégorie et crée la tâche directement
 */
export async function tacheAddConfirmCategorySelect(interaction) {
    try {
        await interaction.deferUpdate();
        const messageId = interaction.customId.replace('tache_add_confirm_category_select_', '');
        const selectedCategory = interaction.values[0];
        
        const taskData = taskDataCache.get(messageId);
        if (!taskData) {
            await interaction.editReply({ embeds: [createErrorEmbed('Session expirée. Veuillez recommencer.')], components: [] });
            return;
        }
        
        taskData.category = selectedCategory;
        taskDataCache.set(messageId, taskData);
        
        await doCreateTask(interaction, messageId);
    } catch (error) {
        console.error('Erreur lors du choix de catégorie (confirm):', error);
        await interaction.editReply({ embeds: [createErrorEmbed('Erreur lors de la modification.')], components: [] }).catch(() => {});
    }
}

/**
 * Retour au récapitulatif depuis l'écran "Êtes-vous sûr ?"
 */
export async function tacheAddConfirmBack(interaction) {
    try {
        await interaction.deferUpdate();
        const messageId = interaction.customId.replace('tache_add_confirm_back_', '');
        await updateRecap(interaction, messageId);
    } catch (error) {
        console.error('Erreur lors du retour au récapitulatif:', error);
    }
}

/**
 * Crée la tâche dans ClickUp (partagé entre confirm final et sélection catégorie depuis la liste)
 */
async function doCreateTask(interaction, messageId) {
    const guildId = interaction.guild.id;
    const taskData = taskDataCache.get(messageId);
    if (!taskData) {
        await interaction.editReply({ embeds: [createErrorEmbed('Session expirée. Veuillez recommencer.')], components: [] });
        return;
    }
    const listId = taskData.listId;
    const listName = taskData.listName || 'Liste inconnue';
    const projectName = taskData.projectName || 'Projet inconnu';
    if (!listId) {
        await interaction.editReply({ embeds: [createErrorEmbed('Aucune liste sélectionnée.')], components: [] });
        return;
    }
    await interaction.editReply({ embeds: [createInfoEmbed('⏳ Création de la tâche...', 'Veuillez patienter pendant la création de la tâche dans ClickUp.')], components: [] });
    await useAddTask(
        guildId,
        listId,
        taskData.taskName,
        taskData.responsableName,
        taskData.dueDate,
        taskData.startDate,
        taskData.category,
        taskData.priority
    );
    const responsable = await prisma.guildResponsable.findUnique({
        where: { channelId: interaction.channel.id }
    });
    const responsableInfoText = responsable ? `\n**Responsable :** ${responsable.responsableName}` : '';
    const successDescription = buildRecapDescription(taskData, projectName, listName, responsableInfoText);
    const successEmbed = createSuccessEmbed('✅ Tâche créée avec succès', successDescription);
    taskDataCache.delete(messageId);
    await interaction.editReply({ embeds: [successEmbed], components: [] });
}

/**
 * Confirmation finale : crée la tâche dans ClickUp
 */
export async function tacheAddConfirmFinal(interaction) {
    try {
        await interaction.deferUpdate();
        const messageId = interaction.customId.replace('tache_add_confirm_final_', '');
        await doCreateTask(interaction, messageId);
    } catch (error) {
        console.error('Erreur lors de la création de la tâche:', error);
        const errorMessage = error.message?.includes('API ClickUp') ? error.message : 'Impossible de créer la tâche dans ClickUp.';
        await interaction.editReply({ embeds: [createErrorEmbed(errorMessage)], components: [] });
    }
}
