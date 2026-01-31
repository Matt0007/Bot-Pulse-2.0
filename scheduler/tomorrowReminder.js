import cron from 'node-cron';
import prisma from '../utils/prisma.js';
import { useGetAllTask } from '../hook/clickup/useGetAllTask.js';
import { getTomorrowParisTimestamp } from '../utils/date.js';
import { EmbedBuilder } from 'discord.js';

const STATUS_EMOJIS = { A_FAIRE: '⬜', EN_COURS: '🟦' };
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function getStatutEmoji(statut) {
    return statut === 'En cours' ? STATUS_EMOJIS.EN_COURS : STATUS_EMOJIS.A_FAIRE;
}

/**
 * Envoie le rappel "Échéances demain" dans le channel du responsable.
 * @param {object} client - Client Discord
 * @param {string} guildId - ID du serveur
 * @param {string} responsableName - Nom du responsable
 * @param {string} channelId - ID du channel où envoyer
 * @param {string[]} projectIds - IDs des projets configurés
 * @returns {Promise<boolean>} true si un message a été envoyé, false sinon
 */
export async function sendTomorrowReminder(client, guildId, responsableName, channelId, projectIds) {
    try {
        const tasks = await useGetAllTask(guildId, responsableName, projectIds, { ignoreStartDate: true });
        const tomorrowStart = getTomorrowParisTimestamp();
        const tomorrowEnd = tomorrowStart + ONE_DAY_MS;
        const dueTomorrow = tasks.filter(t =>
            t.due_date != null &&
            Number(t.due_date) >= tomorrowStart &&
            Number(t.due_date) < tomorrowEnd
        );

        if (dueTomorrow.length === 0) return false;

        const taskLines = dueTomorrow.map((t, i) => {
            const num = (i + 1).toString().padStart(2, '0');
            const emoji = getStatutEmoji(t.statut);
            return t.isSubtask ? `${num}. ${emoji} _-_ ${t.nom}` : `${num}. ${emoji} **${t.nom}**`;
        });

        const legend = '\n\n⬜ À faire | 🟦 En cours\n**Tâche** | - Sous-tâche';
        const lines = [
            'Ces tâches sont à faire pour demain :',
            '',
            ...taskLines,
            legend
        ];

        const embed = new EmbedBuilder()
            .setTitle('📅 Rappel – Échéances demain')
            .setDescription(lines.join('\n'))
            .setColor(0x5865F2);

        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel || !channel.guild?.members.me?.permissionsIn(channel)?.has('SendMessages')) {
            console.log(`[Scheduler Tomorrow] ⚠️ Channel ${channelId} introuvable ou sans permission`);
            return false;
        }

        await channel.send({ embeds: [embed] });
        console.log(`[Scheduler Tomorrow] ✅ Rappel envoyé pour ${responsableName} (guildId ${guildId})`);
        return true;
    } catch (error) {
        console.error(`[Scheduler Tomorrow] Erreur pour ${responsableName}:`, error);
        return false;
    }
}

async function checkAndSendTomorrowReminders(client) {
    try {
        const timezone = process.env.TZ || 'Europe/Paris';
        const now = new Date();
        const parisTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));

        const dayOfWeek = parisTime.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6) return; // lundi–jeudi uniquement (pas vendredi ni week-end)

        const currentHour = parisTime.getHours();
        const currentMinute = parisTime.getMinutes();

        const guildConfigs = await prisma.guildConfig.findMany({
            where: { tomorrowReminderHour: { not: null }, clickupApiKey: { not: null } }
        });

        for (const config of guildConfigs) {
            if (!config.tomorrowReminderHour) continue;

            const [configHour, configMinute] = config.tomorrowReminderHour.split(':').map(Number);
            if (configHour !== currentHour || configMinute !== currentMinute) continue;

            console.log(`[Scheduler Tomorrow] Exécution pour guildId ${config.guildId} à ${config.tomorrowReminderHour}`);

            try {
                const [responsables, projects] = await Promise.all([
                    prisma.guildResponsable.findMany({ where: { guildId: config.guildId } }),
                    prisma.guildProject.findMany({ where: { guildId: config.guildId } })
                ]);
                const projectIds = projects.map(p => p.projectId);

                await Promise.all(responsables.map(r =>
                    sendTomorrowReminder(client, config.guildId, r.responsableName, r.channelId, projectIds)
                ));
            } catch (error) {
                console.error(`Erreur lors du traitement du serveur ${config.guildId}:`, error);
            }
        }
    } catch (error) {
        console.error('Erreur lors de la vérification des échéances demain:', error);
    }
}

export function startTomorrowReminderScheduler(client) {
    const timezone = process.env.TZ || 'Europe/Paris';
    cron.schedule('* * * * *', () => checkAndSendTomorrowReminders(client), {
        scheduled: true,
        timezone: timezone
    });
    console.log(`✅ Scheduler échéances demain démarré (heure configurable, timezone: ${timezone})`);
}
