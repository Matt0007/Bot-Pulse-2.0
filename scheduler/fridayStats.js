import cron from 'node-cron';
import prisma from '../utils/prisma.js';
import { useGetCompletedTasks } from '../hook/clickup/useGetCompletedTasks.js';
import { getStartOfWeekParisTimestamp } from '../utils/date.js';
import { EmbedBuilder } from 'discord.js';

/**
 * Envoie le message "Félicitations" avec les stats de la semaine.
 * @param {object} client - Client Discord
 * @param {string} guildId - ID du serveur
 * @param {string} [targetChannelId] - Si fourni, envoie dans ce channel ; sinon envoie dans bot-pulse
 */
export async function sendFridayStats(client, guildId, targetChannelId = null) {
    try {
        const [responsables, projects] = await Promise.all([
            prisma.guildResponsable.findMany({ where: { guildId } }),
            prisma.guildProject.findMany({ where: { guildId } })
        ]);

        if (responsables.length === 0 || projects.length === 0) return;

        const projectIds = projects.map(p => p.projectId);
        const sinceTimestamp = getStartOfWeekParisTimestamp();

        const statsByResponsable = {};
        const results = await Promise.all(
            responsables.map(r => useGetCompletedTasks(guildId, r.responsableName, projectIds, { sinceTimestamp }))
        );
        let total = 0;
        responsables.forEach((r, i) => {
            const count = results[i].length;
            statsByResponsable[r.responsableName] = count;
            total += count;
        });

        const lines = [
            'Bravo à toute l\'équipe pour cette semaine !',
            '',
            '**📊 Stats de la semaine **'
        ];

        for (const [name, count] of Object.entries(statsByResponsable)) {
            lines.push(`• **${name}** : ${count} tâche${count !== 1 ? 's' : ''}`);
        }

        lines.push(`\n**Total :** ${total}`);
        lines.push('', 'Bon week-end à toute l\'équipe, à lundi ! 👋');

        const embed = new EmbedBuilder()
            .setTitle('🎉 Félicitations')
            .setDescription(lines.join('\n'))
            .setColor(0x5865F2);

        const guild = client.guilds.cache.get(guildId);
        if (!guild) return;

        const channel = targetChannelId
            ? await client.channels.fetch(targetChannelId).catch(() => null)
            : guild.channels.cache.find(c => c.name === 'bot-pulse');
        if (!channel || !channel.permissionsFor(guild.members.me)?.has('SendMessages')) {
            console.log(`[Scheduler Friday Stats] ⚠️ Channel introuvable ou sans permission pour guildId ${guildId}`);
            return;
        }

        const msg = await channel.send({ embeds: [embed] });
        try {
            await msg.pin();
        } catch (pinErr) {
            console.log(`[Scheduler Friday Stats] ⚠️ Épinglage impossible pour guildId ${guildId}:`, pinErr?.message ?? pinErr);
        }
        console.log(`[Scheduler Friday Stats] ✅ Message envoyé (épinglé) pour guildId ${guildId}`);
    } catch (error) {
        console.error(`[Scheduler Friday Stats] Erreur pour guildId ${guildId}:`, error);
    }
}

async function checkAndSendFridayStats(client) {
    try {
        const timezone = process.env.TZ || 'Europe/Paris';
        const now = new Date();
        const parisTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));

        if (parisTime.getDay() !== 5) return;

        const currentHour = parisTime.getHours();
        const currentMinute = parisTime.getMinutes();

        const guildConfigs = await prisma.guildConfig.findMany({
            where: { fridayStatsHour: { not: null }, clickupApiKey: { not: null } }
        });

        for (const config of guildConfigs) {
            if (!config.fridayStatsHour) continue;

            const [configHour, configMinute] = config.fridayStatsHour.split(':').map(Number);
            if (configHour !== currentHour || configMinute !== currentMinute) continue;

            console.log(`[Scheduler Friday Stats] Exécution pour guildId ${config.guildId} à ${config.fridayStatsHour}`);
            await sendFridayStats(client, config.guildId);
        }
    } catch (error) {
        console.error('Erreur lors de la vérification des stats vendredi:', error);
    }
}

export function startFridayStatsScheduler(client) {
    const timezone = process.env.TZ || 'Europe/Paris';
    cron.schedule('* * * * *', () => checkAndSendFridayStats(client), {
        scheduled: true,
        timezone: timezone
    });
    console.log(`✅ Scheduler stats vendredi démarré (vendredi, heure configurable, timezone: ${timezone})`);
}
