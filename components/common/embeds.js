import { EmbedBuilder } from 'discord.js';

/** Couleurs standard pour les embeds */
export const embedColors = {
    error: 0xFF0000,
    success: 0x00FF00,
    warning: 0xFFA500,
    info: 0x5865F2,
};

/**
 * Embed d'erreur (titre fixe "❌ Erreur", rouge)
 * @param {string} description
 * @returns {EmbedBuilder}
 */
export function createErrorEmbed(description) {
    return new EmbedBuilder()
        .setTitle('❌ Erreur')
        .setDescription(description)
        .setColor(embedColors.error);
}

/**
 * Embed de succès (vert)
 * @param {string} title
 * @param {string} description
 * @returns {EmbedBuilder}
 */
export function createSuccessEmbed(title, description) {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(embedColors.success);
}

/**
 * Embed d'avertissement (orange)
 * @param {string} title
 * @param {string} description
 * @returns {EmbedBuilder}
 */
export function createWarningEmbed(title, description) {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(embedColors.warning);
}

/**
 * Embed d'information / formulaire (bleu Discord)
 * @param {string} title
 * @param {string} description
 * @returns {EmbedBuilder}
 */
export function createInfoEmbed(title, description) {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(embedColors.info);
}
