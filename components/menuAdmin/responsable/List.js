import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { useGetAllResponsable } from '../../../hook/clickup/useGetAllResponsable.js';

export async function responsableList(interaction) {
    try {
        const responsables = await useGetAllResponsable(interaction.guild.id);
        
        if (!responsables || responsables.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle('📋 Liste des responsables')
                .setDescription('Aucun responsable trouvé dans ClickUp.\nVérifiez que le champ personnalisé "Responsable" est configuré dans votre workspace ClickUp.')
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
        
        // Construire la liste des responsables
        const responsableList = responsables
            .map((responsable, index) => `**${index + 1}.** ${responsable}`)
            .join('\n');
        
        const embed = new EmbedBuilder()
            .setTitle('📋 Liste des responsables')
            .setDescription(responsableList)
            .setFooter({ text: `Total: ${responsables.length} responsable(s) trouvé(s) dans ClickUp` })
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
            .setDescription(error.message || 'Impossible de récupérer les responsables depuis ClickUp.\nVérifiez que la clé API ClickUp est configurée.')
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
