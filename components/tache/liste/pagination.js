import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { createInfoEmbed } from '../../common/embeds.js';
import { getValidCache, replySessionExpired, tasksCache } from './cache.js';

const ITEMS_PER_PAGE = 25;
const STATUS_EMOJIS = { A_FAIRE: '⬜', EN_COURS: '🟦' };

export function createTaskList(tasks, currentPage) {
    const startIndex = currentPage * ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, tasks.length);
    let taskNumber = startIndex;
    const tasksList = [];
    
    for (let i = startIndex; i < endIndex; i++) {
        const task = tasks[i];
        taskNumber++;
        const numberStr = taskNumber.toString().padStart(2, '0');
        const statutEmoji = task.statut === 'En cours' ? STATUS_EMOJIS.EN_COURS : STATUS_EMOJIS.A_FAIRE;
        tasksList.push(task.isSubtask 
            ? `${numberStr}. ${statutEmoji} - ${task.nom}`
            : `${numberStr}. ${statutEmoji} **${task.nom}**`);
    }
    
    let result = tasksList.join('\n');
    const legend = `\n\n${STATUS_EMOJIS.A_FAIRE} À faire | ${STATUS_EMOJIS.EN_COURS} En cours\n**Tâche** | - Sous-tâche`;
    
    if (result.length + legend.length > 4096) {
        result = tasksList.join('\n');
        if (result.length > 4096) return result.substring(0, 4093) + '...';
        const resultWithLegend = result + legend;
        return resultWithLegend.length <= 4096 ? resultWithLegend : result;
    }
    return result + legend;
}

export function createTaskPaginationComponents(tasks, currentPage) {
    const totalPages = Math.ceil(tasks.length / ITEMS_PER_PAGE);
    const startIndex = currentPage * ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, tasks.length);
    const components = [];
    const selectMenuOptions = [];
    let taskNumber = startIndex;
    
    for (let i = startIndex; i < endIndex; i++) {
        const task = tasks[i];
        taskNumber++;
        const numberStr = taskNumber.toString().padStart(2, '0');
        const statutEmoji = task.statut === 'En cours' ? STATUS_EMOJIS.EN_COURS : STATUS_EMOJIS.A_FAIRE;
        const prefix = `${numberStr}. `; // Format: "31. " (4-5 caractères)
        const maxTaskNameLength = 100 - prefix.length; // Réserver l'espace pour le préfixe
        const taskLabel = task.nom.length > maxTaskNameLength 
            ? task.nom.substring(0, maxTaskNameLength - 3) + '...' 
            : task.nom;
        selectMenuOptions.push(
            new StringSelectMenuOptionBuilder()
                .setLabel(`${prefix}${taskLabel}`)
                .setValue(i.toString())
                .setEmoji(statutEmoji)
        );
    }
    
    components.push(new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('tache-list-select')
            .setPlaceholder(totalPages > 1 ? `Sélectionner une tâche (Page ${currentPage + 1}/${totalPages})...` : 'Sélectionner une tâche...')
            .addOptions(selectMenuOptions)
    ));
    
    if (totalPages > 1) {
        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('tache-list-page-prev').setLabel(' << ').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 0),
            new ButtonBuilder().setCustomId('tache-list-page-next').setLabel(' >> ').setStyle(ButtonStyle.Secondary).setDisabled(currentPage >= totalPages - 1)
        ));
    }
    
    return { components, totalPages, currentPage };
}

export function createFooterText(tasks, totalPages, currentPage) {
    let footerText = `${tasks.length} tâche${tasks.length > 1 ? 's' : ''} à faire ou en cours`;
    if (totalPages > 1) footerText += ` • Page ${currentPage + 1}/${totalPages}`;
    return footerText;
}

export function updateTaskPagination(tasks, newPage, responsableName) {
    const totalPages = Math.ceil(tasks.length / ITEMS_PER_PAGE);
    const tasksList = createTaskList(tasks, newPage);
    const { components } = createTaskPaginationComponents(tasks, newPage);
    const footerText = createFooterText(tasks, totalPages, newPage);
    
    return {
        embed: createInfoEmbed(`📋 Tâches de ${responsableName}`, tasksList).setFooter({ text: footerText }),
        components
    };
}

export async function handleTachePagination(interaction) {
    try {
        const userId = interaction.user.id;
        const cachedData = getValidCache(userId);
        if (!cachedData) {
            await replySessionExpired(interaction);
            return;
        }

        const { tasks, currentPage, responsableName } = cachedData;
        let newPage = currentPage;
        if (interaction.customId === 'tache-list-page-prev') {
            newPage = Math.max(0, currentPage - 1);
        } else if (interaction.customId === 'tache-list-page-next') {
            newPage = Math.min(Math.ceil(tasks.length / ITEMS_PER_PAGE) - 1, currentPage + 1);
        }

        tasksCache.set(userId, { ...cachedData, currentPage: newPage });
        const { embed, components } = updateTaskPagination(tasks, newPage, responsableName);
        await interaction.update({ embeds: [embed], components: components.length > 0 ? components : undefined });
    } catch (error) {
        console.error('Erreur lors de la pagination des tâches:', error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Erreur lors de la pagination. Veuillez réessayer.', ephemeral: true });
        }
    }
}
