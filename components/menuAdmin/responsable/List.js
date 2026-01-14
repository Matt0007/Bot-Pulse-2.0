import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import prisma from '../../../utils/prisma.js';

export async function responsableList(interaction) {
    try {
        // Récupérer les responsables configurés dans la BDD
        const responsables = await prisma.guildResponsable.findMany({
            where: { guildId: interaction.guild.id },
            include: {
                users: true
            },
            orderBy: {
                responsableName: 'asc'
            }
        });
        
        if (!responsables || responsables.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle('📋 Liste des responsables')
                .setDescription('Aucun responsable configuré.\nUtilisez le bouton "Ajouter" pour configurer un responsable.')
                .setColor(0xFFA500);
            
            const backButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('responsable_button')
                        .setLabel('Retour')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            await interaction.update({ embeds: [embed], components: [backButton] });
            return;
        }
        
        // Construire la liste des responsables avec leurs channels et utilisateurs
        const responsableListPromises = responsables.map(async (responsable, index) => {
            const channelMention = `<#${responsable.channelId}>`;
            const userCount = responsable.users.length;
            
            let usersText = 'Aucun utilisateur';
            if (userCount > 0) {
                // Récupérer les membres Discord à partir des IDs
                const members = [];
                for (const user of responsable.users) {
                    try {
                        const member = await interaction.guild.members.fetch(user.userId);
                        members.push(member.displayName || member.user.username);
                    } catch (error) {
                        // Si l'utilisateur n'est plus sur le serveur, afficher son ID
                        members.push(`<@${user.userId}> (hors serveur)`);
                    }
                }
                const usersList = members.map(name => `   • ${name}`).join('\n');
                usersText = `${userCount} utilisateur(s):\n${usersList}`;
            }
            
            return `**${index + 1}.** ** ${responsable.responsableName}**\n   └ Channel: ${channelMention}\n    ${usersText}`;
        });
        
        const responsableList = await Promise.all(responsableListPromises);
        
        const embed = new EmbedBuilder()
            .setTitle('📋 Liste des responsables')
            .setDescription(responsableList.join('\n\n'))
            .setFooter({ text: `Total: ${responsables.length} responsable(s) configuré(s)` })
            .setColor(0x5865F2);
        
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('responsable_button')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.update({ embeds: [embed], components: [backButton] });
    } catch (error) {
        console.error('Erreur lors de la récupération des responsables:', error);
        
        const embed = new EmbedBuilder()
            .setTitle('❌ Erreur')
            .setDescription(error.message || 'Impossible de récupérer les responsables depuis la base de données.')
            .setColor(0xFF0000);
        
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('responsable_button')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.update({ embeds: [embed], components: [backButton] });
    }
}
