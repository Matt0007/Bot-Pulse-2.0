import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import prisma from '../../../utils/prisma.js';
import { useGetAllProject } from '../../../hook/clickup/useGetAllProject.js';
import { useGetAllLists } from '../../../hook/clickup/useGetAllLists.js';
import { logAdminAction } from '../../../utils/history.js';

/**
 * Affiche la page principale de sélection de liste
 */
export async function listSelectionButton(interaction) {
    try {
        const guildId = interaction.guild.id;
        
        // Récupérer la liste sélectionnée actuelle
        const guildConfig = await prisma.guildConfig.findUnique({
            where: { guildId }
        });
        
        let description = '';
        if (!guildConfig?.selectedListId || !guildConfig?.selectedListName) {
            description = '**Liste sélectionnée :** Aucun';
        } else {
            const projectInfo = guildConfig.selectedProjectName 
                ? `**Projet :** ${guildConfig.selectedProjectName}\n`
                : '';
            description = `${projectInfo}**Liste :** ${guildConfig.selectedListName}`;
        }
        
        const embed = new EmbedBuilder()
            .setTitle('📋 Sélection de liste d\'ajout')
            .setDescription(description)
            .setColor(0x5865F2);
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('list_selection_modify')
                    .setLabel('Modifier')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('parametre_button')
                    .setLabel('Fermer')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.update({ embeds: [embed], components: [buttons] });
    } catch (error) {
        console.error('Erreur lors de l\'affichage de la sélection de liste:', error);
        
        const embed = new EmbedBuilder()
            .setTitle('❌ Erreur')
            .setDescription('Impossible de charger la sélection de liste.')
            .setColor(0xFF0000);
        
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('parametre_button')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.update({ embeds: [embed], components: [backButton] });
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
            const embed = new EmbedBuilder()
                .setTitle('❌ Aucun projet trouvé')
                .setDescription('Aucun projet trouvé dans ClickUp.')
                .setColor(0xFF0000);
            
            const backButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('list_selection_button')
                        .setLabel('Retour')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            await interaction.update({ embeds: [embed], components: [backButton] });
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
        
        const embed = new EmbedBuilder()
            .setTitle('📋 Sélection de liste d\'ajout - Étape 1')
            .setDescription('Sélectionnez un projet pour voir ses listes')
            .setColor(0x5865F2);
        
        const row = new ActionRowBuilder().addComponents(selectMenu);
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('list_selection_button')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.update({ embeds: [embed], components: [row, backButton] });
    } catch (error) {
        console.error('Erreur lors de la modification de la sélection de liste:', error);
        
        const embed = new EmbedBuilder()
            .setTitle('❌ Erreur')
            .setDescription('Impossible de charger les projets.')
            .setColor(0xFF0000);
        
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('list_selection_button')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.update({ embeds: [embed], components: [backButton] });
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
            const embed = new EmbedBuilder()
                .setTitle('❌ Erreur')
                .setDescription('Projet non trouvé.')
                .setColor(0xFF0000);
            
            const backButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('list_selection_button')
                        .setLabel('Retour')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            await interaction.update({ embeds: [embed], components: [backButton] });
            return;
        }
        
        // Stocker temporairement le projetId dans l'interaction pour la prochaine étape
        // On va utiliser un attribut personnalisé dans le customId
        const customIdWithProject = `list_selection_list_select_${projectId}`;
        
        // Récupérer toutes les listes du projet
        const lists = await useGetAllLists(guildId, projectId);
        
        if (lists.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle('❌ Aucune liste trouvée')
                .setDescription(`Aucune liste trouvée dans le projet "${project.name}".`)
                .setColor(0xFFA500);
            
            const backButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('list_selection_modify')
                        .setLabel('Retour')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            await interaction.update({ embeds: [embed], components: [backButton] });
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
        
        const embed = new EmbedBuilder()
            .setTitle('📋 Sélection de liste d\'ajout - Étape 2')
            .setDescription(`**Projet sélectionné :** ${project.name}\n\nSélectionnez une liste dans le menu ci-dessous`)
            .setColor(0x5865F2);
        
        const row = new ActionRowBuilder().addComponents(selectMenu);
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('list_selection_modify')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.update({ embeds: [embed], components: [row, backButton] });
    } catch (error) {
        console.error('Erreur lors de la sélection de projet:', error);
        
        const embed = new EmbedBuilder()
            .setTitle('❌ Erreur')
            .setDescription(error.message || 'Impossible de charger les listes.')
            .setColor(0xFF0000);
        
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('list_selection_modify')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.update({ embeds: [embed], components: [backButton] });
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
        
        const embed = new EmbedBuilder()
            .setTitle('✅ Liste sélectionnée')
            .setDescription(`**Projet :** ${project.name}\n**Liste :** ${listName}`)
            .setColor(0x00FF00);
        
        const okButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('list_selection_button')
                    .setLabel('OK')
                    .setStyle(ButtonStyle.Success)
            );
        
        await interaction.update({ embeds: [embed], components: [okButton] });
    } catch (error) {
        console.error('Erreur lors de la sauvegarde de la liste:', error);
        
        const embed = new EmbedBuilder()
            .setTitle('❌ Erreur')
            .setDescription('Impossible de sauvegarder la liste sélectionnée.')
            .setColor(0xFF0000);
        
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('list_selection_modify')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.update({ embeds: [embed], components: [backButton] });
    }
}
