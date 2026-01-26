import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import prisma from '../../../utils/prisma.js';
import { logAdminAction } from '../../../utils/history.js';
import { createBackButton } from '../../common/buttons.js';
import { createErrorEmbed, createInfoEmbed, createSuccessEmbed } from '../../common/embeds.js';

/**
 * Affiche la page de détail pour l'heure du matin
 */
export async function hourMorningDetail(interaction) {
    try {
        const guildId = interaction.guild.id;
        const guildConfig = await prisma.guildConfig.findUnique({ where: { guildId } });
        const morningHour = guildConfig?.morningHour ?? '8:00';
        const embed = createInfoEmbed('🌅 Heure du matin', `**Heure actuelle :** ${morningHour}`);
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('hour_morning_modify').setLabel('Modifier').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('hour_button').setLabel('Retour').setStyle(ButtonStyle.Secondary)
            );
        await interaction.update({ embeds: [embed], components: [buttons] });
    } catch (error) {
        console.error('Erreur lors de l\'affichage de l\'heure du matin:', error);
        await interaction.reply({ content: '❌ Erreur lors de l\'affichage.', ephemeral: true });
    }
}

/**
 * Ouvre le modal pour modifier l'heure du matin
 */
export async function hourMorningModify(interaction) {
    try {
        const guildId = interaction.guild.id;
        const guildConfig = await prisma.guildConfig.findUnique({
            where: { guildId }
        });

        const currentHour = guildConfig?.morningHour ?? '8:00';

        const modal = new ModalBuilder()
            .setCustomId('hour_morning_modal')
            .setTitle('Modifier l\'heure du matin');

        const hourInput = new TextInputBuilder()
            .setCustomId('hour_value')
            .setLabel('Heure (HH:MM)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Ex: 8:00 ou 12:05')
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
 * Traite la soumission du modal pour l'heure du matin
 */
export async function hourMorningModal(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const guildId = interaction.guild.id;
        const hourValue = interaction.fields.getTextInputValue('hour_value').trim();

        const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
        if (!timeRegex.test(hourValue)) {
            const errorEmbed = createErrorEmbed('Le format doit être HH:MM (ex: 8:00, 12:05, 22:30).\nLes heures doivent être entre 00:00 et 23:59.');
            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('hour_morning_modify').setLabel('Modifier').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('hour_button').setLabel('Retour').setStyle(ButtonStyle.Secondary)
                );

            // Récupérer le message original et le mettre à jour
            try {
                const channel = await interaction.client.channels.fetch(interaction.channel.id);
                const messages = await channel.messages.fetch({ limit: 10 });
                const botMessage = messages.find(msg => 
                    msg.author.id === interaction.client.user.id && 
                    msg.embeds.length > 0 &&
                    (msg.embeds[0].title === '🌅 Heure du matin' || msg.embeds[0].title === '✅ Heure du matin modifiée')
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

        // Normaliser le format (ajouter un 0 devant l'heure si nécessaire)
        const [hours, minutes] = hourValue.split(':');
        const normalizedTime = `${hours.padStart(2, '0')}:${minutes}`;

        // Mettre à jour ou créer la configuration
        await prisma.guildConfig.upsert({
            where: { guildId },
            update: { morningHour: normalizedTime },
            create: {
                guildId,
                morningHour: normalizedTime
            }
        });

        // Enregistrer dans l'historique
        const userName = interaction.user.displayName || interaction.user.username;
        await logAdminAction(guildId, interaction.user.id, userName, `Modifier heure matin: ${normalizedTime}`);

        const successEmbed = createSuccessEmbed('✅ Heure du matin modifiée', `L'heure du matin a été modifiée avec succès.\n\n**Nouvelle heure :** ${normalizedTime}`);
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('hour_morning_modify').setLabel('Modifier').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('hour_button').setLabel('Retour').setStyle(ButtonStyle.Secondary)
            );

        // Récupérer le message original et le mettre à jour avec le message de succès
        try {
            const channel = await interaction.client.channels.fetch(interaction.channel.id);
            const messages = await channel.messages.fetch({ limit: 10 });
            const botMessage = messages.find(msg => 
                msg.author.id === interaction.client.user.id && 
                msg.embeds.length > 0 &&
                (msg.embeds[0].title === '🌅 Heure du matin' || msg.embeds[0].title === '✅ Heure du matin modifiée')
            );
            
            if (botMessage) {
                await botMessage.edit({ embeds: [successEmbed], components: [buttons] });
            }
        } catch (error) {
            console.error('Erreur lors de la mise à jour du message:', error);
        }
        
        await interaction.deleteReply();
    } catch (error) {
        console.error('Erreur lors de la modification de l\'heure du matin:', error);
        const errorEmbed = createErrorEmbed('Erreur lors de la modification.');
        const buttons = createBackButton('hour_button');

        try {
            const channel = await interaction.client.channels.fetch(interaction.channel.id);
            const messages = await channel.messages.fetch({ limit: 10 });
            const botMessage = messages.find(msg => 
                msg.author.id === interaction.client.user.id && 
                msg.embeds.length > 0 &&
                (msg.embeds[0].title === '🌅 Heure du matin' || 
                 msg.embeds[0].title === '✅ Heure du matin modifiée' ||
                 msg.embeds[0].title === '✅ Heure complétée' ||
                 msg.embeds[0].title === '✅ Heure complétée modifiée')
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
