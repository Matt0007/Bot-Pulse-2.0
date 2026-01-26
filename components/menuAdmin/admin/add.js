import { ActionRowBuilder, UserSelectMenuBuilder } from 'discord.js';
import { logAdminAction } from '../../../utils/history.js';
import { createBackButton, createOkButton } from '../../common/buttons.js';
import { createErrorEmbed, createInfoEmbed, createSuccessEmbed, createWarningEmbed } from '../../common/embeds.js';

export async function adminAdd(interaction) {
    const guild = interaction.guild;
    const adminRole = guild.roles.cache.find(r => r.name === 'Bot Pulse Admin');
    
    if (!adminRole) {
        await interaction.update({
            embeds: [createErrorEmbed('Le rôle "Bot Pulse Admin" n\'existe pas.')],
            components: []
        });
        return;
    }
    
    const userSelect = new UserSelectMenuBuilder()
        .setCustomId('admin_add_user_select')
        .setPlaceholder('Sélectionnez un utilisateur à ajouter')
        .setMaxValues(1)
        .setMinValues(1)
        .setDisabled(true); // Désactiver temporairement
    
    const embed = createInfoEmbed('➕ Ajouter un administrateur', 'Sélectionnez un utilisateur dans le menu ci-dessous');
    
    const row = new ActionRowBuilder().addComponents(userSelect);
    const backButton = createBackButton('admin_button');
    const message = await interaction.update({ embeds: [embed], components: [row, backButton], fetchReply: true });
    
    // Réactiver le select menu après un court délai
    setTimeout(async () => {
        try {
            const enabledSelect = new UserSelectMenuBuilder()
                .setCustomId('admin_add_user_select')
                .setPlaceholder('Sélectionnez un utilisateur à ajouter')
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

export async function adminAddSelect(interaction) {
    await interaction.deferUpdate();
    
    const guild = interaction.guild;
    const adminRole = guild.roles.cache.find(r => r.name === 'Bot Pulse Admin');
    const userId = interaction.values[0];
    const member = guild.members.cache.get(userId) || await guild.members.fetch(userId);
    
    // Vérifier que ce n'est pas un bot
    if (member.user.bot) {
        await interaction.editReply({
            embeds: [createErrorEmbed('Impossible d\'ajouter un bot au rôle admin.')],
            components: [createBackButton('admin_button')]
        });
        return;
    }
    
    if (!adminRole) {
        await interaction.editReply({
            embeds: [createErrorEmbed('Le rôle "Bot Pulse Admin" n\'existe pas.')],
            components: []
        });
        return;
    }
    
    if (member.roles.cache.has(adminRole.id)) {
        const embed = createWarningEmbed(
            '⚠️ Déjà administrateur',
            `${member.displayName || member.user.username} a déjà le rôle admin.`
        );
        await interaction.editReply({ embeds: [embed], components: [createOkButton('admin_button')] });
        return;
    }
    
    try {
        await member.roles.add(adminRole, `Ajouté par ${interaction.user.tag}`);
        
        const userName = interaction.user.displayName || interaction.user.username;
        const targetName = member.displayName || member.user.username;
        await logAdminAction(interaction.guild.id, interaction.user.id, userName, `Ajouter ${targetName} dans les admins`);
        
        const embed = createSuccessEmbed(
            '✅ Administrateur ajouté',
            `${targetName} a été ajouté au rôle "Bot Pulse Admin".`
        );
        await interaction.editReply({ embeds: [embed], components: [createOkButton('admin_button')] });
    } catch (error) {
        await interaction.editReply({
            embeds: [createErrorEmbed(`Impossible d'ajouter le rôle: ${error.message}`)],
            components: [createBackButton('admin_button')]
        });
    }
}
