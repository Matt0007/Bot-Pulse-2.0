import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import prisma from '../../../utils/prisma.js';
import { createInfoEmbed } from '../../common/embeds.js';
import { hourMorningDetail, hourMorningModify, hourMorningModal } from './morning.js';
import { hourCompletedDetail, hourCompletedModify, hourCompletedModal } from './completed.js';
import { hourFridayStatsDetail, hourFridayStatsModify, hourFridayStatsModal } from './fridayStats.js';
import { hourOverdueReminderDetail, hourOverdueReminderModify, hourOverdueReminderModal, hourOverdueReminderToggle } from './overdueReminder.js';
import { hourTomorrowReminderDetail, hourTomorrowReminderModify, hourTomorrowReminderModal } from './tomorrowReminder.js';

/**
 * Affiche la page principale de gestion des heures
 */
async function hourList(interaction) {
    try {
        const guildId = interaction.guild.id;
        const guildConfig = await prisma.guildConfig.findUnique({ where: { guildId } });
        const morningHour = guildConfig?.morningHour ?? '8:00';
        const completedHour = guildConfig?.completedHour ?? '22:00';
        const fridayStatsHour = guildConfig?.fridayStatsHour ?? '18:00';
        const overdueReminderHour = guildConfig?.overdueReminderHour ?? '15:00';
        const tomorrowReminderHour = guildConfig?.tomorrowReminderHour ?? '20:00';
        const embed = createInfoEmbed('⏰ Gestion des heures', `**Matin :** ${morningHour}\n**Complété :** ${completedHour}\n**Stats vendredi :** ${fridayStatsHour}\n**Tâches en retard :** ${overdueReminderHour}\n**Échéances demain :** ${tomorrowReminderHour}`);
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('hour_morning_button')
                    .setLabel('Matin')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('hour_completed_button')
                    .setLabel('Complété')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('hour_friday_stats_button')
                    .setLabel('Stats vendredi')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('hour_overdue_reminder_button')
                    .setLabel('Tâches en retard')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('hour_tomorrow_reminder_button')
                    .setLabel('Échéances demain')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('back_to_main')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.update({ embeds: [embed], components: [buttons] });
    } catch (error) {
        console.error('Erreur lors de l\'affichage de la liste des heures:', error);
        await interaction.reply({ content: '❌ Erreur lors de l\'affichage.', ephemeral: true });
    }
}

export const hourHandlers = {
    hour_button: hourList,
    hour_morning_button: hourMorningDetail,
    hour_completed_button: hourCompletedDetail,
    hour_friday_stats_button: hourFridayStatsDetail,
    hour_overdue_reminder_button: hourOverdueReminderDetail,
    hour_tomorrow_reminder_button: hourTomorrowReminderDetail,
    hour_overdue_reminder_toggle: hourOverdueReminderToggle,
    hour_morning_modify: hourMorningModify,
    hour_completed_modify: hourCompletedModify,
    hour_friday_stats_modify: hourFridayStatsModify,
    hour_overdue_reminder_modify: hourOverdueReminderModify,
    hour_tomorrow_reminder_modify: hourTomorrowReminderModify,
    hour_morning_modal: hourMorningModal,
    hour_completed_modal: hourCompletedModal,
    hour_friday_stats_modal: hourFridayStatsModal,
    hour_overdue_reminder_modal: hourOverdueReminderModal,
    hour_tomorrow_reminder_modal: hourTomorrowReminderModal
};
