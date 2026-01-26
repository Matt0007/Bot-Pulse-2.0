import { ActionRowBuilder, UserSelectMenuBuilder } from 'discord.js';
import { logAdminAction } from '../../../utils/history.js';
import { createBackButton, createOkButton } from '../../common/buttons.js';
import { createErrorEmbed, createInfoEmbed, createSuccessEmbed, createWarningEmbed } from '../../common/embeds.js';

export async function adminRemove(interaction) {
    const guild = interaction.guild;
    const adminRole = guild.roles.cache.find(r => r.name === 'Bot Pulse Admin');
    
    if (!adminRole) {
        await interaction.update({
            embeds: [createErrorEmbed('Le rôle "Bot Pulse Admin" n\'existe pas.')],
            components: []
        });
        return;
    }
    
    const members = adminRole.members.map(member => member);
    
    if (members.length === 0) {
        const embed = createInfoEmbed('➖ Retirer un administrateur', 'Aucun administrateur à retirer.');
        await interaction.update({ embeds: [embed], components: [createBackButton('admin_button')] });
        return;
    }
    
    const userSelect = new UserSelectMenuBuilder()
        .setCustomId('admin_remove_user_select')
        .setPlaceholder('Sélectionnez un administrateur à retirer')
        .setMaxValues(1)
        .setMinValues(1)
        .setDisabled(true); // Désactiver temporairement
    
    const embed = createInfoEmbed('➖ Retirer un administrateur', 'Sélectionnez un administrateur dans le menu ci-dessous');
    const row = new ActionRowBuilder().addComponents(userSelect);
    const backButton = createBackButton('admin_button');
    
    const message = await interaction.update({ embeds: [embed], components: [row, backButton], fetchReply: true });
    
    // Réactiver le select menu après un court délai
    setTimeout(async () => {
        try {
            const enabledSelect = new UserSelectMenuBuilder()
                .setCustomId('admin_remove_user_select')
                .setPlaceholder('Sélectionnez un administrateur à retirer')
                .setMaxValues(1)
                .setMinValues(1)
                .setDisabled(false);
            
            const enabledRow = new ActionRowBuilder().addComponents(enabledSelect);
            await message.edit({ embeds: [embed], components: [enabledRow, backButton] });
        } catch (error) {
            console.error('Erreur lors de la réactivation du select menu:', error);
        }
    }, 50);
}

export async function adminRemoveSelect(interaction) {
    await interaction.deferUpdate();
    
    const guild = interaction.guild;
    const adminRole = guild.roles.cache.find(r => r.name === 'Bot Pulse Admin');
    const userId = interaction.values[0];
    const member = guild.members.cache.get(userId) || await guild.members.fetch(userId);
    
    if (!adminRole) {
        await interaction.editReply({
            embeds: [createErrorEmbed('Le rôle "Bot Pulse Admin" n\'existe pas.')],
            components: []
        });
        return;
    }
    
    if (!member.roles.cache.has(adminRole.id)) {
        const embed = createWarningEmbed(
            '⚠️ Pas administrateur',
            `${member.displayName || member.user.username} n'a pas le rôle admin.`
        );
        await interaction.editReply({ embeds: [embed], components: [createOkButton('admin_button')] });
        return;
    }
    
    try {
        await member.roles.remove(adminRole, `Retiré par ${interaction.user.tag}`);
        
        const userName = interaction.user.displayName || interaction.user.username;
        const targetName = member.displayName || member.user.username;
        await logAdminAction(interaction.guild.id, interaction.user.id, userName, `Retirer ${targetName} des admins`);
        
        const embed = createSuccessEmbed(
            '✅ Administrateur retiré',
            `${targetName} a été retiré du rôle "Bot Pulse Admin".`
        );
        await interaction.editReply({ embeds: [embed], components: [createOkButton('admin_button')] });
    } catch (error) {
        await interaction.editReply({
            embeds: [createErrorEmbed(`Impossible de retirer le rôle: ${error.message}`)],
            components: [createBackButton('admin_button')]
        });
    }
}