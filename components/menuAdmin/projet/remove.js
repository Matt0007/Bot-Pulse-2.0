import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import prisma from '../../../utils/prisma.js';
import { logAdminAction } from '../../../utils/history.js';

export async function projetRemove(interaction) {
    try {
        // Récupérer les projets dans la BDD
        const dbProjects = await prisma.guildProject.findMany({
            where: { guildId: interaction.guild.id },
            orderBy: { projectName: 'asc' }
        });
        
        if (dbProjects.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle('➖ Retirer un projet')
                .setDescription('Aucun projet configuré.')
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
        const selectOptions = dbProjects.slice(0, 25).map(project => ({
            label: project.projectName.length > 100 ? project.projectName.substring(0, 97) + '...' : project.projectName,
            value: project.id,
            description: `ID: ${project.projectId}`
        }));
        
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('projet_remove_select')
            .setPlaceholder('Sélectionnez un projet à retirer')
            .addOptions(selectOptions);
        
        const embed = new EmbedBuilder()
            .setTitle('➖ Retirer un projet')
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
        console.error('Erreur lors de la suppression d\'un projet:', error);
        
        const embed = new EmbedBuilder()
            .setTitle('❌ Erreur')
            .setDescription('Impossible de charger les projets.')
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

export async function projetRemoveSelect(interaction) {
    try {
        const projectDbId = interaction.values[0];
        
        // Récupérer le projet
        const project = await prisma.guildProject.findUnique({
            where: { id: projectDbId }
        });
        
        if (!project) {
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
        
        // Supprimer le projet
        await prisma.guildProject.delete({
            where: { id: projectDbId }
        });
        
        const userName = interaction.user.displayName || interaction.user.username;
        await logAdminAction(interaction.guild.id, interaction.user.id, userName, `Retirer projet ${project.projectName}`);
        
        const embed = new EmbedBuilder()
            .setTitle('✅ Projet retiré')
            .setDescription(`Le projet "${project.projectName}" a été retiré avec succès.`)
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
        console.error('Erreur lors de la suppression du projet:', error);
        
        const embed = new EmbedBuilder()
            .setTitle('❌ Erreur')
            .setDescription('Impossible de retirer le projet.')
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
