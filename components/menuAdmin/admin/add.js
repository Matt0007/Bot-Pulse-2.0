import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, UserSelectMenuBuilder } from 'discord.js';

export async function adminAdd(interaction) {
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
    
    const userSelect = new UserSelectMenuBuilder()
        .setCustomId('admin_add_user_select')
        .setPlaceholder('Sélectionnez un utilisateur à ajouter')
        .setMaxValues(1)
        .setMinValues(1);
    
    const embed = new EmbedBuilder()
        .setTitle('➕ Ajouter un administrateur')
        .setDescription('Sélectionnez un utilisateur dans le menu ci-dessous')
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

export async function adminAddSelect(interaction) {
    const guild = interaction.guild;
    const adminRole = guild.roles.cache.find(r => r.name === 'Bot Pulse Admin');
    const userId = interaction.values[0];
    const member = await guild.members.fetch(userId);
    
    // Vérifier que ce n'est pas un bot
    if (member.user.bot) {
        const embed = new EmbedBuilder()
            .setTitle('❌ Erreur')
            .setDescription('Impossible d\'ajouter un bot au rôle admin.')
            .setColor(0xFF0000);
        
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
    
    if (member.roles.cache.has(adminRole.id)) {
        const embed = new EmbedBuilder()
            .setTitle('⚠️ Déjà administrateur')
            .setDescription(`${member.displayName || member.user.username} a déjà le rôle admin.`)
            .setColor(0xFFA500);
        
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
    
    try {
        await member.roles.add(adminRole, `Ajouté par ${interaction.user.tag}`);
        
        const embed = new EmbedBuilder()
            .setTitle('✅ Administrateur ajouté')
            .setDescription(`${member.displayName || member.user.username} a été ajouté au rôle "Bot Pulse Admin".`)
            .setColor(0x00FF00);
        
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_button')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.update({ embeds: [embed], components: [backButton] });
    } catch (error) {
        const embed = new EmbedBuilder()
            .setTitle('❌ Erreur')
            .setDescription(`Impossible d'ajouter le rôle: ${error.message}`)
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
