import cron from 'node-cron';
import prisma from '../utils/prisma.js';
import { useGetCompletedTasks } from '../hook/clickup/useGetCompletedTasks.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { tasksCache } from '../components/tache/liste/cache.js';

export const completedTasksCache = new Map();
const ITEMS_PER_PAGE = 25;

function formatDate() {
    const today = new Date();
    const jours = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
    const jour = jours[today.getDay()];
    const jourNum = String(today.getDate()).padStart(2, '0');
    const mois = String(today.getMonth() + 1).padStart(2, '0');
    const annee = today.getFullYear();
    return `${jour} ${jourNum}/${mois}/${annee}`;
}

function createCompletedTaskList(tasks, currentPage = 0) {
    const startIndex = currentPage * ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, tasks.length);
    const tasksList = [];
    let taskNumber = startIndex;
    
    for (let i = startIndex; i < endIndex; i++) {
        const task = tasks[i];
        taskNumber++;
        const numberStr = taskNumber.toString().padStart(2, '0');
        tasksList.push(task.isSubtask 
            ? `${numberStr}. _-_ ${task.nom}`
            : `${numberStr}. **${task.nom}**`);
    }
    
    const result = tasksList.join('\n');
    const legend = `\n\n**Tâche** | - Sous-tâche`;
    
    if (result.length + legend.length > 4096) {
        return result.length > 4096 ? result.substring(0, 4093) + '...' : result;
    }
    return result + legend;
}

function createCompletedPaginationComponents(tasks, currentPage) {
    const totalPages = Math.ceil(tasks.length / ITEMS_PER_PAGE);
    if (totalPages <= 1) return [];
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('completed-tasks-page-prev').setLabel(' << ').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 0),
        new ButtonBuilder().setCustomId('completed-tasks-page-next').setLabel(' >> ').setStyle(ButtonStyle.Secondary).setDisabled(currentPage >= totalPages - 1)
    )];
}

function createEmbed(responsableName, tasksList, footerText) {
    return new EmbedBuilder()
        .setTitle(`✅ Tâches complétées de ${responsableName} le ${formatDate()}`)
        .setDescription(tasksList)
        .setFooter({ text: footerText })
        .setColor(0x00FF00);
}

async function sendCompletedTasks(client, guildId, responsableName, channelId, configuredProjectIds) {
    try {
        const completedTasks = await useGetCompletedTasks(guildId, responsableName, configuredProjectIds);
        if (completedTasks.length === 0) return;

        const channel = await client.channels.fetch(channelId);
        if (!channel) {
            console.error(`Channel ${channelId} introuvable pour le responsable ${responsableName}`);
            return;
        }

        const currentPage = 0;
        const channelCacheKey = `scheduler-completed-channel-${channelId}`;
        completedTasksCache.set(channelCacheKey, {
            tasks: completedTasks,
            timestamp: Date.now(),
            currentPage,
            responsableName
        });

        const tasksList = createCompletedTaskList(completedTasks, currentPage);
        const totalPages = Math.ceil(completedTasks.length / ITEMS_PER_PAGE);
        const components = createCompletedPaginationComponents(completedTasks, currentPage);
        const footerText = `${completedTasks.length} tâche(s) complétée(s)${totalPages > 1 ? ` • Page ${currentPage + 1}/${totalPages}` : ''}`;
        const embed = createEmbed(responsableName, tasksList, footerText);
        
        const message = await channel.send({ embeds: [embed], components: components.length > 0 ? components : undefined });
        
        // Épingler le message
        try {
            await message.pin();
        } catch (error) {
            console.error(`Impossible d'épingler le message dans le channel ${channelId}:`, error);
        }
    } catch (error) {
        console.error(`Erreur lors de l'envoi des tâches complétées pour ${responsableName}:`, error);
    }
}

async function checkAndSendCompletedTasks(client) {
    try {
        // Utiliser le timezone Europe/Paris pour les calculs
        const timezone = process.env.TZ || 'Europe/Paris';
        const now = new Date();
        
        // Convertir en heure locale Europe/Paris
        const parisTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
        const dayOfWeek = parisTime.getDay();
        
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            console.log(`[Scheduler Completed] Week-end détecté (jour ${dayOfWeek}), pas d'envoi`);
            return;
        }

        const guildConfigs = await prisma.guildConfig.findMany({
            where: { completedHour: { not: null }, clickupApiKey: { not: null } }
        });

        const currentHour = parisTime.getHours();
        const currentMinute = parisTime.getMinutes();

        for (const config of guildConfigs) {
            if (!config.completedHour) continue;
            
            // Parser le format HH:MM
            const [configHour, configMinute] = config.completedHour.split(':').map(Number);
            
            // Vérifier si l'heure et la minute correspondent
            if (configHour !== currentHour || configMinute !== currentMinute) {
                continue;
            }
            
            console.log(`[Scheduler Completed] ✅ Exécution pour guildId ${config.guildId} à ${config.completedHour}`);

            try {
                const [responsables, projects] = await Promise.all([
                    prisma.guildResponsable.findMany({ where: { guildId: config.guildId } }),
                    prisma.guildProject.findMany({ where: { guildId: config.guildId } })
                ]);

                const projectIds = projects.map(p => p.projectId);
                for (const responsable of responsables) {
                    await sendCompletedTasks(client, config.guildId, responsable.responsableName, responsable.channelId, projectIds);
                }
            } catch (error) {
                console.error(`Erreur lors du traitement du serveur ${config.guildId}:`, error);
            }
        }
    } catch (error) {
        console.error('Erreur lors de la vérification des tâches complétées:', error);
    }
}

export function startCompletedTasksScheduler(client) {
    const timezone = process.env.TZ || 'Europe/Paris';
    // Scheduler qui s'exécute toutes les minutes (lundi à vendredi) pour vérifier l'heure exacte
    cron.schedule('* * * * 1-5', () => checkAndSendCompletedTasks(client), {
        scheduled: true,
        timezone: timezone
    });
    console.log(`✅ Scheduler des tâches complétées démarré (lundi à vendredi uniquement, vérification chaque minute, timezone: ${timezone})`);
}

export async function handleCompletedTasksPagination(interaction) {
    try {
        const channelCacheKey = `scheduler-completed-channel-${interaction.channel.id}`;
        const cachedData = completedTasksCache.get(channelCacheKey);
        const sessionTimeout = 30 * 60 * 1000;
        
        if (!cachedData || Date.now() - cachedData.timestamp > sessionTimeout) {
            if (cachedData) completedTasksCache.delete(channelCacheKey);
            return await interaction.reply({
                content: '❌ La session a expiré. Le message sera renouvelé demain.',
                ephemeral: true
            });
        }

        const { tasks, currentPage, responsableName } = cachedData;
        let newPage = currentPage;
        if (interaction.customId === 'completed-tasks-page-prev') {
            newPage = Math.max(0, currentPage - 1);
        } else if (interaction.customId === 'completed-tasks-page-next') {
            newPage = Math.min(Math.ceil(tasks.length / ITEMS_PER_PAGE) - 1, currentPage + 1);
        }

        completedTasksCache.set(channelCacheKey, { ...cachedData, currentPage: newPage });

        const tasksList = createCompletedTaskList(tasks, newPage);
        const totalPages = Math.ceil(tasks.length / ITEMS_PER_PAGE);
        const components = createCompletedPaginationComponents(tasks, newPage);
        const footerText = `${tasks.length} tâche(s) complétée(s)${totalPages > 1 ? ` • Page ${newPage + 1}/${totalPages}` : ''}`;
        const embed = createEmbed(responsableName, tasksList, footerText);

        await interaction.update({ embeds: [embed], components: components.length > 0 ? components : undefined });
    } catch (error) {
        console.error('Erreur lors de la pagination des tâches complétées:', error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Erreur lors de la pagination. Veuillez réessayer.', ephemeral: true });
        }
    }
}
