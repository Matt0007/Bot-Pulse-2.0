import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import prisma from '../../../utils/prisma.js';
import { encrypt, decrypt } from '../../../utils/encryption.js';

export async function clickupButton(interaction) {
    try {
        const guildConfig = await prisma.guildConfig.findUnique({
            where: { guildId: interaction.guild.id }
        });
        
        // Vérifier si une clé API chiffrée existe
        let hasApiKey = false;
        if (guildConfig?.clickupApiKey) {
            try {
                // Tenter de déchiffrer pour vérifier que la clé est valide
                const decrypted = decrypt(guildConfig.clickupApiKey);
                hasApiKey = decrypted && decrypted.trim() !== '';
            } catch (error) {
                console.error('Erreur lors du déchiffrement de la clé API:', error);
                hasApiKey = false;
            }
        }
        
        const embed = new EmbedBuilder()
            .setTitle('🔑 Clé API ClickUp')
            .setDescription(hasApiKey 
                ? '✅ Une clé API est configurée.\nCliquez sur "Modifier" pour la changer.'
                : '❌ Aucune clé API configurée.\nCliquez sur "Configurer" pour en ajouter une.')
            .setColor(hasApiKey ? 0x00FF00 : 0xFF0000);
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('clickup_configure_button')
                    .setLabel(hasApiKey ? 'Modifier' : 'Configurer')
                    .setStyle(hasApiKey ? ButtonStyle.Secondary : ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('parametre_button')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.update({ embeds: [embed], components: [buttons] });
    } catch (error) {
        console.error('Erreur lors de la récupération de la config:', error);
        const embed = new EmbedBuilder()
            .setTitle('❌ Erreur')
            .setDescription('Impossible de charger la configuration.')
            .setColor(0xFF0000);
        
        await interaction.update({ embeds: [embed], components: [] });
    }
}

export async function clickupConfigure(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('clickup_api_modal')
        .setTitle('Configuration de la clé API ClickUp');
    
    const apiKeyInput = new TextInputBuilder()
        .setCustomId('clickup_api_key')
        .setLabel('Clé API ClickUp')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Entrez votre clé API ClickUp')
        .setRequired(true);
    
    const row = new ActionRowBuilder().addComponents(apiKeyInput);
    modal.addComponents(row);
    
    await interaction.showModal(modal);
}

export async function clickupApiModal(interaction) {
    try {
        const apiKey = interaction.fields.getTextInputValue('clickup_api_key');
        
        // Chiffrer la clé API avant de la stocker
        const encryptedApiKey = encrypt(apiKey.trim());
        
        if (!encryptedApiKey) {
            throw new Error('Impossible de chiffrer la clé API');
        }
        
        await prisma.guildConfig.upsert({
            where: { guildId: interaction.guild.id },
            update: { clickupApiKey: encryptedApiKey },
            create: { 
                guildId: interaction.guild.id,
                clickupApiKey: encryptedApiKey
            }
        });
        
        const embed = new EmbedBuilder()
            .setTitle('✅ Clé API ClickUp configurée')
            .setDescription('La clé API ClickUp a été enregistrée et chiffrée avec succès.')
            .setColor(0x00FF00);
        
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('clickup_button')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.reply({ embeds: [embed], components: [backButton] });
    } catch (error) {
        console.error('Erreur lors de la sauvegarde de la clé API:', error);
        const embed = new EmbedBuilder()
            .setTitle('❌ Erreur')
            .setDescription('Impossible de sauvegarder la clé API.')
            .setColor(0xFF0000);
        
        await interaction.reply({ embeds: [embed] });
    }
}
