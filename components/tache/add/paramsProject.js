import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { useGetAllProject } from '../../../hook/clickup/useGetAllProject.js';
import { useGetAllLists } from '../../../hook/clickup/useGetAllLists.js';
import { taskDataCache, updateRecap } from '../add.js';

/**
 * Gère la sélection du projet pour modifier l'emplacement
 */
export async function tacheAddLocationProjectSelect(interaction) {
    try {
        const customId = interaction.customId;
        const messageId = customId.replace('tache_add_location_project_', '');
        const projectId = interaction.values[0];
        
        const taskData = taskDataCache.get(messageId);
        if (!taskData || !taskData.messageId) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Erreur')
                .setDescription('Session expirée. Veuillez recommencer.')
                .setColor(0xFF0000);
            await interaction.update({ embeds: [errorEmbed], components: [] });
            return;
        }
        
        // Afficher immédiatement un message de chargement
        const loadingEmbed = new EmbedBuilder()
            .setTitle('📋 Modification de l\'emplacement')
            .setDescription('Chargement des listes...')
            .setColor(0x5865F2);
        
        await interaction.update({ embeds: [loadingEmbed], components: [] });
        
        // Récupérer le nom du projet
        const guildId = interaction.guild.id;
        const apiProjects = await useGetAllProject(guildId);
        const project = apiProjects.find(p => p.id === projectId);
        
        if (!project) {
            await updateRecap(interaction, messageId);
            return;
        }
        
        // Récupérer toutes les listes du projet
        const lists = await useGetAllLists(guildId, projectId);
        
        if (lists.length === 0) {
            // Si pas de listes, remettre le récapitulatif
            await updateRecap(interaction, messageId);
            return;
        }
        
        // Stocker temporairement le projectId dans le cache pour la prochaine étape
        taskData.tempProjectId = projectId;
        taskDataCache.set(messageId, taskData);
        
        // Créer le select menu pour les listes (max 25 options)
        const selectOptions = lists.slice(0, 25).map(list => {
            const displayName = list.folderName 
                ? `${list.name} (${list.folderName})`
                : list.name;
            return {
                label: displayName.length > 100 ? displayName.substring(0, 97) + '...' : displayName,
                value: list.id
            };
        });
        
        const listSelect = new StringSelectMenuBuilder()
            .setCustomId(`tache_add_location_list_${messageId}`)
            .setPlaceholder('Sélectionnez une liste')
            .addOptions(selectOptions);
        
        const selectRow = new ActionRowBuilder().addComponents(listSelect);
        
        // Ajouter un bouton "Précédent" pour revenir à la sélection du projet
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
                    .setDescription(`**Projet sélectionné :** ${project.name}\n\nSélectionnez une liste dans le menu ci-dessous`)
                    .setColor(0x5865F2);
                
                await message.edit({ embeds: [tempEmbed], components: [selectRow, backButton] });
            } catch (error) {
                console.error('Erreur lors de la modification du message:', error);
            }
        }
    } catch (error) {
        console.error('Erreur lors de la sélection du projet:', error);
    }
}

/**
 * Gère la sélection de la liste pour modifier l'emplacement
 */
export async function tacheAddLocationListSelect(interaction) {
    try {
        const customId = interaction.customId;
        // Format: tache_add_location_list_{messageId}
        const messageId = customId.replace('tache_add_location_list_', '');
        
        const listId = interaction.values[0];
        
        const taskData = taskDataCache.get(messageId);
        if (!taskData || !taskData.messageId) {
            console.error('TaskData non trouvé pour messageId:', messageId);
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Erreur')
                .setDescription('Session expirée. Veuillez recommencer.')
                .setColor(0xFF0000);
            await interaction.update({ embeds: [errorEmbed], components: [] });
            return;
        }
        
        // Afficher immédiatement un message de chargement
        const loadingEmbed = new EmbedBuilder()
            .setTitle('📋 Modification de l\'emplacement')
            .setDescription('Mise à jour de l\'emplacement...')
            .setColor(0x5865F2);
        
        await interaction.update({ embeds: [loadingEmbed], components: [] });
        
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
        // Supprimer le projectId temporaire
        delete taskData.tempProjectId;
        
        taskDataCache.set(messageId, taskData);
        
        // Remettre le récapitulatif à jour
        await updateRecap(interaction, messageId);
    } catch (error) {
        console.error('Erreur lors de la sélection de la liste:', error);
    }
}

/**
 * Gère le bouton "Retour" pour revenir à la sélection du projet ou au récapitulatif
 */
export async function tacheAddLocationBack(interaction) {
    try {
        const customId = interaction.customId;
        const messageId = customId.replace('tache_add_location_back_', '');
        
        const taskData = taskDataCache.get(messageId);
        if (!taskData || !taskData.messageId) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Erreur')
                .setDescription('Session expirée. Veuillez recommencer.')
                .setColor(0xFF0000);
            await interaction.update({ embeds: [errorEmbed], components: [] });
            return;
        }
        
        // Si on a un tempProjectId, on est sur la sélection de liste, donc on revient à la sélection de projet
        if (taskData.tempProjectId) {
            // Afficher immédiatement un message de chargement
            const loadingEmbed = new EmbedBuilder()
                .setTitle('📋 Modification de l\'emplacement')
                .setDescription('Chargement des projets...')
                .setColor(0x5865F2);
            
            await interaction.update({ embeds: [loadingEmbed], components: [] });
            
            // Supprimer le projectId temporaire
            delete taskData.tempProjectId;
            taskDataCache.set(messageId, taskData);
            
            // Récupérer tous les projets
            const guildId = interaction.guild.id;
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
        } else {
            // Sinon, on est sur la sélection de projet, donc on revient au récapitulatif
            const loadingEmbed = new EmbedBuilder()
                .setTitle('📋 Récapitulatif de la tâche')
                .setDescription('Chargement...')
                .setColor(0x5865F2);
            
            await interaction.update({ embeds: [loadingEmbed], components: [] });
            
            // Remettre le récapitulatif à jour
            await updateRecap(interaction, messageId);
        }
    } catch (error) {
        console.error('Erreur lors du retour:', error);
    }
}
