import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import prisma from '../../../utils/prisma.js';
import { logAdminAction } from '../../../utils/history.js';
import { createBackButton } from '../../common/buttons.js';
import { createErrorEmbed, createInfoEmbed, createSuccessEmbed } from '../../common/embeds.js';

/**
 * Affiche la page de détail pour l'heure du rappel échéances demain
 */
export async function hourTomorrowReminderDetail(interaction) {
    try {
        const guildId = interaction.guild.id;
        const guildConfig = await prisma.guildConfig.findUnique({ where: { guildId } });
        const tomorrowReminderHour = guildConfig?.tomorrowReminderHour ?? '20:00';
        const embed = createInfoEmbed('📅 Échéances demain', `**Heure actuelle :** ${tomorrowReminderHour}\n\nLe rappel des tâches dont l'échéance est demain est envoyé chaque jour à cette heure dans le channel de chaque responsable.`);
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('hour_tomorrow_reminder_modify').setLabel('Modifier').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('hour_button').setLabel('Retour').setStyle(ButtonStyle.Secondary)
            );
        await interaction.update({ embeds: [embed], components: [buttons] });
    } catch (error) {
        console.error('Erreur lors de l\'affichage de l\'heure échéances demain:', error);
        await interaction.reply({ content: '❌ Erreur lors de l\'affichage.', ephemeral: true });
    }
}

/**
 * Ouvre le modal pour modifier l'heure du rappel échéances demain
 */
export async function hourTomorrowReminderModify(interaction) {
    try {
        const guildId = interaction.guild.id;
        const guildConfig = await prisma.guildConfig.findUnique({
            where: { guildId }
        });

        const currentHour = guildConfig?.tomorrowReminderHour ?? '20:00';

        const modal = new ModalBuilder()
            .setCustomId('hour_tomorrow_reminder_modal')
            .setTitle('Modifier l\'heure du rappel échéances demain');

        const hourInput = new TextInputBuilder()
            .setCustomId('hour_value')
            .setLabel('Heure (HH:MM)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Ex: 20:00 ou 18:00')
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
 * Traite la soumission du modal pour l'heure du rappel échéances demain
 */
export async function hourTomorrowReminderModal(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const guildId = interaction.guild.id;
        const hourValue = interaction.fields.getTextInputValue('hour_value').trim();

        const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
        if (!timeRegex.test(hourValue)) {
            const errorEmbed = createErrorEmbed('Le format doit être HH:MM (ex: 8:00, 12:05, 22:30).\nLes heures doivent être entre 00:00 et 23:59.');
            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('hour_tomorrow_reminder_modify').setLabel('Modifier').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('hour_button').setLabel('Retour').setStyle(ButtonStyle.Secondary)
                );

            try {
                const channel = await interaction.client.channels.fetch(interaction.channel.id);
                const messages = await channel.messages.fetch({ limit: 10 });
                const botMessage = messages.find(msg =>
                    msg.author.id === interaction.client.user.id &&
                    msg.embeds.length > 0 &&
                    (msg.embeds[0].title === '📅 Échéances demain' || msg.embeds[0].title === '✅ Heure échéances demain modifiée')
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
            update: { tomorrowReminderHour: normalizedTime },
            create: {
                guildId,
                tomorrowReminderHour: normalizedTime
            }
        });

        const userName = interaction.user.displayName || interaction.user.username;
        await logAdminAction(guildId, interaction.user.id, userName, `Modifier heure échéances demain: ${normalizedTime}`);

        const successEmbed = createSuccessEmbed('✅ Heure échéances demain modifiée', `L'heure du rappel échéances demain a été modifiée avec succès.\n\n**Nouvelle heure :** ${normalizedTime}`);
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('hour_tomorrow_reminder_modify').setLabel('Modifier').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('hour_button').setLabel('Retour').setStyle(ButtonStyle.Secondary)
            );

        try {
            const channel = await interaction.client.channels.fetch(interaction.channel.id);
            const messages = await channel.messages.fetch({ limit: 10 });
            const botMessage = messages.find(msg =>
                msg.author.id === interaction.client.user.id &&
                msg.embeds.length > 0 &&
                (msg.embeds[0].title === '📅 Échéances demain' || msg.embeds[0].title === '✅ Heure échéances demain modifiée')
            );

            if (botMessage) {
                await botMessage.edit({ embeds: [successEmbed], components: [buttons] });
            }
        } catch (error) {
            console.error('Erreur lors de la mise à jour du message:', error);
        }

        await interaction.deleteReply();
    } catch (error) {
        console.error('Erreur lors de la modification de l\'heure échéances demain:', error);
        const errorEmbed = createErrorEmbed('Erreur lors de la modification.');
        const buttons = createBackButton('hour_button');

        try {
            const channel = await interaction.client.channels.fetch(interaction.channel.id);
            const messages = await channel.messages.fetch({ limit: 10 });
            const botMessage = messages.find(msg =>
                msg.author.id === interaction.client.user.id &&
                msg.embeds.length > 0 &&
                (msg.embeds[0].title === '📅 Échéances demain' || msg.embeds[0].title === '✅ Heure échéances demain modifiée')
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
