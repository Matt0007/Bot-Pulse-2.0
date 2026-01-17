import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, UserSelectMenuBuilder } from 'discord.js';
import { logAdminAction } from '../../../utils/history.js';

export async function adminRemove(interaction) {
    const guild = interaction.guild;
    const adminRole = guild.roles.cache.find(r => r.name === 'Bot Pulse Admin');
    
    if (!adminRole) {
        await interaction.update({
            embeds: [new EmbedBuilder()
                .setTitle('❌ Erreur')
                .setDescription('Le rôle "Bot Pulse Admin" n\'existe pas.')
                .setColor(0xFF0000)
            ],
            components: []
        });
        return;
    }
    
    const members = adminRole.members.map(member => member);
    
    if (members.length === 0) {
        const embed = new EmbedBuilder()
            .setTitle('➖ Retirer un administrateur')
            .setDescription('Aucun administrateur à retirer.')
            .setColor(0x5865F2);
        
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_button')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.update({ embeds: [embed], components: [backButton] });
        return;
    }
    
    const userSelect = new UserSelectMenuBuilder()
        .setCustomId('admin_remove_user_select')
        .setPlaceholder('Sélectionnez un administrateur à retirer')
        .setMaxValues(1)
        .setMinValues(1);
    
    const embed = new EmbedBuilder()
        .setTitle('➖ Retirer un administrateur')
        .setDescription('Sélectionnez un administrateur dans le menu ci-dessous')
        .setColor(0x5865F2);
    
    const row = new ActionRowBuilder().addComponents(userSelect);
    const backButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('admin_button')
                .setLabel('Retour')
                .setStyle(ButtonStyle.Secondary)
        );
    
    await interaction.update({ embeds: [embed], components: [row, backButton] });
}

export async function adminRemoveSelect(interaction) {
    const guild = interaction.guild;
    const adminRole = guild.roles.cache.find(r => r.name === 'Bot Pulse Admin');
    const userId = interaction.values[0];
    const member = await guild.members.fetch(userId);
    
    if (!adminRole) {
        await interaction.update({
            embeds: [new EmbedBuilder()
                .setTitle('❌ Erreur')
                .setDescription('Le rôle "Bot Pulse Admin" n\'existe pas.')
                .setColor(0xFF0000)
            ],
            components: []
        });
        return;
    }
    
    if (!member.roles.cache.has(adminRole.id)) {
        const embed = new EmbedBuilder()
            .setTitle('⚠️ Pas administrateur')
            .setDescription(`${member.displayName || member.user.username} n'a pas le rôle admin.`)
            .setColor(0xFFA500);
        
        const okButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_button')
                    .setLabel('OK')
                    .setStyle(ButtonStyle.Primary)
            );
        
        await interaction.update({ embeds: [embed], components: [okButton] });
        return;
    }
    
    try {
        await member.roles.remove(adminRole, `Retiré par ${interaction.user.tag}`);
        
        const userName = interaction.user.displayName || interaction.user.username;
        const targetName = member.displayName || member.user.username;
        await logAdminAction(interaction.guild.id, interaction.user.id, userName, `Retirer ${targetName} des admins`);
        
        const embed = new EmbedBuilder()
            .setTitle('✅ Administrateur retiré')
            .setDescription(`${targetName} a été retiré du rôle "Bot Pulse Admin".`)
            .setColor(0x00FF00);
        
        const okButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_button')
                    .setLabel('OK')
                    .setStyle(ButtonStyle.Primary)
            );
        
        await interaction.update({ embeds: [embed], components: [okButton] });
    } catch (error) {
        const embed = new EmbedBuilder()
            .setTitle('❌ Erreur')
            .setDescription(`Impossible de retirer le rôle: ${error.message}`)
            .setColor(0xFF0000);
        
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_button')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.update({ embeds: [embed], components: [backButton] });
    }
}
