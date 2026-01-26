import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import prisma from '../../../utils/prisma.js';
import { useGetAllProject } from '../../../hook/clickup/useGetAllProject.js';
import { useGetAllLists } from '../../../hook/clickup/useGetAllLists.js';
import { logAdminAction } from '../../../utils/history.js';
import { createBackButton, createOkButton } from '../../common/buttons.js';
import { createErrorEmbed, createInfoEmbed, createSuccessEmbed, createWarningEmbed } from '../../common/embeds.js';

/**
 * Affiche la page principale de sélection de liste
 */
export async function listSelectionButton(interaction) {
    try {
        const guildId = interaction.guild.id;
        const guildConfig = await prisma.guildConfig.findUnique({ where: { guildId } });
        let description = '';
        if (!guildConfig?.selectedListId || !guildConfig?.selectedListName) {
            description = '**Liste sélectionnée :** Aucun';
        } else {
            const projectInfo = guildConfig.selectedProjectName ? `**Projet :** ${guildConfig.selectedProjectName}\n` : '';
            description = `${projectInfo}**Liste :** ${guildConfig.selectedListName}`;
        }
        const embed = createInfoEmbed('📋 Sélection de liste d\'ajout', description);
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('list_selection_modify').setLabel('Modifier').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('parametre_button').setLabel('Fermer').setStyle(ButtonStyle.Secondary)
            );
        await interaction.update({ embeds: [embed], components: [buttons] });
    } catch (error) {
        console.error('Erreur lors de l\'affichage de la sélection de liste:', error);
        await interaction.update({ embeds: [createErrorEmbed('Impossible de charger la sélection de liste.')], components: [createBackButton('parametre_button')] });
    }
}

/**
 * Affiche le menu de sélection de projet
 */
export async function listSelectionModify(interaction) {
    try {
        const guildId = interaction.guild.id;
        
        // Récupérer tous les projets depuis l'API ClickUp
        const apiProjects = await useGetAllProject(guildId);
        
        if (!apiProjects || apiProjects.length === 0) {
            await interaction.update({ embeds: [createErrorEmbed('Aucun projet trouvé dans ClickUp.')], components: [createBackButton('list_selection_button')] });
            return;
        }
        
        // Créer le select menu pour les projets (max 25 options)
        const selectOptions = apiProjects.slice(0, 25).map(project => ({
            label: project.name.length > 100 ? project.name.substring(0, 97) + '...' : project.name,
            value: project.id
        }));
        
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('list_selection_project_select')
            .setPlaceholder('Sélectionnez un projet')
            .addOptions(selectOptions);
        
        const embed = createInfoEmbed('📋 Sélection de liste d\'ajout - Étape 1', 'Sélectionnez un projet pour voir ses listes');
        const row = new ActionRowBuilder().addComponents(selectMenu);
        await interaction.update({ embeds: [embed], components: [row, createBackButton('list_selection_button')] });
    } catch (error) {
        console.error('Erreur lors de la modification de la sélection de liste:', error);
        await interaction.update({ embeds: [createErrorEmbed('Impossible de charger les projets.')], components: [createBackButton('list_selection_button')] });
    }
}

/**
 * Affiche le menu de sélection de liste pour le projet choisi
 */
export async function listSelectionProjectSelect(interaction) {
    try {
        const guildId = interaction.guild.id;
        const projectId = interaction.values[0];
        
        // Récupérer le nom du projet depuis l'API ClickUp
        const apiProjects = await useGetAllProject(guildId);
        const project = apiProjects.find(p => p.id === projectId);
        
        if (!project) {
            await interaction.update({ embeds: [createErrorEmbed('Projet non trouvé.')], components: [createBackButton('list_selection_button')] });
            return;
        }
        
        // Stocker temporairement le projetId dans l'interaction pour la prochaine étape
        // On va utiliser un attribut personnalisé dans le customId
        const customIdWithProject = `list_selection_list_select_${projectId}`;
        
        // Récupérer toutes les listes du projet
        const lists = await useGetAllLists(guildId, projectId);
        
        if (lists.length === 0) {
            await interaction.update({ embeds: [createWarningEmbed('❌ Aucune liste trouvée', `Aucune liste trouvée dans le projet "${project.name}".`)], components: [createBackButton('list_selection_modify')] });
            return;
        }
        
        // Créer le select menu pour les listes (max 25 options)
        const selectOptions = lists.slice(0, 25).map(list => {
            const displayName = list.folderName 
                ? `${list.name} (${list.folderName})`
                : list.name;
            return {
                label: displayName.length > 100 ? displayName.substring(0, 97) + '...' : displayName,
                value: `${list.id}_${projectId}` // Inclure le projectId dans la valeur
            };
        });
        
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('list_selection_list_select')
            .setPlaceholder('Sélectionnez une liste')
            .addOptions(selectOptions);
        
        const embed = createInfoEmbed('📋 Sélection de liste d\'ajout - Étape 2', `**Projet sélectionné :** ${project.name}\n\nSélectionnez une liste dans le menu ci-dessous`);
        const row = new ActionRowBuilder().addComponents(selectMenu);
        await interaction.update({ embeds: [embed], components: [row, createBackButton('list_selection_modify')] });
    } catch (error) {
        console.error('Erreur lors de la sélection de projet:', error);
        await interaction.update({ embeds: [createErrorEmbed(error.message || 'Impossible de charger les listes.')], components: [createBackButton('list_selection_modify')] });
    }
}

/**
 * Sauvegarde la liste sélectionnée
 */
export async function listSelectionListSelect(interaction) {
    try {
        const guildId = interaction.guild.id;
        const value = interaction.values[0];
        
        // La valeur contient listId_projectId
        const [listId, projectId] = value.split('_');
        
        // Récupérer le projet depuis l'API ClickUp
        const apiProjects = await useGetAllProject(guildId);
        const project = apiProjects.find(p => p.id === projectId);
        
        if (!project) {
            throw new Error('Projet non trouvé');
        }
        
        // Récupérer les informations de la liste
        const lists = await useGetAllLists(guildId, projectId);
        const selectedList = lists.find(l => l.id === listId);
        
        if (!selectedList) {
            throw new Error('Liste non trouvée');
        }
        
        const listName = selectedList.folderName 
            ? `${selectedList.name} (${selectedList.folderName})`
            : selectedList.name;
        
        // Vérifier si une liste était déjà sélectionnée
        const currentConfig = await prisma.guildConfig.findUnique({
            where: { guildId }
        });
        
        const isFirstSelection = !currentConfig?.selectedListId;
        
        // Mettre à jour ou créer la configuration
        await prisma.guildConfig.upsert({
            where: { guildId },
            update: {
                selectedListId: listId,
                selectedListName: listName,
                selectedProjectId: projectId,
                selectedProjectName: project.name
            },
            create: {
                guildId,
                selectedListId: listId,
                selectedListName: listName,
                selectedProjectId: projectId,
                selectedProjectName: project.name
            }
        });
        
        // Enregistrer dans l'historique admin
        const userName = interaction.user.displayName || interaction.user.username;
        const actionText = isFirstSelection 
            ? `Sélectionner liste d'ajout: ${listName} (Projet: ${project.name})`
            : `Changement liste d'ajout: ${listName} (Projet: ${project.name})`;
        await logAdminAction(guildId, interaction.user.id, userName, actionText);
        
        const embed = createSuccessEmbed('✅ Liste sélectionnée', `**Projet :** ${project.name}\n**Liste :** ${listName}`);
        await interaction.update({ embeds: [embed], components: [createOkButton('list_selection_button')] });
    } catch (error) {
        console.error('Erreur lors de la sauvegarde de la liste:', error);
        await interaction.update({ embeds: [createErrorEmbed('Impossible de sauvegarder la liste sélectionnée.')], components: [createBackButton('list_selection_modify')] });
    }
}
