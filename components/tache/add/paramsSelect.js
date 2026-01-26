import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { getClickUpApiKey, clickUpRequest } from '../../../utils/clickup.js';
import { createErrorEmbed, createInfoEmbed } from '../../common/embeds.js';
import { taskDataCache, updateRecap } from '../add.js';

/**
 * Gère la sélection d'un paramètre dans le select menu
 */
export async function tacheAddParamsSelect(interaction) {
    try {
        const customId = interaction.customId;
        const messageId = customId.replace('tache_add_params_', '');
        const selectedValue = interaction.values[0];
        
        const taskData = taskDataCache.get(messageId);
        if (!taskData) {
            await interaction.reply({ content: '❌ Session expirée. Veuillez recommencer.', ephemeral: true });
            return;
        }
        
        if (selectedValue === 'name') {
            // Modifier le nom de la tâche
            const modal = new ModalBuilder()
                .setCustomId(`tache_add_modify_modal_${messageId}`)
                .setTitle('Modifier le nom de la tâche');
            
            const taskNameInput = new TextInputBuilder()
                .setCustomId('tache_name')
                .setLabel('Nom de la tâche')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Entrez le nouveau nom de la tâche')
                .setRequired(true)
                .setMaxLength(100)
                .setValue(taskData.taskName);
            
            const row = new ActionRowBuilder().addComponents(taskNameInput);
            modal.addComponents(row);
            
            await interaction.showModal(modal);
        } else if (selectedValue === 'start_date' || selectedValue === 'due_date') {
            // Afficher un modal pour la date
            const modal = new ModalBuilder()
                .setCustomId(`tache_add_date_modal_${messageId}_${selectedValue}`)
                .setTitle(selectedValue === 'start_date' ? 'Date de début' : 'Date d\'échéance');
            
            const dateInput = new TextInputBuilder()
                .setCustomId('date_value')
                .setLabel('Date (JJ/MM/AAAA)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Ex: 25/12/2024')
                .setRequired(true)
                .setMaxLength(10);
            
            const row = new ActionRowBuilder().addComponents(dateInput);
            modal.addComponents(row);
            
            await interaction.showModal(modal);
        } else if (selectedValue === 'priority') {
            // Afficher immédiatement le select menu de priorité
            const prioritySelect = new StringSelectMenuBuilder()
                .setCustomId(`tache_add_priority_select_${messageId}`)
                .setPlaceholder('Sélectionner une priorité...')
                .addOptions(
                    new StringSelectMenuOptionBuilder().setLabel('Urgent').setValue('1'),
                    new StringSelectMenuOptionBuilder().setLabel('Élevé').setValue('2'),
                    new StringSelectMenuOptionBuilder().setLabel('Normale').setValue('3'),
                    new StringSelectMenuOptionBuilder().setLabel('Basse').setValue('4')
                );
            
            const selectRow = new ActionRowBuilder().addComponents(prioritySelect);
            
            // Ajouter un bouton "Précédent" pour revenir au récapitulatif
            const backButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`tache_add_priority_back_${messageId}`)
                        .setLabel('← Précédent')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            const tempEmbed = createInfoEmbed('📋 Sélection de la priorité', 'Choisissez une priorité pour la tâche');
            await interaction.update({ embeds: [tempEmbed], components: [selectRow, backButton] });
        } else if (selectedValue === 'category') {
            // Différer l'interaction immédiatement pour éviter l'expiration
            await interaction.deferUpdate();
            
            // Afficher immédiatement un message de chargement
            const loadingEmbed = createInfoEmbed('📋 Sélection de la catégorie', 'Chargement des catégories...');
            await interaction.editReply({ embeds: [loadingEmbed], components: [] });
            
            try {
                const guildId = interaction.guild.id;
                const apiKey = await getClickUpApiKey(guildId);
                const tasksData = await clickUpRequest(apiKey, `/list/${taskData.listId}/task?archived=false&limit=1`);
                
                let categories = [];
                if (tasksData.tasks && tasksData.tasks.length > 0) {
                    const sampleTask = tasksData.tasks[0];
                    const categoryField = sampleTask.custom_fields?.find(f => {
                        const name = f?.name?.toLowerCase().trim();
                        return name === 'catégorie' || name === 'categorie' || name === 'category';
                    });
                    
                    if (categoryField && categoryField.type === 'drop_down' && categoryField.type_config?.options) {
                        categories = categoryField.type_config.options.map(opt => opt.name).filter(Boolean);
                    }
                }
                
                if (categories.length === 0) {
                    // Si pas de catégories, remettre le récapitulatif
                    await updateRecap(interaction, messageId);
                    return;
                }
                
                // Stocker les catégories dans le cache avec la page initiale (0)
                taskData.categories = categories;
                taskData.categoryPage = 0;
                taskDataCache.set(messageId, taskData);
                
                // Afficher la première page des catégories
                await displayCategoryPage(interaction, messageId, 0);
            } catch (error) {
                console.error('Erreur lors de la récupération des catégories:', error);
                // En cas d'erreur, remettre le récapitulatif
                try {
                    await updateRecap(interaction, messageId);
                } catch (updateError) {
                    console.error('Erreur lors de la mise à jour du récapitulatif:', updateError);
                }
            }
        } else if (selectedValue === 'location') {
            // Différer l'interaction immédiatement pour éviter l'expiration
            await interaction.deferUpdate();
            
            // Afficher immédiatement un message de chargement
            const loadingEmbed = createInfoEmbed('📋 Modification de l\'emplacement', 'Chargement des projets...');
            await interaction.editReply({ embeds: [loadingEmbed], components: [] });
            
            try {
                const guildId = interaction.guild.id;
                const { useGetAllProject } = await import('../../../hook/clickup/useGetAllProject.js');
                const apiProjects = await useGetAllProject(guildId);
                
                if (!apiProjects || apiProjects.length === 0) {
                    await updateRecap(interaction, messageId);
                    return;
                }
                
                // Créer le select menu pour les projets (max 25 options)
                const selectOptions = apiProjects.slice(0, 25).map(project => ({
                    label: project.name.length > 100 ? project.name.substring(0, 97) + '...' : project.name,
                    value: project.id
                }));
                
                const projectSelect = new StringSelectMenuBuilder()
                    .setCustomId(`tache_add_location_project_${messageId}`)
                    .setPlaceholder('Sélectionnez un projet')
                    .addOptions(selectOptions);
                
                const selectRow = new ActionRowBuilder().addComponents(projectSelect);
                
                // Ajouter un bouton "Précédent" pour revenir au récapitulatif
                const backButton = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`tache_add_location_back_${messageId}`)
                            .setLabel('← Précédent')
                            .setStyle(ButtonStyle.Secondary)
                    );
                
                // Modifier le message avec editReply
                const tempEmbed = createInfoEmbed('📋 Modification de l\'emplacement', 'Sélectionnez un nouveau projet pour la tâche');
                await interaction.editReply({ embeds: [tempEmbed], components: [selectRow, backButton] });
            } catch (error) {
                console.error('Erreur lors de la récupération des projets:', error);
                try {
                    await updateRecap(interaction, messageId);
                } catch (updateError) {
                    console.error('Erreur lors de la mise à jour du récapitulatif:', updateError);
                }
            }
        }
    } catch (error) {
        console.error('Erreur lors de la sélection du paramètre:', error);
        await interaction.reply({ content: '❌ Erreur lors de la sélection.', ephemeral: true });
    }
}

/**
 * Affiche une page de catégories avec pagination
 * @param {Interaction} interaction - L'interaction Discord
 * @param {string} messageId - L'ID du message de récapitulatif
 * @param {number} page - Le numéro de page (0-indexed)
 * @param {boolean} useUpdate - Si true, utilise interaction.update(), sinon édite le message directement
 */
async function displayCategoryPage(interaction, messageId, page, useUpdate = false) {
    const taskData = taskDataCache.get(messageId);
    if (!taskData || !taskData.categories) {
        if (useUpdate) {
            await interaction.update({ embeds: [createErrorEmbed('Session expirée. Veuillez recommencer.')], components: [] });
        } else {
            await updateRecap(interaction, messageId);
        }
        return;
    }
    
    const categories = taskData.categories;
    const ITEMS_PER_PAGE = 25;
    const totalPages = Math.ceil(categories.length / ITEMS_PER_PAGE);
    const startIndex = page * ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, categories.length);
    const pageCategories = categories.slice(startIndex, endIndex);
    
    const categorySelect = new StringSelectMenuBuilder()
        .setCustomId(`tache_add_category_select_${messageId}`)
        .setPlaceholder(totalPages > 1 ? `Sélectionner une catégorie (Page ${page + 1}/${totalPages})...` : 'Sélectionner une catégorie...');
    
    pageCategories.forEach(cat => {
        categorySelect.addOptions(
            new StringSelectMenuOptionBuilder().setLabel(cat).setValue(cat)
        );
    });
    
    const selectRow = new ActionRowBuilder().addComponents(categorySelect);
    
    // Créer les boutons de navigation
    const buttons = [];
    
    // Bouton Précédent
    if (totalPages > 1) {
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`tache_add_category_page_prev_${messageId}`)
                .setLabel(' << ')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0)
        );
        
        // Bouton Suivant
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`tache_add_category_page_next_${messageId}`)
                .setLabel(' >> ')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page >= totalPages - 1)
        );
    }
    
    // Bouton Retour
    buttons.push(
        new ButtonBuilder()
            .setCustomId(`tache_add_category_back_${messageId}`)
            .setLabel('← Précédent')
            .setStyle(ButtonStyle.Secondary)
    );
    
    const buttonsRow = new ActionRowBuilder().addComponents(buttons);
    
    const tempEmbed = createInfoEmbed('📋 Sélection de la catégorie', `Choisissez une catégorie pour la tâche${totalPages > 1 ? `\n*Page ${page + 1} sur ${totalPages}*` : ''}`);
    // Utiliser interaction.update() si c'est une pagination, sinon éditer le message
    if (useUpdate) {
        await interaction.update({ embeds: [tempEmbed], components: [selectRow, buttonsRow] });
    } else {
        // Modifier le message du récapitulatif
        if (taskData.messageId) {
            try {
                const channel = await interaction.client.channels.fetch(interaction.channel.id);
                const message = await channel.messages.fetch(taskData.messageId);
                await message.edit({ embeds: [tempEmbed], components: [selectRow, buttonsRow] });
            } catch (error) {
                console.error('Erreur lors de la modification du message:', error);
            }
        }
    }
}

/**
 * Gère la pagination des catégories
 */
export async function tacheAddCategoryPagination(interaction) {
    try {
        const customId = interaction.customId;
        // Extraire le messageId : format "tache_add_category_page_prev_{messageId}" ou "tache_add_category_page_next_{messageId}"
        let messageId = '';
        if (customId.startsWith('tache_add_category_page_prev_')) {
            messageId = customId.replace('tache_add_category_page_prev_', '');
        } else if (customId.startsWith('tache_add_category_page_next_')) {
            messageId = customId.replace('tache_add_category_page_next_', '');
        }
        
        const taskData = taskDataCache.get(messageId);
        if (!taskData || !taskData.categories) {
            await interaction.update({ embeds: [createErrorEmbed('Session expirée. Veuillez recommencer.')], components: [] });
            return;
        }
        
        let currentPage = taskData.categoryPage || 0;
        const ITEMS_PER_PAGE = 25;
        const totalPages = Math.ceil(taskData.categories.length / ITEMS_PER_PAGE);
        
        if (customId.startsWith('tache_add_category_page_prev')) {
            currentPage = Math.max(0, currentPage - 1);
        } else if (customId.startsWith('tache_add_category_page_next')) {
            currentPage = Math.min(totalPages - 1, currentPage + 1);
        }
        
        // Mettre à jour la page dans le cache
        taskData.categoryPage = currentPage;
        taskDataCache.set(messageId, taskData);
        
        // Afficher la nouvelle page avec interaction.update()
        await displayCategoryPage(interaction, messageId, currentPage, true);
    } catch (error) {
        console.error('Erreur lors de la pagination des catégories:', error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Erreur lors de la pagination.', ephemeral: true });
        }
    }
}
