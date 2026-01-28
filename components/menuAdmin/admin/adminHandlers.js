import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createErrorEmbed, createInfoEmbed } from '../../common/embeds.js';
import { adminAdd, adminAddSelect } from './add.js';
import { adminRemove, adminRemoveSelect } from './remove.js';

export const adminHandlers = {
    admin_button: async (interaction) => {
        const guild = interaction.guild;
        const adminRole = guild.roles.cache.find(r => r.name === 'Bot Pulse Admin');
        
        let embed;
        if (!adminRole) {
            embed = createErrorEmbed('Le rôle "Bot Pulse Admin" n\'existe pas.');
        } else {
            const members = adminRole.members.map(member => member.user);
            if (members.length === 0) {
                embed = createInfoEmbed('🔧 Section Admin', 'Aucun administrateur trouvé.');
            } else {
                const memberList = members.map((member, index) => `**${index + 1}.** ${member.displayName || member.username}`).join('\n');
                embed = createInfoEmbed('🔧 Section Admin', memberList).setFooter({ text: `Total: ${members.length} administrateur(s)` });
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
                    .setCustomId('admin_crash_button')
                    .setLabel('Crash bot (test)')
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
    admin_remove_user_select: adminRemoveSelect,
    admin_crash_button: async (interaction) => {
        // Bouton de test pour forcer un crash du process
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '💥 Crash de test demandé. Le bot va se fermer (si la VM est bien configurée, il sera relancé).',
                ephemeral: true
            });
        }

        // Laisser un petit délai pour que la réponse parte avant de tuer le process
        setTimeout(() => {
            // Utiliser process.exit pour s'assurer que le bot s\'arrête vraiment,
            // même si les erreurs sont catchées ailleurs.
            process.exit(1);
        }, 1000);
    }
};
