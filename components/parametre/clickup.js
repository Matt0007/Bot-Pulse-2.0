import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, '../../config.json');

// Fonction pour charger la config
function loadConfig() {
    try {
        if (fs.existsSync(configPath)) {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
    } catch (error) {
        console.error('Erreur lors du chargement de la config:', error);
    }
    return {};
}

// Fonction pour sauvegarder la config
function saveConfig(config) {
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Erreur lors de la sauvegarde de la config:', error);
        return false;
    }
}

export async function clickupButton(interaction) {
    const config = loadConfig();
    const hasApiKey = config.clickupApiKey && config.clickupApiKey.trim() !== '';
    
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
    const apiKey = interaction.fields.getTextInputValue('clickup_api_key');
    
    const config = loadConfig();
    config.clickupApiKey = apiKey.trim();
    
    if (saveConfig(config)) {
        const embed = new EmbedBuilder()
            .setTitle('✅ Clé API ClickUp configurée')
            .setDescription('La clé API ClickUp a été enregistrée avec succès.')
            .setColor(0x00FF00);
        
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('clickup_button')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.reply({ embeds: [embed], components: [backButton], ephemeral: true });
    } else {
        const embed = new EmbedBuilder()
            .setTitle('❌ Erreur')
            .setDescription('Impossible de sauvegarder la clé API.')
            .setColor(0xFF0000);
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}
