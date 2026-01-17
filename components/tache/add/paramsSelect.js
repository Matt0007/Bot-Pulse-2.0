import { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { getClickUpApiKey, clickUpRequest } from '../../../utils/clickup.js';
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
                    new StringSelectMenuOptionBuilder().setLabel('High').setValue('2'),
                    new StringSelectMenuOptionBuilder().setLabel('Normal').setValue('3'),
                    new StringSelectMenuOptionBuilder().setLabel('Low').setValue('4')
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
            
            const tempEmbed = new EmbedBuilder()
                .setTitle('📋 Sélection de la priorité')
                .setDescription('Choisissez une priorité pour la tâche')
                .setColor(0x5865F2);
            
            await interaction.update({ embeds: [tempEmbed], components: [selectRow, backButton] });
        } else if (selectedValue === 'category') {
            // Afficher immédiatement un message de chargement
            const loadingEmbed = new EmbedBuilder()
                .setTitle('📋 Sélection de la catégorie')
                .setDescription('Chargement des catégories...')
                .setColor(0x5865F2);
            
            await interaction.update({ embeds: [loadingEmbed], components: [] });
            
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
                
                const categorySelect = new StringSelectMenuBuilder()
                    .setCustomId(`tache_add_category_select_${messageId}`)
                    .setPlaceholder('Sélectionner une catégorie...');
                
                categories.forEach(cat => {
                    categorySelect.addOptions(
                        new StringSelectMenuOptionBuilder().setLabel(cat).setValue(cat)
                    );
                });
                
                const selectRow = new ActionRowBuilder().addComponents(categorySelect);
                
                // Ajouter un bouton "Précédent" pour revenir au récapitulatif
                const backButton = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`tache_add_category_back_${messageId}`)
                            .setLabel('← Précédent')
                            .setStyle(ButtonStyle.Secondary)
                    );
                
                // Modifier le message du récapitulatif
                if (taskData.messageId) {
                    try {
                        const channel = await interaction.client.channels.fetch(interaction.channel.id);
                        const message = await channel.messages.fetch(taskData.messageId);
                        
                        const tempEmbed = new EmbedBuilder()
                            .setTitle('📋 Sélection de la catégorie')
                            .setDescription('Choisissez une catégorie pour la tâche')
                            .setColor(0x5865F2);
                        
                        await message.edit({ embeds: [tempEmbed], components: [selectRow, backButton] });
                    } catch (error) {
                        console.error('Erreur lors de la modification du message:', error);
                    }
                }
            } catch (error) {
                console.error('Erreur lors de la récupération des catégories:', error);
                // En cas d'erreur, remettre le récapitulatif
                await updateRecap(interaction, messageId);
            }
        } else if (selectedValue === 'location') {
            // Afficher immédiatement un message de chargement
            const loadingEmbed = new EmbedBuilder()
                .setTitle('📋 Modification de l\'emplacement')
                .setDescription('Chargement des projets...')
                .setColor(0x5865F2);
            
            await interaction.update({ embeds: [loadingEmbed], components: [] });
            
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
                
                // Modifier le message du récapitulatif
                if (taskData.messageId) {
                    try {
                        const channel = await interaction.client.channels.fetch(interaction.channel.id);
                        const message = await channel.messages.fetch(taskData.messageId);
                        
                        const tempEmbed = new EmbedBuilder()
                            .setTitle('📋 Modification de l\'emplacement')
                            .setDescription('Sélectionnez un nouveau projet pour la tâche')
                            .setColor(0x5865F2);
                        
                        await message.edit({ embeds: [tempEmbed], components: [selectRow, backButton] });
                    } catch (error) {
                        console.error('Erreur lors de la modification du message:', error);
                    }
                }
            } catch (error) {
                console.error('Erreur lors de la récupération des projets:', error);
                await updateRecap(interaction, messageId);
            }
        }
    } catch (error) {
        console.error('Erreur lors de la sélection du paramètre:', error);
        await interaction.reply({ content: '❌ Erreur lors de la sélection.', ephemeral: true });
    }
}
