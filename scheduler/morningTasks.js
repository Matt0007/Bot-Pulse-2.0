import cron from 'node-cron';
import prisma from '../utils/prisma.js';
import { useGetAllTask } from '../hook/clickup/useGetAllTask.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createTaskList, createFooterText } from '../components/tache/liste/pagination.js';
import { tasksCache } from '../components/tache/liste/cache.js';

const EMBED_COLORS = { MORNING: 0xFFA500, ERROR: 0xFF0000 };
const ITEMS_PER_PAGE = 25;

function formatResponsableName(name) {
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

function createMorningPaginationComponents(tasks, currentPage) {
    const totalPages = Math.ceil(tasks.length / ITEMS_PER_PAGE);
    if (totalPages <= 1) return [];
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('tache-list-page-prev').setLabel(' << ').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 0),
        new ButtonBuilder().setCustomId('tache-list-page-next').setLabel(' >> ').setStyle(ButtonStyle.Secondary).setDisabled(currentPage >= totalPages - 1)
    )];
}

function createMorningEmbed(responsablesDisplay, tasksList, footerText) {
    return new EmbedBuilder()
        .setTitle(`🌅 Bonjour ${responsablesDisplay} !`)
        .setDescription(tasksList)
        .setFooter({ text: footerText })
        .setColor(EMBED_COLORS.MORNING);
}

async function sendTaskListToChannel(client, guildId, channelId, responsables) {
    try {
        const guild = client.guilds.cache.get(guildId);
        const channel = guild?.channels.cache.get(channelId);
        if (!guild || !channel || !channel.permissionsFor(guild.members.me)?.has('SendMessages')) {
            console.log(`⚠️ Channel ${channelId} inaccessible`);
            return;
        }

        const projets = await prisma.guildProject.findMany({ where: { guildId } });
        if (projets.length === 0) {
            console.log(`⚠️ Aucun projet configuré pour le serveur ${guildId}`);
            return;
        }

        const allTasksMap = new Map();
        for (const responsable of responsables) {
            const tasks = await useGetAllTask(guildId, responsable.responsableName, projets.map(p => p.projectId));
            tasks.forEach(task => allTasksMap.set(task.id, task));
        }

        const allTasks = Array.from(allTasksMap.values());
        const uniqueNames = [...new Set(responsables.map(r => formatResponsableName(r.responsableName)))];
        const responsablesDisplay = uniqueNames.length === 1 ? uniqueNames[0] : uniqueNames.join(', ');

        if (allTasks.length === 0) {
            await channel.send({ embeds: [new EmbedBuilder()
                .setTitle(`🌅 Bonjour ${responsablesDisplay} !`)
                .setDescription(`✅ Aucune tâche "à faire" ou "en cours" trouvée pour **${responsablesDisplay}**.\n\nBonne journée ! ☀️`)
                .setColor(EMBED_COLORS.MORNING)
                .setFooter({ text: 'Rappel quotidien • Matin' })] });
            return;
        }

        const currentPage = 0;
        const channelCacheKey = `scheduler-channel-${channelId}`;
        tasksCache.set(channelCacheKey, { tasks: allTasks, timestamp: Date.now(), currentPage });
        
        const tasksList = createTaskList(allTasks, currentPage);
        const totalPages = Math.ceil(allTasks.length / ITEMS_PER_PAGE);
        const components = createMorningPaginationComponents(allTasks, currentPage);
        const embed = createMorningEmbed(responsablesDisplay, tasksList, createFooterText(allTasks, totalPages, currentPage));

        await channel.send({ embeds: [embed], components: components.length > 0 ? components : undefined });
        console.log(`✅ Liste des tâches matinales envoyée au channel ${channel.name} pour ${responsables.length} responsable(s)`);
    } catch (error) {
        console.error(`❌ Erreur lors de l'envoi de la liste des tâches matinales au channel ${channelId}:`, error);
    }
}

async function checkAndSendMorningTasks(client) {
    try {
        // Utiliser le timezone Europe/Paris pour les calculs
        const timezone = process.env.TZ || 'Europe/Paris';
        const now = new Date();
        
        // Convertir en heure locale Europe/Paris
        const parisTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
        const dayOfWeek = parisTime.getDay();
        
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            console.log(`[Scheduler Morning] Week-end détecté (jour ${dayOfWeek}), pas d'envoi`);
            return;
        }

        const guildConfigs = await prisma.guildConfig.findMany({
            where: { morningHour: { not: null }, clickupApiKey: { not: null } }
        });

        const currentHour = parisTime.getHours();
        const currentMinute = parisTime.getMinutes();
        
        console.log(`[Scheduler Morning] Vérification à ${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')} (${timezone}) - ${guildConfigs.length} config(s) trouvée(s)`);

        for (const config of guildConfigs) {
            if (!config.morningHour) continue;
            
            // Parser le format HH:MM
            const [configHour, configMinute] = config.morningHour.split(':').map(Number);
            
            // Vérifier si l'heure et la minute correspondent
            if (configHour !== currentHour || configMinute !== currentMinute) {
                console.log(`[Scheduler Morning] Config guildId ${config.guildId}: ${config.morningHour} ≠ ${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`);
                continue;
            }
            
            console.log(`[Scheduler Morning] ✅ Exécution pour guildId ${config.guildId} à ${config.morningHour}`);

            try {
                const responsables = await prisma.guildResponsable.findMany({
                    where: { guildId: config.guildId }
                });

                if (responsables.length === 0) continue;

                const responsablesByChannel = new Map();
                responsables.forEach(r => {
                    if (!responsablesByChannel.has(r.channelId)) responsablesByChannel.set(r.channelId, []);
                    responsablesByChannel.get(r.channelId).push(r);
                });

                const promises = Array.from(responsablesByChannel.entries()).map(([channelId, responsablesForChannel]) => 
                    sendTaskListToChannel(client, config.guildId, channelId, responsablesForChannel)
                );

                await Promise.allSettled(promises);
            } catch (error) {
                console.error(`Erreur lors du traitement du serveur ${config.guildId}:`, error);
            }
        }
    } catch (error) {
        console.error('Erreur lors de la vérification des tâches matinales:', error);
    }
}

export function startMorningTasksScheduler(client) {
    const timezone = process.env.TZ || 'Europe/Paris';
    // Scheduler qui s'exécute toutes les minutes (lundi à vendredi) pour vérifier l'heure exacte
    cron.schedule('* * * * 1-5', () => checkAndSendMorningTasks(client), {
        scheduled: true,
        timezone: timezone
    });
    console.log(`✅ Scheduler des tâches matinales démarré (lundi à vendredi uniquement, vérification chaque minute, timezone: ${timezone})`);
}

export async function handleMorningTasksPagination(interaction) {
    try {
        const channelCacheKey = `scheduler-channel-${interaction.channel.id}`;
        const cachedData = tasksCache.get(channelCacheKey);
        const sessionTimeout = 30 * 60 * 1000;
        
        if (!cachedData || Date.now() - cachedData.timestamp > sessionTimeout) {
            if (cachedData) tasksCache.delete(channelCacheKey);
            return await interaction.reply({
                content: '❌ La session a expiré. Le message sera renouvelé demain matin.',
                ephemeral: true
            });
        }

        const { tasks, currentPage } = cachedData;
        let newPage = currentPage;
        if (interaction.customId === 'tache-list-page-prev') {
            newPage = Math.max(0, currentPage - 1);
        } else if (interaction.customId === 'tache-list-page-next') {
            newPage = Math.min(Math.ceil(tasks.length / ITEMS_PER_PAGE) - 1, currentPage + 1);
        }

        tasksCache.set(channelCacheKey, { ...cachedData, currentPage: newPage });

        const tasksList = createTaskList(tasks, newPage);
        const totalPages = Math.ceil(tasks.length / ITEMS_PER_PAGE);
        const responsablesDisplay = interaction.message.embeds[0]?.title?.replace('🌅 Bonjour ', '')?.replace(' !', '') || 'Responsable';
        const embed = createMorningEmbed(responsablesDisplay, tasksList, createFooterText(tasks, totalPages, newPage));
        const components = createMorningPaginationComponents(tasks, newPage);

        await interaction.update({ embeds: [embed], components: components.length > 0 ? components : undefined });
    } catch (error) {
        console.error('Erreur lors de la pagination des tâches matinales:', error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Erreur lors de la pagination. Veuillez réessayer.', ephemeral: true });
        }
    }
}
