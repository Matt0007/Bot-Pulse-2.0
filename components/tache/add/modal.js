import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import prisma from '../../../utils/prisma.js';
import { getTodayParisTimestamp } from '../../../utils/date.js';
import { useGetAllProject } from '../../../hook/clickup/useGetAllProject.js';
import { useGetCategoriesInList } from '../../../hook/clickup/useGetCategoriesInList.js';
import { createErrorEmbed, createInfoEmbed } from '../../common/embeds.js';
import { taskDataCache, updateRecap, buildRecapDescription } from '../add.js';

/**
 * Affiche le récapitulatif avec select et boutons Valider/Annuler (utilisé quand pas de catégories ou après sélection catégorie)
 */
async function sendRecapReply(interaction, messageId, projectName, listName, responsableInfo, taskData) {
    const description = buildRecapDescription(taskData, projectName, listName, responsableInfo);
    const recapEmbed = createInfoEmbed('📋 Récapitulatif de la tâche', description);
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`tache_add_params_${messageId}`)
        .setPlaceholder('Ajouter des paramètres...')
        .addOptions(
            new StringSelectMenuOptionBuilder().setLabel('Nom').setValue('name').setDescription('Changer le nom de la tâche'),
            new StringSelectMenuOptionBuilder().setLabel('Date de début').setValue('start_date').setDescription('Définir la date de début de la tâche'),
            new StringSelectMenuOptionBuilder().setLabel('Date d\'échéance').setValue('due_date').setDescription('Définir la date d\'échéance de la tâche'),
            new StringSelectMenuOptionBuilder().setLabel('Priorité').setValue('priority').setDescription('Définir la priorité de la tâche'),
            new StringSelectMenuOptionBuilder().setLabel('Catégorie').setValue('category').setDescription('Définir la catégorie de la tâche'),
            new StringSelectMenuOptionBuilder().setLabel('Emplacement').setValue('location').setDescription('Modifier le projet et la liste de destination')
        );
    const selectRow = new ActionRowBuilder().addComponents(selectMenu);
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId(`tache_add_confirm_${messageId}`).setLabel('Valider').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('tache_add_cancel').setLabel('Annuler').setStyle(ButtonStyle.Danger)
        );
    return interaction.editReply({ embeds: [recapEmbed], components: [selectRow, buttons] });
}

/**
 * Charge les catégories de la liste sélectionnée et affiche l'étape catégorie ou le récap
 * (utilisé après sélection liste dans le flux initial)
 */
export async function showCategoryStepOrRecap(interaction, messageId) {
    const taskData = taskDataCache.get(messageId);
    if (!taskData) return;
    const guildId = interaction.guild.id;
    const responsable = await prisma.guildResponsable.findUnique({ where: { channelId: interaction.channel.id } });
    const responsableInfo = responsable ? `\n**Responsable :** ${responsable.responsableName}` : '';
    const projectName = taskData.projectName || 'Projet inconnu';
    const listName = taskData.listName || 'Liste inconnue';
    let categories = [];
    try {
        const { categoriesUsed } = await useGetCategoriesInList(guildId, taskData.listId);
        categories = categoriesUsed;
    } catch (err) {
        console.error('Erreur récupération catégories (showCategoryStepOrRecap):', err);
    }
    if (categories.length === 0) {
        await sendRecapReply(interaction, messageId, projectName, listName, responsableInfo, taskData);
        return;
    }
    taskData.categories = categories;
    taskData.categoryPage = 0;
    taskData.initialCategoryStep = true;
    taskDataCache.set(messageId, taskData);
    const ITEMS_PER_PAGE = 25;
    const totalPages = Math.ceil(categories.length / ITEMS_PER_PAGE);
    const pageCategories = categories.slice(0, ITEMS_PER_PAGE);
    const categorySelect = new StringSelectMenuBuilder()
        .setCustomId(`tache_add_category_select_${messageId}`)
        .setPlaceholder(totalPages > 1 ? 'Sélectionner une catégorie (Page 1/' + totalPages + ')...' : 'Sélectionner une catégorie...');
    pageCategories.forEach((cat, idx) => {
        categorySelect.addOptions(new StringSelectMenuOptionBuilder().setLabel(cat).setValue(String(idx)));
    });
    const selectRow = new ActionRowBuilder().addComponents(categorySelect);
    const navButtons = [
        new ButtonBuilder().setCustomId('tache_add_cancel').setLabel('Annuler').setStyle(ButtonStyle.Danger)
    ];
    if (totalPages > 1) {
        navButtons.push(
            new ButtonBuilder().setCustomId(`tache_add_category_page_prev_${messageId}`).setLabel(' << ').setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId(`tache_add_category_page_next_${messageId}`).setLabel(' >> ').setStyle(ButtonStyle.Secondary).setDisabled(totalPages <= 1)
        );
    }
    const buttonsRow = new ActionRowBuilder().addComponents(navButtons);
    const categoryEmbed = createInfoEmbed('📋 Catégorie', `**Nom :** ${taskData.taskName}\n**Liste :** ${listName}\n\nChoisissez une catégorie pour la tâche (celles de la liste sélectionnée).`);
    await interaction.editReply({ embeds: [categoryEmbed], components: [selectRow, buttonsRow] });
}

/**
 * Traite la soumission du modal initial : étape Emplacement/liste puis Catégorie puis récapitulatif
 */
export async function tacheAddModal(interaction) {
    try {
        await interaction.deferReply();
        
        const guildId = interaction.guild.id;
        const taskName = interaction.fields.getTextInputValue('tache_name').trim();
        
        if (!taskName) {
            await interaction.editReply({ embeds: [createErrorEmbed('Le nom de la tâche ne peut pas être vide.')] });
            return;
        }
        
        const responsable = await prisma.guildResponsable.findUnique({ where: { channelId: interaction.channel.id } });
        const responsableName = responsable?.responsableName || null;
        const messageId = `${interaction.user.id}_${Date.now()}`;
        const todayTimestamp = getTodayParisTimestamp();
        const taskData = {
            listId: null,
            listName: null,
            projectId: null,
            projectName: null,
            taskName,
            responsableName,
            startDate: todayTimestamp,
            dueDate: null,
            priority: 3,
            category: null,
            messageId: null,
            initialCategoryStep: false,
            initialLocationStep: true
        };
        taskDataCache.set(messageId, taskData);
         
        const loadingEmbed = createInfoEmbed('📋 Emplacement / liste', 'Chargement des projets...');
        const reply = await interaction.editReply({ embeds: [loadingEmbed], components: [] });
        taskData.messageId = reply.id;
        taskDataCache.set(messageId, taskData);
        
        const apiProjects = await useGetAllProject(guildId);
        if (!apiProjects || apiProjects.length === 0) {
            await interaction.editReply({ embeds: [createErrorEmbed('Aucun projet trouvé sur ClickUp.')] });
            return;
        }
        const selectOptions = apiProjects.slice(0, 25).map(project => ({
            label: project.name.length > 100 ? project.name.substring(0, 97) + '...' : project.name,
            value: project.id
        }));
        const projectSelect = new StringSelectMenuBuilder()
            .setCustomId(`tache_add_location_project_${messageId}`)
            .setPlaceholder('Sélectionnez un projet')
            .addOptions(selectOptions);
        const selectRow = new ActionRowBuilder().addComponents(projectSelect);
        const cancelButton = new ActionRowBuilder()
            .addComponents(new ButtonBuilder().setCustomId('tache_add_cancel').setLabel('Annuler').setStyle(ButtonStyle.Danger));
        const locationEmbed = createInfoEmbed('📋 Emplacement / liste', `**Nom de la tâche :** ${taskData.taskName}\n\nChoisissez le **projet** puis la **liste** où ajouter la tâche. Les catégories affichées à l'étape suivante seront celles de la liste sélectionnée.`);
        await interaction.editReply({ embeds: [locationEmbed], components: [selectRow, cancelButton] });
    } catch (error) {
        console.error('Erreur lors de la création de la tâche:', error);
        const errorMessage = error.message?.includes('API ClickUp') ? error.message : 'Impossible de créer la tâche dans ClickUp.';
        await interaction.editReply({ embeds: [createErrorEmbed(errorMessage)] });
    }
}

/**
 * Traite la soumission du modal de modification
 */
export async function tacheAddModifyModal(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });
        
        const customId = interaction.customId;
        const taskName = interaction.fields.getTextInputValue('tache_name').trim();
        
        if (!taskName) {
            await interaction.editReply({
                content: '❌ Le nom de la tâche ne peut pas être vide.'
            });
            return;
        }
        
        // Extraire messageId depuis le customId
        // Format: tache_add_modify_modal_{messageId}
        const messageId = customId.replace('tache_add_modify_modal_', '');
        
        const taskData = taskDataCache.get(messageId);
        if (!taskData) {
            await interaction.editReply({
                content: '❌ Session expirée. Veuillez recommencer.'
            });
            return;
        }
        
        // Mettre à jour le cache avec le nouveau nom
        taskData.taskName = taskName;
        taskDataCache.set(messageId, taskData);
        
        // Mettre à jour le récapitulatif
        await updateRecap(interaction, messageId);
        
        // Supprimer le message éphémère
        await interaction.deleteReply();
    } catch (error) {
        console.error('Erreur lors de la modification du nom:', error);
        
        await interaction.editReply({ embeds: [createErrorEmbed('Impossible de modifier le nom de la tâche.')] });
    }
}
