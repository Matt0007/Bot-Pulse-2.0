import cron from 'node-cron';
import prisma from '../utils/prisma.js';
import { useGetAllTask } from '../hook/clickup/useGetAllTask.js';
import { getTodayParisTimestamp } from '../utils/date.js';
import { EmbedBuilder } from 'discord.js';

const STATUS_EMOJIS = { A_FAIRE: '⬜', EN_COURS: '🟦' };

function formatDueDate(timestamp) {
    if (timestamp == null) return '';
    const d = new Date(Number(timestamp));
    const parts = d.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' }).split('/');
    return parts.join('/');
}

function getStatutEmoji(statut) {
    return statut === 'En cours' ? STATUS_EMOJIS.EN_COURS : STATUS_EMOJIS.A_FAIRE;
}

/**
 * Envoie le rappel "Tâches en retard" dans le channel du responsable.
 * @param {object} client - Client Discord
 * @param {string} guildId - ID du serveur
 * @param {string} responsableName - Nom du responsable
 * @param {string} channelId - ID du channel où envoyer
 * @param {string[]} projectIds - IDs des projets configurés
 * @returns {Promise<boolean>} true si un message a été envoyé, false sinon
 */
export async function sendOverdueReminder(client, guildId, responsableName, channelId, projectIds) {
    try {
        const tasks = await useGetAllTask(guildId, responsableName, projectIds);
        const todayParis = getTodayParisTimestamp();
        const overdue = tasks.filter(t => t.due_date != null && Number(t.due_date) < todayParis);

        if (overdue.length === 0) return false;

        const taskLines = overdue.map((t, i) => {
            const num = (i + 1).toString().padStart(2, '0');
            const emoji = getStatutEmoji(t.statut);
            const dateStr = formatDueDate(t.due_date);
            const suffix = dateStr ? ` | \`${dateStr}\`` : '';
            return t.isSubtask ? `${num}. ${emoji} _-_ ${t.nom}${suffix}` : `${num}. ${emoji} **${t.nom}**${suffix}`;
        });

        const legend = '\n\n⬜ À faire | 🟦 En cours\n**Tâche** | - Sous-tâche';
        const lines = [
            'Ces tâches ont dépassé leur date d\'échéance et sont encore à faire ou en cours :',
            '',
            ...taskLines,
            legend,
            '',
            'Pense à les mettre à jour.'
        ];

        const embed = new EmbedBuilder()
            .setTitle('⚠️ Tâches en retard')
            .setDescription(lines.join('\n'))
            .setColor(0xFFA500);

        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel || !channel.guild?.members.me?.permissionsIn(channel)?.has('SendMessages')) {
            console.log(`[Scheduler Overdue] ⚠️ Channel ${channelId} introuvable ou sans permission`);
            return false;
        }

        await channel.send({ embeds: [embed] });
        console.log(`[Scheduler Overdue] ✅ Rappel envoyé pour ${responsableName} (guildId ${guildId})`);
        return true;
    } catch (error) {
        console.error(`[Scheduler Overdue] Erreur pour ${responsableName}:`, error);
        return false;
    }
}

async function checkAndSendOverdueReminders(client) {
    try {
        const timezone = process.env.TZ || 'Europe/Paris';
        const now = new Date();
        const parisTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));

        const dayOfWeek = parisTime.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) return;

        const currentHour = parisTime.getHours();
        const currentMinute = parisTime.getMinutes();

        const guildConfigs = await prisma.guildConfig.findMany({
            where: { overdueReminderHour: { not: null }, clickupApiKey: { not: null } }
        });

        for (const config of guildConfigs) {
            if (!config.overdueReminderHour) continue;
            if (config.overdueReminderEnabled === false) continue;

            const [configHour, configMinute] = config.overdueReminderHour.split(':').map(Number);
            if (configHour !== currentHour || configMinute !== currentMinute) continue;

            console.log(`[Scheduler Overdue] Exécution pour guildId ${config.guildId} à ${config.overdueReminderHour}`);

            try {
                const [responsables, projects] = await Promise.all([
                    prisma.guildResponsable.findMany({ where: { guildId: config.guildId } }),
                    prisma.guildProject.findMany({ where: { guildId: config.guildId } })
                ]);
                const projectIds = projects.map(p => p.projectId);

                await Promise.all(responsables.map(r =>
                    sendOverdueReminder(client, config.guildId, r.responsableName, r.channelId, projectIds)
                ));
            } catch (error) {
                console.error(`Erreur lors du traitement du serveur ${config.guildId}:`, error);
            }
        }
    } catch (error) {
        console.error('Erreur lors de la vérification des tâches en retard:', error);
    }
}

export function startOverdueReminderScheduler(client) {
    const timezone = process.env.TZ || 'Europe/Paris';
    cron.schedule('* * * * *', () => checkAndSendOverdueReminders(client), {
        scheduled: true,
        timezone: timezone
    });
    console.log(`✅ Scheduler tâches en retard démarré (heure configurable, timezone: ${timezone})`);
}
