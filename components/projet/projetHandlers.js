import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { projetList } from './List.js';
import { projetAdd, projetAddSelect } from './add.js';
import { projetRemove, projetRemoveSelect } from './remove.js';

export const projetHandlers = {
    projet_button: async (interaction) => {
        const embed = new EmbedBuilder()
            .setTitle('📁 Section Projet')
            .setDescription('Gestion des projets')
            .setColor(0x5865F2);
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('projet_list_button')
                    .setLabel('Liste')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('projet_add_button')
                    .setLabel('Ajouter')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('projet_remove_button')
                    .setLabel('Retirer')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('back_to_main')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.update({ embeds: [embed], components: [buttons] });
    },
    projet_list_button: projetList,
    projet_add_button: projetAdd,
    projet_add_select: projetAddSelect,
    projet_remove_button: projetRemove,
    projet_remove_select: projetRemoveSelect,
};
