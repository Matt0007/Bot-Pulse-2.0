import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export async function adminList(interaction) {
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
    
    const members = adminRole.members.map(member => member.user);
    
    if (members.length === 0) {
        const embed = new EmbedBuilder()
            .setTitle('📋 Liste des administrateurs')
            .setDescription('Aucun administrateur trouvé.')
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
    
    const memberList = members
        .map((member, index) => `**${index + 1}.** ${member.displayName || member.username}`)
        .join('\n');
    
    const embed = new EmbedBuilder()
        .setTitle('📋 Liste des administrateurs')
        .setDescription(memberList)
        .setFooter({ text: `Total: ${members.length} administrateur(s)` })
        .setColor(0x5865F2);
    
    const backButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('admin_button')
                .setLabel('Retour')
                .setStyle(ButtonStyle.Secondary)
        );
    
    await interaction.update({ embeds: [embed], components: [backButton] });
}
