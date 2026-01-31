import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import prisma from '../../../utils/prisma.js';
import { logAdminAction } from '../../../utils/history.js';
import { createBackButton } from '../../common/buttons.js';
import { createErrorEmbed, createInfoEmbed, createSuccessEmbed } from '../../common/embeds.js';

/**
 * Affiche la page de détail pour l'heure du rappel tâches en retard
 */
export async function hourOverdueReminderDetail(interaction) {
    try {
        const guildId = interaction.guild.id;
        const guildConfig = await prisma.guildConfig.findUnique({ where: { guildId } });
        const overdueReminderHour = guildConfig?.overdueReminderHour ?? '15:00';
        const enabled = guildConfig?.overdueReminderEnabled !== false;
        const statusText = enabled ? '**Statut :** Activé' : '**Statut :** Désactivé';
        const embed = createInfoEmbed('⚠️ Tâches en retard', `**Heure actuelle :** ${overdueReminderHour}\n${statusText}\n\nLe rappel des tâches dont l'échéance est dépassée est envoyé chaque jour (en semaine) à cette heure dans le channel de chaque responsable.`);
        const toggleLabel = enabled ? 'Désactiver' : 'Activer';
        const toggleStyle = enabled ? ButtonStyle.Secondary : ButtonStyle.Success;
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('hour_overdue_reminder_modify').setLabel('Modifier').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('hour_overdue_reminder_toggle').setLabel(toggleLabel).setStyle(toggleStyle),
                new ButtonBuilder().setCustomId('hour_button').setLabel('Retour').setStyle(ButtonStyle.Secondary)
            );
        await interaction.update({ embeds: [embed], components: [buttons] });
    } catch (error) {
        console.error('Erreur lors de l\'affichage de l\'heure tâches en retard:', error);
        await interaction.reply({ content: '❌ Erreur lors de l\'affichage.', ephemeral: true });
    }
}

/**
 * Bascule l'activation du rappel tâches en retard (on/off)
 */
export async function hourOverdueReminderToggle(interaction) {
    try {
        const guildId = interaction.guild.id;
        const guildConfig = await prisma.guildConfig.findUnique({ where: { guildId } });
        const currentEnabled = guildConfig?.overdueReminderEnabled !== false;
        const newEnabled = !currentEnabled;

        await prisma.guildConfig.upsert({
            where: { guildId },
            update: { overdueReminderEnabled: newEnabled },
            create: {
                guildId,
                overdueReminderEnabled: newEnabled
            }
        });

        const userName = interaction.user.displayName || interaction.user.username;
        await logAdminAction(guildId, interaction.user.id, userName, `Rappel tâches en retard: ${newEnabled ? 'Activé' : 'Désactivé'}`);

        await hourOverdueReminderDetail(interaction);
    } catch (error) {
        console.error('Erreur lors du toggle tâches en retard:', error);
        await interaction.reply({ content: '❌ Erreur lors de la modification.', ephemeral: true }).catch(() => {});
    }
}

/**
 * Ouvre le modal pour modifier l'heure du rappel tâches en retard
 */
export async function hourOverdueReminderModify(interaction) {
    try {
        const guildId = interaction.guild.id;
        const guildConfig = await prisma.guildConfig.findUnique({
            where: { guildId }
        });

        const currentHour = guildConfig?.overdueReminderHour ?? '15:00';

        const modal = new ModalBuilder()
            .setCustomId('hour_overdue_reminder_modal')
            .setTitle('Modifier l\'heure du rappel tâches en retard');

        const hourInput = new TextInputBuilder()
            .setCustomId('hour_value')
            .setLabel('Heure (HH:MM)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Ex: 15:00 ou 09:00')
            .setRequired(true)
            .setMaxLength(5)
            .setValue(currentHour);

        const row = new ActionRowBuilder().addComponents(hourInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
    } catch (error) {
        console.error('Erreur lors de l\'ouverture du modal:', error);
        await interaction.reply({ content: '❌ Erreur lors de l\'ouverture du formulaire.', ephemeral: true });
    }
}

/**
 * Traite la soumission du modal pour l'heure du rappel tâches en retard
 */
export async function hourOverdueReminderModal(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const guildId = interaction.guild.id;
        const hourValue = interaction.fields.getTextInputValue('hour_value').trim();

        const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
        if (!timeRegex.test(hourValue)) {
            const errorEmbed = createErrorEmbed('Le format doit être HH:MM (ex: 8:00, 12:05, 22:30).\nLes heures doivent être entre 00:00 et 23:59.');
            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('hour_overdue_reminder_modify').setLabel('Modifier').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('hour_button').setLabel('Retour').setStyle(ButtonStyle.Secondary)
                );

            try {
                const channel = await interaction.client.channels.fetch(interaction.channel.id);
                const messages = await channel.messages.fetch({ limit: 10 });
                const botMessage = messages.find(msg =>
                    msg.author.id === interaction.client.user.id &&
                    msg.embeds.length > 0 &&
                    (msg.embeds[0].title === '⚠️ Tâches en retard' || msg.embeds[0].title === '✅ Heure tâches en retard modifiée')
                );

                if (botMessage) {
                    await botMessage.edit({ embeds: [errorEmbed], components: [buttons] });
                }
            } catch (error) {
                console.error('Erreur lors de la mise à jour du message:', error);
            }

            await interaction.deleteReply();
            return;
        }

        const [hours, minutes] = hourValue.split(':');
        const normalizedTime = `${hours.padStart(2, '0')}:${minutes}`;

        await prisma.guildConfig.upsert({
            where: { guildId },
            update: { overdueReminderHour: normalizedTime },
            create: {
                guildId,
                overdueReminderHour: normalizedTime
            }
        });

        const userName = interaction.user.displayName || interaction.user.username;
        await logAdminAction(guildId, interaction.user.id, userName, `Modifier heure tâches en retard: ${normalizedTime}`);

        const successEmbed = createSuccessEmbed('✅ Heure tâches en retard modifiée', `L'heure du rappel tâches en retard a été modifiée avec succès.\n\n**Nouvelle heure :** ${normalizedTime}`);
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('hour_overdue_reminder_modify').setLabel('Modifier').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('hour_button').setLabel('Retour').setStyle(ButtonStyle.Secondary)
            );

        try {
            const channel = await interaction.client.channels.fetch(interaction.channel.id);
            const messages = await channel.messages.fetch({ limit: 10 });
            const botMessage = messages.find(msg =>
                msg.author.id === interaction.client.user.id &&
                msg.embeds.length > 0 &&
                (msg.embeds[0].title === '⚠️ Tâches en retard' || msg.embeds[0].title === '✅ Heure tâches en retard modifiée')
            );

            if (botMessage) {
                await botMessage.edit({ embeds: [successEmbed], components: [buttons] });
            }
        } catch (error) {
            console.error('Erreur lors de la mise à jour du message:', error);
        }

        await interaction.deleteReply();
    } catch (error) {
        console.error('Erreur lors de la modification de l\'heure tâches en retard:', error);
        const errorEmbed = createErrorEmbed('Erreur lors de la modification.');
        const buttons = createBackButton('hour_button');

        try {
            const channel = await interaction.client.channels.fetch(interaction.channel.id);
            const messages = await channel.messages.fetch({ limit: 10 });
            const botMessage = messages.find(msg =>
                msg.author.id === interaction.client.user.id &&
                msg.embeds.length > 0 &&
                (msg.embeds[0].title === '⚠️ Tâches en retard' || msg.embeds[0].title === '✅ Heure tâches en retard modifiée')
            );

            if (botMessage) {
                await botMessage.edit({ embeds: [errorEmbed], components: [buttons] });
            }
        } catch (error) {
            console.error('Erreur lors de la mise à jour du message:', error);
        }

        await interaction.deleteReply().catch(() => {});
    }
}
