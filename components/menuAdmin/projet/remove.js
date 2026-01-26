import { ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import prisma from '../../../utils/prisma.js';
import { logAdminAction } from '../../../utils/history.js';
import { createBackButton, createOkButton } from '../../common/buttons.js';
import { createErrorEmbed, createInfoEmbed, createSuccessEmbed, createWarningEmbed } from '../../common/embeds.js';

export async function projetRemove(interaction) {
    try {
        const dbProjects = await prisma.guildProject.findMany({
            where: { guildId: interaction.guild.id },
            orderBy: { projectName: 'asc' }
        });
        if (dbProjects.length === 0) {
            await interaction.update({ embeds: [createWarningEmbed('➖ Retirer un projet', 'Aucun projet configuré.')], components: [createOkButton('projet_button')] });
            return;
        }
        const selectOptions = dbProjects.slice(0, 25).map(project => ({
            label: project.projectName.length > 100 ? project.projectName.substring(0, 97) + '...' : project.projectName,
            value: project.id
        }));
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('projet_remove_select')
            .setPlaceholder('Sélectionnez un projet à retirer')
            .addOptions(selectOptions);
        const embed = createInfoEmbed('➖ Retirer un projet', 'Sélectionnez un projet dans le menu ci-dessous');
        const row = new ActionRowBuilder().addComponents(selectMenu);
        await interaction.update({ embeds: [embed], components: [row, createBackButton('projet_button')] });
    } catch (error) {
        console.error('Erreur lors de la suppression d\'un projet:', error);
        await interaction.update({ embeds: [createErrorEmbed('Impossible de charger les projets.')], components: [createBackButton('projet_button')] });
    }
}

export async function projetRemoveSelect(interaction) {
    try {
        const projectDbId = interaction.values[0];
        const project = await prisma.guildProject.findUnique({ where: { id: projectDbId } });
        if (!project) {
            await interaction.update({ embeds: [createErrorEmbed('Projet non trouvé.')], components: [createBackButton('projet_button')] });
            return;
        }
        await prisma.guildProject.delete({ where: { id: projectDbId } });
        const userName = interaction.user.displayName || interaction.user.username;
        await logAdminAction(interaction.guild.id, interaction.user.id, userName, `Retirer projet ${project.projectName}`);
        await interaction.update({ embeds: [createSuccessEmbed('✅ Projet retiré', `Le projet "${project.projectName}" a été retiré avec succès.`)], components: [createOkButton('projet_button')] });
    } catch (error) {
        console.error('Erreur lors de la suppression du projet:', error);
        await interaction.update({ embeds: [createErrorEmbed('Impossible de retirer le projet.')], components: [createBackButton('projet_button')] });
    }
}
