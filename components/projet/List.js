import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import prisma from '../../utils/prisma.js';

export async function projetList(interaction) {
    try {
        const projects = await prisma.guildProject.findMany({
            where: { guildId: interaction.guild.id },
            orderBy: { projectName: 'asc' }
        });
        
        if (!projects || projects.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle('📋 Liste des projets')
                .setDescription('Aucun projet configuré.\nUtilisez le bouton "Ajouter" pour ajouter un projet.')
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
        
        // Construire la liste des projets
        const projectList = projects
            .map((project, index) => `**${index + 1}.** ${project.projectName}`)
            .join('\n');
        
        const embed = new EmbedBuilder()
            .setTitle('📋 Liste des projets')
            .setDescription(projectList)
            .setFooter({ text: `Total: ${projects.length} projet(s) configuré(s)` })
            .setColor(0x5865F2);
        
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('projet_button')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.update({ embeds: [embed], components: [backButton] });
    } catch (error) {
        console.error('Erreur lors de la récupération des projets:', error);
        
        const embed = new EmbedBuilder()
            .setTitle('❌ Erreur')
            .setDescription('Impossible de récupérer les projets.')
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
