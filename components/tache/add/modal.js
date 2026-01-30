import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import prisma from '../../../utils/prisma.js';
import { getTodayParisTimestamp } from '../../../utils/date.js';
import { getClickUpApiKey, clickUpRequest } from '../../../utils/clickup.js';
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
 * Traite la soumission du modal initial : étape catégorie obligatoire puis récapitulatif
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
        
        const guildConfig = await prisma.guildConfig.findUnique({ where: { guildId } });
        if (!guildConfig?.selectedListId) {
            await interaction.editReply({ embeds: [createErrorEmbed('Aucune liste d\'ajout configurée. Veuillez configurer une liste dans les paramètres.')] });
            return;
        }
        
        const listId = guildConfig.selectedListId;
        const listName = guildConfig.selectedListName;
        const projectName = guildConfig.selectedProjectName || 'Projet inconnu';
        const responsable = await prisma.guildResponsable.findUnique({ where: { channelId: interaction.channel.id } });
        const responsableName = responsable?.responsableName || null;
        const responsableInfo = responsable ? `\n**Responsable :** ${responsable.responsableName}` : '';
        
        const messageId = `${interaction.user.id}_${Date.now()}`;
        const todayTimestamp = getTodayParisTimestamp();
        const taskData = {
            listId,
            listName,
            projectId: guildConfig.selectedProjectId || null,
            projectName,
            taskName,
            responsableName,
            startDate: todayTimestamp,
            dueDate: null,
            priority: 3,
            category: null,
            messageId: null,
            initialCategoryStep: false
        };
        taskDataCache.set(messageId, taskData);
        
        // Premier message : chargement des catégories (pour avoir l'ID du message)
        const loadingEmbed = createInfoEmbed('📋 Catégorie obligatoire', 'Chargement des catégories...');
        const reply = await interaction.editReply({ embeds: [loadingEmbed], components: [] });
        taskData.messageId = reply.id;
        taskDataCache.set(messageId, taskData);
        
        let categories = [];
        try {
            const apiKey = await getClickUpApiKey(guildId);
            const tasksData = await clickUpRequest(apiKey, `/list/${listId}/task?archived=false&limit=1`);
            if (tasksData.tasks?.length > 0) {
                const sampleTask = tasksData.tasks[0];
                const categoryField = sampleTask.custom_fields?.find(f => {
                    const name = f?.name?.toLowerCase().trim();
                    return name === 'catégorie' || name === 'categorie' || name === 'category';
                });
                if (categoryField?.type === 'drop_down' && categoryField.type_config?.options) {
                    categories = categoryField.type_config.options.map(opt => opt.name).filter(Boolean);
                }
            }
        } catch (err) {
            console.error('Erreur récupération catégories (modal):', err);
        }
        
        if (categories.length === 0) {
            await sendRecapReply(interaction, messageId, projectName, listName, responsableInfo, taskData);
            return;
        }
        
        // Étape obligatoire : sélection de la catégorie
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
        pageCategories.forEach(cat => {
            categorySelect.addOptions(new StringSelectMenuOptionBuilder().setLabel(cat).setValue(cat));
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
        
        const categoryEmbed = createInfoEmbed('📋 Catégorie obligatoire', `**Nom de la tâche :** ${taskData.taskName}\n\nChoisissez une catégorie pour la tâche (étape obligatoire).`);
        await interaction.editReply({ embeds: [categoryEmbed], components: [selectRow, buttonsRow] });
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
