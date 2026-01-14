import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { adminList } from './List.js';
import { adminAdd, adminAddSelect } from './add.js';
import { adminRemove, adminRemoveSelect } from './remove.js';

export const adminHandlers = {
    admin_button: async (interaction) => {
        const embed = new EmbedBuilder()
            .setTitle('🔧 Section Admin')
            .setDescription('Gestion des administrateurs')
            .setColor(0x5865F2);
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_list_button')
                    .setLabel('Liste')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('admin_add_button')
                    .setLabel('Ajouter')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('admin_remove_button')
                    .setLabel('Retirer')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('back_to_main')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.update({ embeds: [embed], components: [buttons] });
    },
    admin_list_button: adminList,
    admin_add_button: adminAdd,
    admin_add_user_select: adminAddSelect,
    admin_remove_button: adminRemove,
    admin_remove_user_select: adminRemoveSelect
};
