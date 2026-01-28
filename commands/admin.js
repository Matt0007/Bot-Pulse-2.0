import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export function AdminMenuButton(userName) {
    const embed = new EmbedBuilder()
        .setTitle('👋 Bienvenue dans le panneau admin')
        .setDescription(`Bonjour  ${userName} !\nQue puis-je faire pour vous ?`)
        .setColor(0x5865F2);
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('admin_button')
                .setLabel('Admin')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('projet_button')
                .setLabel('Projet')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('responsable_button')
                .setLabel('Responsable')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('hour_button')
                .setLabel('Heure')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('parametre_button')
                .setLabel('Paramètre')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return { embed, row };
}

export default {
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Accéder au panneau d\'administration'),
    
    async execute(interaction) {
        // Vérifier que la commande est utilisée dans le channel bot-pulse
        if (interaction.channel.name !== 'bot-pulse') {
            await interaction.reply({
                content: '❌ Cette commande ne peut être utilisée que dans le channel `bot-pulse`.',
                ephemeral: true
            });
            return;
        }
        
        const userName = interaction.user.displayName || interaction.user.username;
        const { embed, row } = AdminMenuButton(userName);
        
        await interaction.reply({
            embeds: [embed],
            components: [row]
        });
    },
};
