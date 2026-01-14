import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { responsableList } from './List.js';

export const responsableHandlers = {
    responsable_button: async (interaction) => {
        const embed = new EmbedBuilder()
            .setTitle('👤 Section Responsable')
            .setDescription('Gestion des responsables')
            .setColor(0x5865F2);
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('responsable_list_button')
                    .setLabel('Liste')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('back_to_main')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.update({ embeds: [embed], components: [buttons] });
    },
    responsable_list_button: responsableList,
};
