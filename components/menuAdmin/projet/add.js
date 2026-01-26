import { ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { useGetAllProject } from '../../../hook/clickup/useGetAllProject.js';
import prisma from '../../../utils/prisma.js';
import { logAdminAction } from '../../../utils/history.js';
import { createBackButton, createOkButton } from '../../common/buttons.js';
import { createErrorEmbed, createInfoEmbed, createSuccessEmbed, createWarningEmbed } from '../../common/embeds.js';

export async function projetAdd(interaction) {
    try {
        const apiProjects = await useGetAllProject(interaction.guild.id);
        if (!apiProjects || apiProjects.length === 0) {
            await interaction.update({ embeds: [createErrorEmbed('Aucun projet trouvé dans ClickUp.')], components: [createBackButton('projet_button')] });
            return;
        }
        const dbProjects = await prisma.guildProject.findMany({ where: { guildId: interaction.guild.id } });
        const dbProjectIds = new Set(dbProjects.map(p => p.projectId));
        const availableProjects = apiProjects.filter(p => !dbProjectIds.has(p.id));
        if (availableProjects.length === 0) {
            await interaction.update({ embeds: [createWarningEmbed('✅ Tous les projets ajoutés', 'Tous les projets ClickUp sont déjà configurés.')], components: [createOkButton('projet_button')] });
            return;
        }
        const selectOptions = availableProjects.slice(0, 25).map(project => ({
            label: project.name.length > 100 ? project.name.substring(0, 97) + '...' : project.name,
            value: project.id
        }));
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('projet_add_select')
            .setPlaceholder('Sélectionnez un projet à ajouter')
            .addOptions(selectOptions);
        const embed = createInfoEmbed('➕ Ajouter un projet', 'Sélectionnez un projet dans le menu ci-dessous');
        const row = new ActionRowBuilder().addComponents(selectMenu);
        await interaction.update({ embeds: [embed], components: [row, createBackButton('projet_button')] });
    } catch (error) {
        console.error('Erreur lors de l\'ajout d\'un projet:', error);
        await interaction.update({ embeds: [createErrorEmbed(error.message || 'Impossible de charger les projets.')], components: [createBackButton('projet_button')] });
    }
}

export async function projetAddSelect(interaction) {
    try {
        const projectId = interaction.values[0];
        const apiProjects = await useGetAllProject(interaction.guild.id);
        const selectedProject = apiProjects.find(p => p.id === projectId);
        if (!selectedProject) {
            await interaction.update({ embeds: [createErrorEmbed('Projet non trouvé.')], components: [createBackButton('projet_button')] });
            return;
        }
        const existing = await prisma.guildProject.findUnique({
            where: { guildId_projectId: { guildId: interaction.guild.id, projectId } }
        });
        if (existing) {
            await interaction.update({ embeds: [createWarningEmbed('⚠️ Déjà ajouté', `Le projet "${selectedProject.name}" est déjà configuré.`)], components: [createOkButton('projet_button')] });
            return;
        }
        await prisma.guildProject.create({
            data: { guildId: interaction.guild.id, projectId, projectName: selectedProject.name }
        });
        const userName = interaction.user.displayName || interaction.user.username;
        await logAdminAction(interaction.guild.id, interaction.user.id, userName, `Ajouter projet ${selectedProject.name}`);
        await interaction.update({ embeds: [createSuccessEmbed('✅ Projet ajouté', `Le projet "${selectedProject.name}" a été ajouté avec succès.`)], components: [createOkButton('projet_button')] });
    } catch (error) {
        console.error('Erreur lors de l\'ajout du projet:', error);
        await interaction.update({ embeds: [createErrorEmbed('Impossible d\'ajouter le projet.')], components: [createBackButton('projet_button')] });
    }
}
