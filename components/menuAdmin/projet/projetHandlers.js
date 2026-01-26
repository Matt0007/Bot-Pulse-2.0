import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import prisma from '../../../utils/prisma.js';
import { createBackButton } from '../../common/buttons.js';
import { createErrorEmbed, createInfoEmbed, createWarningEmbed } from '../../common/embeds.js';
import { projetAdd, projetAddSelect } from './add.js';
import { projetRemove, projetRemoveSelect } from './remove.js';

export const projetHandlers = {
    projet_button: async (interaction) => {
        try {
            const projects = await prisma.guildProject.findMany({
                where: { guildId: interaction.guild.id },
                orderBy: { projectName: 'asc' }
            });
            let embed;
            if (!projects || projects.length === 0) {
                embed = createWarningEmbed('📁 Section Projet', 'Aucun projet configuré.\nUtilisez le bouton "Ajouter" pour ajouter un projet.');
            } else {
                const projectList = projects.map((project, index) => `**${index + 1}.** ${project.projectName}`).join('\n');
                embed = createInfoEmbed('📁 Section Projet', projectList).setFooter({ text: `Total: ${projects.length} projet(s) configuré(s)` });
            }
            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('projet_add_button').setLabel('Ajouter').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('projet_remove_button').setLabel('Retirer').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('back_to_main').setLabel('Retour').setStyle(ButtonStyle.Secondary)
                );
            await interaction.update({ embeds: [embed], components: [buttons] });
        } catch (error) {
            console.error('Erreur lors de la récupération des projets:', error);
            await interaction.update({ embeds: [createErrorEmbed('Impossible de récupérer les projets.')], components: [createBackButton('back_to_main')] });
        }
    },
    projet_add_button: projetAdd,
    projet_add_select: projetAddSelect,
    projet_remove_button: projetRemove,
    projet_remove_select: projetRemoveSelect,
};
