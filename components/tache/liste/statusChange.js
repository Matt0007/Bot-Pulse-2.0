import { EmbedBuilder } from 'discord.js';
import { getClickUpApiKey, clickUpRequest } from '../../../utils/clickup.js';
import { getValidCache, replySessionExpired, tasksCache } from './cache.js';
import { createTaskList, createTaskPaginationComponents, createFooterText } from './pagination.js';

async function getListStatuses(apiKey, listId) {
    try {
        const listData = await clickUpRequest(apiKey, `/list/${listId}`);
        return listData.statuses || [];
    } catch (error) {
        console.error('Erreur lors de la récupération des statuts:', error);
        return [];
    }
}

function findStatusByName(statuses, statusName) {
    const normalizedName = statusName.toLowerCase();
    return statuses.find(s => {
        const status = s.status?.toLowerCase() || '';
        return status.includes(normalizedName) || normalizedName.includes(status);
    });
}

async function updateTaskStatus(apiKey, taskId, listId, newStatusName) {
    try {
        const statuses = await getListStatuses(apiKey, listId);
        let targetStatus = findStatusByName(statuses, newStatusName);
        
        if (!targetStatus) {
            if (newStatusName.toLowerCase().includes('faire')) {
                targetStatus = findStatusByName(statuses, 'à faire') || findStatusByName(statuses, 'todo');
            } else if (newStatusName.toLowerCase().includes('cours')) {
                targetStatus = findStatusByName(statuses, 'en cours') || findStatusByName(statuses, 'in progress');
            } else if (newStatusName.toLowerCase().includes('achev')) {
                targetStatus = findStatusByName(statuses, 'achevée') || findStatusByName(statuses, 'complete') || findStatusByName(statuses, 'done');
            }
        }
        
        if (!targetStatus) {
            console.error('Statuts disponibles:', statuses.map(s => ({ id: s.id, status: s.status, type: s.type })));
            throw new Error(`Statut "${newStatusName}" non trouvé dans la liste`);
        }
        
        const response = await clickUpRequest(apiKey, `/task/${taskId}`, {
            method: 'PUT',
            body: { status: targetStatus.status }
        });
        
        return response;
    } catch (error) {
        console.error('Erreur lors de la mise à jour du statut:', error);
        throw error;
    }
}

async function updateListMessage(interaction, cachedData, tasks, updatedCache) {
    if (!cachedData.listMessageId || !cachedData.listChannelId) return;
    try {
        const channel = await interaction.client.channels.fetch(cachedData.listChannelId);
        const listMessage = await channel.messages.fetch(cachedData.listMessageId);
        let currentPage = updatedCache.currentPage;
        const totalPages = Math.ceil(tasks.length / 25);
        if (currentPage >= totalPages && totalPages > 0) {
            currentPage = totalPages - 1;
            updatedCache.currentPage = currentPage;
            tasksCache.set(interaction.user.id, updatedCache);
        }
        const tasksList = createTaskList(tasks, currentPage);
        const { components, totalPages: newTotalPages } = createTaskPaginationComponents(tasks, currentPage);
        const footerText = createFooterText(tasks, newTotalPages, currentPage);
        await listMessage.edit({
            embeds: [new EmbedBuilder().setTitle(`📋 Tâches de ${cachedData.responsableName}`).setDescription(tasksList).setFooter({ text: footerText }).setColor(0x5865F2)],
            components: components.length > 0 ? components : undefined
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du message de la liste:', error);
    }
}

export async function handleTacheStatusChange(interaction) {
    try {
        const userId = interaction.user.id;
        const cachedData = getValidCache(userId);
        if (!cachedData) {
            await replySessionExpired(interaction);
            return;
        }

        const customIdParts = interaction.customId.split('-');
        const taskIndex = parseInt(customIdParts[2]);
        const newStatusKey = customIdParts.slice(3).join('-');
        const { tasks, guildId } = cachedData;
        const selectedTask = tasks[taskIndex];

        if (!selectedTask) {
            await interaction.reply({ content: '❌ Tâche non trouvée.', ephemeral: true });
            return;
        }

        const statusMap = { 'a-faire': 'À faire', 'en-cours': 'En cours', 'acheve': 'Achevée' };
        const newStatusName = statusMap[newStatusKey];
        if (!newStatusName) {
            await interaction.reply({ content: '❌ Statut invalide.', ephemeral: true });
            return;
        }

        const apiKey = await getClickUpApiKey(guildId);
        await updateTaskStatus(apiKey, selectedTask.id, selectedTask.listId, newStatusName);

        if (newStatusName === 'Achevée') tasks.splice(taskIndex, 1);
        else tasks[taskIndex].statut = newStatusName;

        const updatedCache = { ...cachedData, tasks, currentPage: cachedData.currentPage };
        tasksCache.set(userId, updatedCache);
        await updateListMessage(interaction, cachedData, tasks, updatedCache);

        await interaction.update({
            content: null,
            embeds: [new EmbedBuilder().setTitle('✅ Tâche mise à jour').setDescription(`La tâche **${selectedTask.nom}** a été mise à jour à **${newStatusName}**.`).setColor(0x5865F2)],
            components: []
        });
    } catch (error) {
        console.error('Erreur lors du changement de statut:', error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Erreur lors du changement de statut. Veuillez réessayer.', ephemeral: true });
        } else if (interaction.deferred) {
            await interaction.editReply({ content: '❌ Erreur lors du changement de statut. Veuillez réessayer.', embeds: [], components: [] });
        }
    }
}
