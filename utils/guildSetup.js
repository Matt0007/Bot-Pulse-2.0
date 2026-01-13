import { ChannelType } from 'discord.js';

export async function initializeGuild(guild, client) {
    // Créer ou récupérer le rôle
    let adminRole = guild.roles.cache.find(r => r.name === 'Bot Pulse Admin');
    if (!adminRole) {
        adminRole = await guild.roles.create({
            name: 'Bot Pulse Admin',
            hoist: false,
            mentionable: false,
            reason: 'Rôle créé automatiquement par Bot Pulse'
        });
        console.log(`✅ Rôle créé sur ${guild.name}`);
    }
    
    // Placer le rôle en haut
    const botRole = (await guild.members.fetch(client.user.id)).roles.highest;
    if (adminRole.position < botRole.position - 1) {
        try {
            await adminRole.setPosition(botRole.position - 1);
        } catch {
            console.log(`⚠️ Impossible de placer le rôle en haut sur ${guild.name}`);
        }
    }
    
    // Ajouter le propriétaire au rôle
    try {
        const owner = await guild.fetchOwner();
        if (owner && !owner.roles.cache.has(adminRole.id)) {
            await owner.roles.add(adminRole);
            console.log(`✅ Propriétaire ajouté au rôle sur ${guild.name}`);
        }
    } catch (error) {
        console.log(`⚠️ Impossible d'ajouter le propriétaire: ${error.message}`);
    }
    
    // Créer le channel si nécessaire
    if (!guild.channels.cache.find(c => c.name === 'bot-pulse-admin' && c.type === ChannelType.GuildText)) {
        await guild.channels.create({
            name: 'bot-pulse-admin',
            type: ChannelType.GuildText,
            reason: 'Channel créé automatiquement par Bot Pulse',
            permissionOverwrites: [
                { id: guild.roles.everyone.id, deny: ['ViewChannel'] },
                { id: adminRole.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
                { id: client.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages'] }
            ]
        });
        console.log(`✅ Channel créé sur ${guild.name}`);
    }
}
