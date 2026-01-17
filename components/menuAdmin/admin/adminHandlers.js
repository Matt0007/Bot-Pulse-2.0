import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { adminAdd, adminAddSelect } from './add.js';
import { adminRemove, adminRemoveSelect } from './remove.js';

export const adminHandlers = {
    admin_button: async (interaction) => {
        const guild = interaction.guild;
        const adminRole = guild.roles.cache.find(r => r.name === 'Bot Pulse Admin');
        
        let embed;
        if (!adminRole) {
            embed = new EmbedBuilder()
                .setTitle('🔧 Section Admin')
                .setDescription('❌ Le rôle "Bot Pulse Admin" n\'existe pas.')
                .setColor(0xFF0000);
        } else {
            const members = adminRole.members.map(member => member.user);
            if (members.length === 0) {
                embed = new EmbedBuilder()
                    .setTitle('🔧 Section Admin')
                    .setDescription('Aucun administrateur trouvé.')
                    .setColor(0x5865F2);
            } else {
                const memberList = members.map((member, index) => `**${index + 1}.** ${member.displayName || member.username}`).join('\n');
                embed = new EmbedBuilder()
                    .setTitle('🔧 Section Admin')
                    .setDescription(memberList)
                    .setFooter({ text: `Total: ${members.length} administrateur(s)` })
                    .setColor(0x5865F2);
            }
        }
        
        const buttons = new ActionRowBuilder()
            .addComponents(
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
    admin_add_button: adminAdd,
    admin_add_user_select: adminAddSelect,
    admin_remove_button: adminRemove,
    admin_remove_user_select: adminRemoveSelect
};
