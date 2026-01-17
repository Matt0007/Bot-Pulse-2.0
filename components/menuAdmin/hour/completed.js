import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import prisma from '../../../utils/prisma.js';
import { logAdminAction } from '../../../utils/history.js';

/**
 * Affiche la page de détail pour l'heure complétée
 */
export async function hourCompletedDetail(interaction) {
    try {
        const guildId = interaction.guild.id;
        const guildConfig = await prisma.guildConfig.findUnique({
            where: { guildId }
        });

        const completedHour = guildConfig?.completedHour ?? 22;

        const embed = new EmbedBuilder()
            .setTitle('✅ Heure complétée')
            .setDescription(`**Heure actuelle :** ${completedHour}h`)
            .setColor(0x5865F2);

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('hour_completed_modify')
                    .setLabel('Modifier')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('hour_button')
                    .setLabel('← Retour')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.update({ embeds: [embed], components: [buttons] });
    } catch (error) {
        console.error('Erreur lors de l\'affichage de l\'heure complétée:', error);
        await interaction.reply({ content: '❌ Erreur lors de l\'affichage.', ephemeral: true });
    }
}

/**
 * Ouvre le modal pour modifier l'heure complétée
 */
export async function hourCompletedModify(interaction) {
    try {
        const guildId = interaction.guild.id;
        const guildConfig = await prisma.guildConfig.findUnique({
            where: { guildId }
        });

        const currentHour = guildConfig?.completedHour ?? 22;

        const modal = new ModalBuilder()
            .setCustomId('hour_completed_modal')
            .setTitle('Modifier l\'heure complétée');

        const hourInput = new TextInputBuilder()
            .setCustomId('hour_value')
            .setLabel('Heure (0-23)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Ex: 22')
            .setRequired(true)
            .setMaxLength(2)
            .setValue(currentHour.toString());

        const row = new ActionRowBuilder().addComponents(hourInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
    } catch (error) {
        console.error('Erreur lors de l\'ouverture du modal:', error);
        await interaction.reply({ content: '❌ Erreur lors de l\'ouverture du formulaire.', ephemeral: true });
    }
}

/**
 * Traite la soumission du modal pour l'heure complétée
 */
export async function hourCompletedModal(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const guildId = interaction.guild.id;
        const hourValue = interaction.fields.getTextInputValue('hour_value').trim();

        const hour = parseInt(hourValue);
        if (isNaN(hour) || hour < 0 || hour > 23) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Erreur')
                .setDescription('L\'heure doit être un nombre entre 0 et 23.')
                .setColor(0xFF0000);

            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('hour_completed_modify')
                        .setLabel('Modifier')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('hour_button')
                        .setLabel('← Retour')
                        .setStyle(ButtonStyle.Secondary)
                );

            // Récupérer le message original et le mettre à jour
            try {
                const channel = await interaction.client.channels.fetch(interaction.channel.id);
                const messages = await channel.messages.fetch({ limit: 10 });
                const botMessage = messages.find(msg => 
                    msg.author.id === interaction.client.user.id && 
                    msg.embeds.length > 0 &&
                    msg.embeds[0].title === '✅ Heure complétée'
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

        // Mettre à jour ou créer la configuration
        await prisma.guildConfig.upsert({
            where: { guildId },
            update: { completedHour: hour },
            create: {
                guildId,
                completedHour: hour
            }
        });

        // Enregistrer dans l'historique
        const userName = interaction.user.displayName || interaction.user.username;
        await logAdminAction(guildId, interaction.user.id, userName, `Modifier heure complétée: ${hour}h`);

        const embed = new EmbedBuilder()
            .setTitle('✅ Heure complétée')
            .setDescription(`**Heure actuelle :** ${hour}h`)
            .setColor(0x5865F2);

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('hour_completed_modify')
                    .setLabel('Modifier')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('hour_button')
                    .setLabel('← Retour')
                    .setStyle(ButtonStyle.Secondary)
            );

        // Récupérer le message original et le mettre à jour
        try {
            const channel = await interaction.client.channels.fetch(interaction.channel.id);
            const messages = await channel.messages.fetch({ limit: 10 });
            const botMessage = messages.find(msg => 
                msg.author.id === interaction.client.user.id && 
                msg.embeds.length > 0 &&
                msg.embeds[0].title === '✅ Heure complétée'
            );
            
            if (botMessage) {
                await botMessage.edit({ embeds: [embed], components: [buttons] });
            }
        } catch (error) {
            console.error('Erreur lors de la mise à jour du message:', error);
        }
        
        await interaction.deleteReply();
    } catch (error) {
        console.error('Erreur lors de la modification de l\'heure complétée:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setTitle('❌ Erreur')
            .setDescription('Erreur lors de la modification.')
            .setColor(0xFF0000);

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('hour_button')
                    .setLabel('← Retour')
                    .setStyle(ButtonStyle.Secondary)
            );

        try {
            const channel = await interaction.client.channels.fetch(interaction.channel.id);
            const messages = await channel.messages.fetch({ limit: 10 });
            const botMessage = messages.find(msg => 
                msg.author.id === interaction.client.user.id && 
                msg.embeds.length > 0 &&
                (msg.embeds[0].title === '🌅 Heure du matin' || msg.embeds[0].title === '✅ Heure complétée')
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
