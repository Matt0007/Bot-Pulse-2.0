import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

/**
 * Ligne avec un seul bouton "Retour" (Secondary)
 * @param {string} customId - customId du bouton (ex: 'admin_button', 'projet_button')
 * @returns {ActionRowBuilder}
 */
export function createBackButton(customId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(customId)
            .setLabel('Retour')
            .setStyle(ButtonStyle.Secondary)
    );
}

/**
 * Ligne avec un seul bouton "OK" (Success)
 * @param {string} customId - customId du bouton (ex: 'admin_button', 'projet_button')
 * @returns {ActionRowBuilder}
 */
export function createOkButton(customId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(customId)
            .setLabel('OK')
            .setStyle(ButtonStyle.Success)
    );
}
