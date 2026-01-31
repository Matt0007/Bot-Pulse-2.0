import cron from 'node-cron';
import prisma from '../utils/prisma.js';
import { useGetAllTask } from '../hook/clickup/useGetAllTask.js';
import { getStartOfWeekParisTimestamp, getEndOfWeekParisTimestamp } from '../utils/date.js';
import { EmbedBuilder } from 'discord.js';
import { createTaskList, createFooterText } from '../components/tache/liste/pagination.js';
import { tasksCache } from '../components/tache/liste/cache.js';
import { createMorningPaginationComponents } from './morningTasks.js';

const EMBED_COLORS = { MONDAY: 0xF1C40F, MORNING: 0xFFA500 }; // jaune pour lundi
const STATUS_EMOJIS = { A_FAIRE: '⬜', EN_COURS: '🟦' };

function formatResponsableName(name) {
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

function formatDueDayParis(timestamp) {
    if (timestamp == null) return '';
    const d = new Date(Number(timestamp));
    return d.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long' });
}

async function sendMondayMorningToChannel(client, guildId, channelId, responsables) {
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

        const projectIds = projets.map(p => p.projectId);
        const allTasksMap = new Map();
        for (const responsable of responsables) {
            const tasks = await useGetAllTask(guildId, responsable.responsableName, projectIds);
            tasks.forEach(task => allTasksMap.set(task.id, task));
        }

        const allTasks = Array.from(allTasksMap.values());
        const uniqueNames = [...new Set(responsables.map(r => formatResponsableName(r.responsableName)))];
        const responsablesDisplay = uniqueNames.length === 1 ? uniqueNames[0] : uniqueNames.join(', ');

        const startOfWeek = getStartOfWeekParisTimestamp();
        const endOfWeek = getEndOfWeekParisTimestamp();
        const tasksDueThisWeek = allTasks
            .filter(t => !t.isSubtask && t.due_date != null && Number(t.due_date) >= startOfWeek && Number(t.due_date) < endOfWeek)
            .sort((a, b) => Number(a.due_date) - Number(b.due_date));

        const countEnCours = allTasks.length;
        const lines = [
            `Tu as **${countEnCours}** tâche${countEnCours !== 1 ? 's' : ''} en cours.`,
            tasksDueThisWeek.length > 0
                ? `Cette semaine : **${tasksDueThisWeek.length}** échéance${tasksDueThisWeek.length !== 1 ? 's' : ''} :`
                : 'Cette semaine : aucune échéance.',
            ''
        ];
        tasksDueThisWeek.forEach((t, i) => {
            const num = (i + 1).toString().padStart(2, '0');
            const emoji = t.statut === 'En cours' ? STATUS_EMOJIS.EN_COURS : STATUS_EMOJIS.A_FAIRE;
            const dayName = formatDueDayParis(t.due_date);
            lines.push(`${num}. ${emoji} **${t.nom}** – ${dayName}`);
        });
        lines.push('', 'Bon courage pour la semaine.');
        const introText = lines.join('\n');

        if (allTasks.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle('🌅 Bon Lundi et bonne semaine !')
                .setDescription(introText + '\n\n✅ Aucune tâche "à faire" ou "en cours" pour le moment.\n\nBonne journée ! ☀️')
                .setColor(EMBED_COLORS.MONDAY)
                .setFooter({ text: 'Rappel lundi matin • Priorités de la semaine' });
            await channel.send({ embeds: [embed] });
            console.log(`✅ Lundi matin envoyé au channel ${channel.name} pour ${responsables.length} responsable(s) (0 tâche)`);
            return;
        }

        const currentPage = 0;
        const channelCacheKey = `scheduler-channel-${channelId}`;
        const totalPages = Math.ceil(allTasks.length / 25);
        tasksCache.set(channelCacheKey, {
            tasks: allTasks,
            timestamp: Date.now(),
            currentPage,
            mondayIntroText: introText,
            mondayColor: EMBED_COLORS.MONDAY
        });

        const tasksList = createTaskList(allTasks, currentPage);
        const footerText = createFooterText(allTasks, totalPages, currentPage);
        const fullDescription = introText + '\n\n---\n\n' + tasksList;
        const embed = new EmbedBuilder()
            .setTitle('🌅 Bon Lundi et bonne semaine !')
            .setDescription(fullDescription.length > 4096 ? fullDescription.substring(0, 4093) + '...' : fullDescription)
            .setFooter({ text: footerText })
            .setColor(EMBED_COLORS.MONDAY);
        const components = createMorningPaginationComponents(allTasks, currentPage);

        await channel.send({
            embeds: [embed],
            components: components.length > 0 ? components : undefined
        });
        console.log(`✅ Lundi matin envoyé au channel ${channel.name} pour ${responsables.length} responsable(s)`);
    } catch (error) {
        console.error(`❌ Erreur lors de l'envoi du rappel lundi matin au channel ${channelId}:`, error);
    }
}

async function checkAndSendMondayMorning(client) {
    try {
        const timezone = process.env.TZ || 'Europe/Paris';
        const now = new Date();
        const parisTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
        if (parisTime.getDay() !== 1) return;

        const currentHour = parisTime.getHours();
        const currentMinute = parisTime.getMinutes();

        const guildConfigs = await prisma.guildConfig.findMany({
            where: { morningHour: { not: null }, clickupApiKey: { not: null } }
        });

        for (const config of guildConfigs) {
            if (!config.morningHour) continue;
            const [configHour, configMinute] = config.morningHour.split(':').map(Number);
            if (configHour !== currentHour || configMinute !== currentMinute) continue;

            console.log(`[Scheduler Monday Morning] Exécution pour guildId ${config.guildId} à ${config.morningHour}`);

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

                await Promise.allSettled(
                    Array.from(responsablesByChannel.entries()).map(([channelId, responsablesForChannel]) =>
                        sendMondayMorningToChannel(client, config.guildId, channelId, responsablesForChannel)
                    )
                );
            } catch (error) {
                console.error(`Erreur lors du traitement du serveur ${config.guildId}:`, error);
            }
        }
    } catch (error) {
        console.error('Erreur lors de la vérification du rappel lundi matin:', error);
    }
}

/**
 * Déclenche manuellement le rappel lundi matin pour un serveur (ex. pour /test).
 * @param {object} client - Client Discord
 * @param {string} guildId - ID du serveur
 */
export async function triggerMondayMorningForGuild(client, guildId) {
    const responsables = await prisma.guildResponsable.findMany({
        where: { guildId }
    });
    if (responsables.length === 0) return;

    const responsablesByChannel = new Map();
    responsables.forEach(r => {
        if (!responsablesByChannel.has(r.channelId)) responsablesByChannel.set(r.channelId, []);
        responsablesByChannel.get(r.channelId).push(r);
    });

    await Promise.allSettled(
        Array.from(responsablesByChannel.entries()).map(([channelId, responsablesForChannel]) =>
            sendMondayMorningToChannel(client, guildId, channelId, responsablesForChannel)
        )
    );
}

export function startMondayMorningScheduler(client) {
    const timezone = process.env.TZ || 'Europe/Paris';
    // Scheduler qui s'exécute toutes les minutes le lundi uniquement (jour 1)
    cron.schedule('* * * * 1', () => checkAndSendMondayMorning(client), {
        scheduled: true,
        timezone
    });
    console.log(`✅ Scheduler lundi matin (Bon Lundi et bonne semaine) démarré (lundi uniquement, heure = morningHour, timezone: ${timezone})`);
}
