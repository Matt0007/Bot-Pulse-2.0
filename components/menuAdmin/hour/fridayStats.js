import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import prisma from '../../../utils/prisma.js';
import { logAdminAction } from '../../../utils/history.js';
import { createBackButton } from '../../common/buttons.js';
import { createErrorEmbed, createInfoEmbed, createSuccessEmbed } from '../../common/embeds.js';

/**
 * Affiche la page de détail pour l'heure des stats vendredi
 */
export async function hourFridayStatsDetail(interaction) {
    try {
        const guildId = interaction.guild.id;
        const guildConfig = await prisma.guildConfig.findUnique({ where: { guildId } });
        const fridayStatsHour = guildConfig?.fridayStatsHour ?? '18:00';
        const embed = createInfoEmbed('🎉 Stats vendredi', `**Heure actuelle :** ${fridayStatsHour}\n\nLe message "Félicitations" avec les stats de la semaine est envoyé le vendredi à cette heure dans le channel bot-pulse.`);
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('hour_friday_stats_modify').setLabel('Modifier').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('hour_button').setLabel('Retour').setStyle(ButtonStyle.Secondary)
            );
        await interaction.update({ embeds: [embed], components: [buttons] });
    } catch (error) {
        console.error('Erreur lors de l\'affichage de l\'heure stats vendredi:', error);
        await interaction.reply({ content: '❌ Erreur lors de l\'affichage.', ephemeral: true });
    }
}

/**
 * Ouvre le modal pour modifier l'heure des stats vendredi
 */
export async function hourFridayStatsModify(interaction) {
    try {
        const guildId = interaction.guild.id;
        const guildConfig = await prisma.guildConfig.findUnique({
            where: { guildId }
        });

        const currentHour = guildConfig?.fridayStatsHour ?? '18:00';

        const modal = new ModalBuilder()
            .setCustomId('hour_friday_stats_modal')
            .setTitle('Modifier l\'heure des stats vendredi');

        const hourInput = new TextInputBuilder()
            .setCustomId('hour_value')
            .setLabel('Heure (HH:MM)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Ex: 18:00 ou 17:30')
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
 * Traite la soumission du modal pour l'heure des stats vendredi
 */
export async function hourFridayStatsModal(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const guildId = interaction.guild.id;
        const hourValue = interaction.fields.getTextInputValue('hour_value').trim();

        const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
        if (!timeRegex.test(hourValue)) {
            const errorEmbed = createErrorEmbed('Le format doit être HH:MM (ex: 8:00, 12:05, 22:30).\nLes heures doivent être entre 00:00 et 23:59.');
            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('hour_friday_stats_modify').setLabel('Modifier').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('hour_button').setLabel('Retour').setStyle(ButtonStyle.Secondary)
                );

            try {
                const channel = await interaction.client.channels.fetch(interaction.channel.id);
                const messages = await channel.messages.fetch({ limit: 10 });
                const botMessage = messages.find(msg =>
                    msg.author.id === interaction.client.user.id &&
                    msg.embeds.length > 0 &&
                    (msg.embeds[0].title === '🎉 Stats vendredi' || msg.embeds[0].title === '✅ Heure stats vendredi modifiée')
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
            update: { fridayStatsHour: normalizedTime },
            create: {
                guildId,
                fridayStatsHour: normalizedTime
            }
        });

        const userName = interaction.user.displayName || interaction.user.username;
        await logAdminAction(guildId, interaction.user.id, userName, `Modifier heure stats vendredi: ${normalizedTime}`);

        const successEmbed = createSuccessEmbed('✅ Heure stats vendredi modifiée', `L'heure des stats vendredi a été modifiée avec succès.\n\n**Nouvelle heure :** ${normalizedTime}`);
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('hour_friday_stats_modify').setLabel('Modifier').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('hour_button').setLabel('Retour').setStyle(ButtonStyle.Secondary)
            );

        try {
            const channel = await interaction.client.channels.fetch(interaction.channel.id);
            const messages = await channel.messages.fetch({ limit: 10 });
            const botMessage = messages.find(msg =>
                msg.author.id === interaction.client.user.id &&
                msg.embeds.length > 0 &&
                (msg.embeds[0].title === '🎉 Stats vendredi' || msg.embeds[0].title === '✅ Heure stats vendredi modifiée')
            );

            if (botMessage) {
                await botMessage.edit({ embeds: [successEmbed], components: [buttons] });
            }
        } catch (error) {
            console.error('Erreur lors de la mise à jour du message:', error);
        }

        await interaction.deleteReply();
    } catch (error) {
        console.error('Erreur lors de la modification de l\'heure stats vendredi:', error);
        const errorEmbed = createErrorEmbed('Erreur lors de la modification.');
        const buttons = createBackButton('hour_button');

        try {
            const channel = await interaction.client.channels.fetch(interaction.channel.id);
            const messages = await channel.messages.fetch({ limit: 10 });
            const botMessage = messages.find(msg =>
                msg.author.id === interaction.client.user.id &&
                msg.embeds.length > 0 &&
                (msg.embeds[0].title === '🎉 Stats vendredi' || msg.embeds[0].title === '✅ Heure stats vendredi modifiée')
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
