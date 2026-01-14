import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { useGetAllProject } from '../../../hook/clickup/useGetAllProject.js';
import prisma from '../../../utils/prisma.js';

export async function projetAdd(interaction) {
    try {
        // Récupérer tous les projets depuis l'API ClickUp
        const apiProjects = await useGetAllProject(interaction.guild.id);
        
        if (!apiProjects || apiProjects.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle('❌ Erreur')
                .setDescription('Aucun projet trouvé dans ClickUp.')
                .setColor(0xFF0000);
            
            const backButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('projet_button')
                        .setLabel('Retour')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            await interaction.update({ embeds: [embed], components: [backButton] });
            return;
        }
        
        // Récupérer les projets déjà dans la BDD
        const dbProjects = await prisma.guildProject.findMany({
            where: { guildId: interaction.guild.id }
        });
        
        const dbProjectIds = new Set(dbProjects.map(p => p.projectId));
        
        // Filtrer les projets qui ne sont pas déjà dans la BDD
        const availableProjects = apiProjects.filter(p => !dbProjectIds.has(p.id));
        
        if (availableProjects.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle('✅ Tous les projets ajoutés')
                .setDescription('Tous les projets ClickUp sont déjà configurés.')
                .setColor(0xFFA500);
            
            const backButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('projet_button')
                        .setLabel('Retour')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            await interaction.update({ embeds: [embed], components: [backButton] });
            return;
        }
        
        // Créer le select menu (max 25 options)
        const selectOptions = availableProjects.slice(0, 25).map(project => ({
            label: project.name.length > 100 ? project.name.substring(0, 97) + '...' : project.name,
            value: project.id,
            description: `ID: ${project.id}`
        }));
        
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('projet_add_select')
            .setPlaceholder('Sélectionnez un projet à ajouter')
            .addOptions(selectOptions);
        
        const embed = new EmbedBuilder()
            .setTitle('➕ Ajouter un projet')
            .setDescription('Sélectionnez un projet dans le menu ci-dessous')
            .setColor(0x5865F2);
        
        const row = new ActionRowBuilder().addComponents(selectMenu);
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('projet_button')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.update({ embeds: [embed], components: [row, backButton] });
    } catch (error) {
        console.error('Erreur lors de l\'ajout d\'un projet:', error);
        
        const embed = new EmbedBuilder()
            .setTitle('❌ Erreur')
            .setDescription(error.message || 'Impossible de charger les projets.')
            .setColor(0xFF0000);
        
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('projet_button')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.update({ embeds: [embed], components: [backButton] });
    }
}

export async function projetAddSelect(interaction) {
    try {
        const projectId = interaction.values[0];
        
        // Récupérer le nom du projet depuis l'API
        const apiProjects = await useGetAllProject(interaction.guild.id);
        const selectedProject = apiProjects.find(p => p.id === projectId);
        
        if (!selectedProject) {
            const embed = new EmbedBuilder()
                .setTitle('❌ Erreur')
                .setDescription('Projet non trouvé.')
                .setColor(0xFF0000);
            
            const backButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('projet_button')
                        .setLabel('Retour')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            await interaction.update({ embeds: [embed], components: [backButton] });
            return;
        }
        
        // Vérifier si le projet existe déjà
        const existing = await prisma.guildProject.findUnique({
            where: {
                guildId_projectId: {
                    guildId: interaction.guild.id,
                    projectId: projectId
                }
            }
        });
        
        if (existing) {
            const embed = new EmbedBuilder()
                .setTitle('⚠️ Déjà ajouté')
                .setDescription(`Le projet "${selectedProject.name}" est déjà configuré.`)
                .setColor(0xFFA500);
            
            const backButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('projet_button')
                        .setLabel('Retour')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            await interaction.update({ embeds: [embed], components: [backButton] });
            return;
        }
        
        // Ajouter le projet dans la BDD
        await prisma.guildProject.create({
            data: {
                guildId: interaction.guild.id,
                projectId: projectId,
                projectName: selectedProject.name
            }
        });
        
        const embed = new EmbedBuilder()
            .setTitle('✅ Projet ajouté')
            .setDescription(`Le projet "${selectedProject.name}" a été ajouté avec succès.`)
            .setColor(0x00FF00);
        
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('projet_button')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.update({ embeds: [embed], components: [backButton] });
    } catch (error) {
        console.error('Erreur lors de l\'ajout du projet:', error);
        
        const embed = new EmbedBuilder()
            .setTitle('❌ Erreur')
            .setDescription('Impossible d\'ajouter le projet.')
            .setColor(0xFF0000);
        
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('projet_button')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.update({ embeds: [embed], components: [backButton] });
    }
}
