import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { useGetAllProject } from '../../../hook/clickup/useGetAllProject.js';
import { useGetAllLists } from '../../../hook/clickup/useGetAllLists.js';
import { createErrorEmbed, createInfoEmbed } from '../../common/embeds.js';
import { taskDataCache, updateRecap } from '../add.js';
import { showCategoryStepOrRecap } from './modal.js';

/** Affiche l'écran de sélection des projets (interaction déjà defer). */
async function showProjectSelectScreen(interaction, messageId, { embedDescription, backCustomId }) {
    const guildId = interaction.guild.id;
    await interaction.editReply({ embeds: [createInfoEmbed('📋 Emplacement / liste', 'Chargement des projets...')], components: [] });
    const apiProjects = await useGetAllProject(guildId);
    if (!apiProjects?.length) {
        await interaction.editReply({ embeds: [createErrorEmbed('Aucun projet trouvé.')] });
        return;
    }
    const selectOptions = apiProjects.slice(0, 25).map(p => ({
        label: p.name.length > 100 ? p.name.substring(0, 97) + '...' : p.name,
        value: p.id
    }));
    const projectSelect = new StringSelectMenuBuilder()
        .setCustomId(`tache_add_location_project_${messageId}`)
        .setPlaceholder('Sélectionnez un projet')
        .addOptions(selectOptions);
    const selectRow = new ActionRowBuilder().addComponents(projectSelect);
    const backButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${backCustomId}${messageId}`).setLabel('← Précédent').setStyle(ButtonStyle.Secondary)
    );
    await interaction.editReply({ embeds: [createInfoEmbed('📋 Emplacement / liste', embedDescription)], components: [selectRow, backButton] });
}

/** Affiche l'écran de sélection des listes pour un projet (interaction déjà defer). */
async function showListSelectScreen(interaction, messageId, projectId, { embedDescription, backCustomId }) {
    const guildId = interaction.guild.id;
    await interaction.editReply({ embeds: [createInfoEmbed('📋 Emplacement / liste', 'Chargement des listes...')], components: [] });
    const apiProjects = await useGetAllProject(guildId);
    const project = apiProjects?.find(p => p.id === projectId);
    if (!project) {
        await interaction.editReply({ embeds: [createErrorEmbed('Projet non trouvé.')] });
        return;
    }
    const lists = await useGetAllLists(guildId, projectId);
    if (!lists.length) {
        await interaction.editReply({ embeds: [createErrorEmbed('Aucune liste dans ce projet.')] });
        return;
    }
    const selectOptions = lists.slice(0, 25).map(list => {
        const displayName = list.folderName ? `${list.name} (${list.folderName})` : list.name;
        return { label: displayName.length > 100 ? displayName.substring(0, 97) + '...' : displayName, value: list.id };
    });
    const listSelect = new StringSelectMenuBuilder()
        .setCustomId(`tache_add_location_list_${messageId}`)
        .setPlaceholder('Sélectionnez une liste')
        .addOptions(selectOptions);
    const selectRow = new ActionRowBuilder().addComponents(listSelect);
    const backButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${backCustomId}${messageId}`).setLabel('← Précédent').setStyle(ButtonStyle.Secondary)
    );
    await interaction.editReply({ embeds: [createInfoEmbed('📋 Emplacement / liste', embedDescription)], components: [selectRow, backButton] });
}

/**
 * Gère la sélection du projet pour modifier l'emplacement
 */
export async function tacheAddLocationProjectSelect(interaction) {
    try {
        await interaction.deferUpdate();
        const messageId = interaction.customId.replace('tache_add_location_project_', '');
        const projectId = interaction.values[0];
        const taskData = taskDataCache.get(messageId);
        if (!taskData || !taskData.messageId) {
            await interaction.editReply({ embeds: [createErrorEmbed('Session expirée. Veuillez recommencer.')], components: [] });
            return;
        }
        const apiProjects = await useGetAllProject(interaction.guild.id);
        const project = apiProjects?.find(p => p.id === projectId);
        if (!project) {
            await updateRecap(interaction, messageId);
            return;
        }
        taskData.tempProjectId = projectId;
        taskDataCache.set(messageId, taskData);
        await showListSelectScreen(interaction, messageId, projectId, {
            embedDescription: `**Projet sélectionné :** ${project.name}\n\nSélectionnez une liste dans le menu ci-dessous`,
            backCustomId: 'tache_add_location_back_'
        });
    } catch (error) {
        console.error('Erreur lors de la sélection du projet:', error);
        await interaction.editReply({ embeds: [createErrorEmbed('Erreur lors de la sélection du projet. Veuillez réessayer.')], components: [] }).catch(() => {});
    }
}

/**
 * Gère la sélection de la liste pour modifier l'emplacement
 */
export async function tacheAddLocationListSelect(interaction) {
    try {
        // Différer l'interaction immédiatement pour éviter l'expiration
        await interaction.deferUpdate();
        
        const customId = interaction.customId;
        // Format: tache_add_location_list_{messageId}
        const messageId = customId.replace('tache_add_location_list_', '');
        
        const listId = interaction.values[0];
        
        const taskData = taskDataCache.get(messageId);
        if (!taskData || !taskData.messageId) {
            console.error('TaskData non trouvé pour messageId:', messageId);
            await interaction.editReply({ embeds: [createErrorEmbed('Session expirée. Veuillez recommencer.')], components: [] });
            return;
        }
        const loadingEmbed = createInfoEmbed('📋 Modification de l\'emplacement', 'Mise à jour de l\'emplacement...');
        await interaction.editReply({ embeds: [loadingEmbed], components: [] });
        
        // Récupérer le projectId depuis le cache (stocké temporairement)
        const projectId = taskData.tempProjectId;
        if (!projectId) {
            console.error('ProjectId temporaire non trouvé dans le cache');
            await updateRecap(interaction, messageId);
            return;
        }
        
        // Récupérer le nom du projet et de la liste
        const guildId = interaction.guild.id;
        const apiProjects = await useGetAllProject(guildId);
        const project = apiProjects.find(p => p.id === projectId);
        
        const lists = await useGetAllLists(guildId, projectId);
        const selectedList = lists.find(l => l.id === listId);
        
        if (!project || !selectedList) {
            console.error('Projet ou liste non trouvé:', { projectId, listId, project, selectedList });
            await updateRecap(interaction, messageId);
            return;
        }
        
        // Mettre à jour le cache avec le nouvel emplacement
        const listName = selectedList.folderName 
            ? `${selectedList.name} (${selectedList.folderName})`
            : selectedList.name;
        
        taskData.listId = listId;
        taskData.listName = listName;
        taskData.projectId = projectId;
        taskData.projectName = project.name;
        delete taskData.tempProjectId;
        
        // Flux initial ou retour catégorie : afficher catégories de cette liste
        if (taskData.initialLocationStep || taskData.returningFromCategoryStep) {
            delete taskData.initialLocationStep;
            delete taskData.returningFromCategoryStep;
            taskDataCache.set(messageId, taskData);
            await showCategoryStepOrRecap(interaction, messageId);
            return;
        }
        
        taskDataCache.set(messageId, taskData);
        await updateRecap(interaction, messageId);
    } catch (error) {
        console.error('Erreur lors de la sélection de la liste:', error);
        try {
            await interaction.editReply({ embeds: [createErrorEmbed('Erreur lors de la sélection de la liste. Veuillez réessayer.')], components: [] });
        } catch (replyError) {
            console.error('Erreur lors de la réponse:', replyError);
        }
    }
}

/**
 * Affiche le sélecteur de liste pour le projet actuel (retour catégorie → liste)
 */
export async function showListSelectForProject(interaction, messageId) {
    const taskData = taskDataCache.get(messageId);
    if (!taskData?.projectId || !taskData.messageId) return;
    await interaction.deferUpdate().catch(() => {});
    const backCustomId = taskData.backFromCategoryList ? 'tache_add_location_back_to_project_' : 'tache_add_location_back_';
    await showListSelectScreen(interaction, messageId, taskData.projectId, {
        embedDescription: `**Projet :** ${taskData.projectName || '…'}\n\nChoisissez une liste (ou Précédent pour changer de projet).`,
        backCustomId
    });
}

/**
 * Retour de l'étape catégorie vers le choix de liste
 */
export async function tacheAddCategoryBackToList(interaction) {
    try {
        const messageId = interaction.customId.replace('tache_add_category_back_to_list_', '');
        const taskData = taskDataCache.get(messageId);
        if (!taskData || !taskData.projectId) {
            await interaction.reply({ content: '❌ Session expirée.', ephemeral: true });
            return;
        }
        taskData.backFromCategoryList = true;
        taskData.returningFromCategoryStep = true;
        taskDataCache.set(messageId, taskData);
        await showListSelectForProject(interaction, messageId);
    } catch (error) {
        console.error('Erreur retour catégorie → liste:', error);
        await interaction.reply({ content: '❌ Erreur.', ephemeral: true }).catch(() => {});
    }
}

/**
 * Retour de l'écran liste vers l'écran projet (quand on vient de la catégorie)
 */
export async function tacheAddLocationBackToProject(interaction) {
    try {
        await interaction.deferUpdate();
        const messageId = interaction.customId.replace('tache_add_location_back_to_project_', '');
        const taskData = taskDataCache.get(messageId);
        if (!taskData || !taskData.messageId) {
            await interaction.editReply({ embeds: [createErrorEmbed('Session expirée.')], components: [] });
            return;
        }
        await showProjectSelectScreen(interaction, messageId, {
            embedDescription: 'Choisissez un projet (ou Précédent pour revenir à la catégorie).',
            backCustomId: 'tache_add_location_back_'
        });
    } catch (error) {
        console.error('Erreur retour liste → projet:', error);
        await interaction.editReply({ embeds: [createErrorEmbed('Erreur.')], components: [] }).catch(() => {});
    }
}

/**
 * Gère le bouton "Retour" pour revenir à la sélection du projet ou au récapitulatif
 */
export async function tacheAddLocationBack(interaction) {
    try {
        // Différer l'interaction immédiatement pour éviter l'expiration
        await interaction.deferUpdate();
        
        const customId = interaction.customId;
        const messageId = customId.replace('tache_add_location_back_', '');
        
        const taskData = taskDataCache.get(messageId);
        if (!taskData || !taskData.messageId) {
            await interaction.editReply({ embeds: [createErrorEmbed('Session expirée. Veuillez recommencer.')], components: [] });
            return;
        }
        if (taskData.backFromCategoryList) {
            delete taskData.backFromCategoryList;
            taskDataCache.set(messageId, taskData);
            await showCategoryStepOrRecap(interaction, messageId);
            return;
        }
        if (taskData.tempProjectId) {
            delete taskData.tempProjectId;
            taskDataCache.set(messageId, taskData);
            await showProjectSelectScreen(interaction, messageId, {
                embedDescription: 'Sélectionnez un nouveau projet pour la tâche',
                backCustomId: 'tache_add_location_back_'
            });
        } else {
            const loadingEmbed = createInfoEmbed('📋 Récapitulatif de la tâche', 'Chargement...');
            await interaction.editReply({ embeds: [loadingEmbed], components: [] });
            
            // Remettre le récapitulatif à jour
            await updateRecap(interaction, messageId);
        }
    } catch (error) {
        console.error('Erreur lors du retour:', error);
        
        await interaction.editReply({ embeds: [createErrorEmbed('Erreur lors du retour. Veuillez réessayer.')], components: [] });
    }
}
