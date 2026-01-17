import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import prisma from '../../../utils/prisma.js';

const ITEMS_PER_PAGE = 25;

export async function historyButton(interaction) {
    const guildId = interaction.guild.id;
    
    // Récupérer l'historique
    const totalCount = await prisma.historyAdmin.count({ where: { guildId } });
    
    if (totalCount === 0) {
        const embed = new EmbedBuilder()
            .setTitle('📜 Historique Admin')
            .setDescription('Aucune action enregistrée.')
            .setColor(0x5865F2);
        
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('parametre_button')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.update({ embeds: [embed], components: [backButton] });
        return;
    }
    
    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
    await displayHistory(interaction, guildId, 0, totalPages);
}

async function displayHistory(interaction, guildId, page, totalPages) {
    const skip = page * ITEMS_PER_PAGE;
    
    const history = await prisma.historyAdmin.findMany({
        where: { guildId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: ITEMS_PER_PAGE
    });
    
    const historyList = history.map((entry, index) => {
        const number = skip + index + 1;
        return `${number}. **${entry.userName}** - ${entry.action}`;
    }).join('\n');
    
    const embed = new EmbedBuilder()
        .setTitle('📜 Historique Admin')
        .setDescription(historyList || 'Aucune action')
        .setFooter({ text: `Page ${page + 1}/${totalPages} • ${history.length} action${history.length > 1 ? 's' : ''}` })
        .setColor(0x5865F2);
    
    const components = [];
    
    if (totalPages > 1) {
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('history_page_prev')
                    .setLabel(' << ')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId('history_page_next')
                    .setLabel(' >> ')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page >= totalPages - 1)
            );
        components.push(buttons);
    }
    
    const backButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('parametre_button')
                .setLabel('Retour')
                .setStyle(ButtonStyle.Secondary)
        );
    components.push(backButton);
    
    await interaction.update({ embeds: [embed], components });
}

export async function historyPagination(interaction) {
    const guildId = interaction.guild.id;
    const totalCount = await prisma.historyAdmin.count({ where: { guildId } });
    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
    
    // Récupérer la page actuelle depuis le cache ou l'embed
    let currentPage = 0;
    if (interaction.message.embeds[0]?.footer?.text) {
        const pageMatch = interaction.message.embeds[0].footer.text.match(/Page (\d+)\//);
        if (pageMatch) currentPage = parseInt(pageMatch[1]) - 1;
    }
    
    if (interaction.customId === 'history_page_prev') {
        currentPage = Math.max(0, currentPage - 1);
    } else if (interaction.customId === 'history_page_next') {
        currentPage = Math.min(totalPages - 1, currentPage + 1);
    }
    
    await displayHistory(interaction, guildId, currentPage, totalPages);
}
