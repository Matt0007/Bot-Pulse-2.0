import prisma from './prisma.js';
import { decrypt } from './encryption.js';

/**
 * Récupère tous les projets ClickUp (spaces)
 * @param {string} guildId - ID du serveur Discord
 * @returns {Promise<Array>} - Liste des projets (spaces)
 */
export async function getAllClickUpProjects(guildId) {
    // Récupérer la clé API depuis la base de données
    const guildConfig = await prisma.guildConfig.findUnique({
        where: { guildId }
    });

    if (!guildConfig?.clickupApiKey) {
        throw new Error('Clé API ClickUp non configurée');
    }

    const apiKey = decrypt(guildConfig.clickupApiKey);

    // Récupérer tous les teams
    const teamsResponse = await fetch('https://api.clickup.com/api/v2/team', {
        headers: {
            'Authorization': apiKey
        }
    });

    if (!teamsResponse.ok) {
        throw new Error(`Erreur API ClickUp: ${teamsResponse.status}`);
    }

    const teamsData = await teamsResponse.json();
    const teams = teamsData.teams || [];

    // Récupérer tous les spaces de tous les teams
    const projects = [];

    for (const team of teams) {
        const spacesResponse = await fetch(`https://api.clickup.com/api/v2/team/${team.id}/space`, {
            headers: {
                'Authorization': apiKey
            }
        });

        if (!spacesResponse.ok) continue;

        const spacesData = await spacesResponse.json();
        const spaces = spacesData.spaces || [];

        for (const space of spaces) {
            projects.push({
                id: space.id,
                name: space.name
            });
        }
    }

    return projects;
}
