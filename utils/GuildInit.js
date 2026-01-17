import { ChannelType } from 'discord.js';
import prisma from './prisma.js';

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
    
    // Placer le rôle en dessous du bot
    const botMember = await guild.members.fetch(client.user.id);
    const botRole = botMember.roles.highest;
    if (adminRole.position >= botRole.position) {
        try {
            await adminRole.setPosition(botRole.position - 1);
            console.log(`✅ Rôle positionné en dessous du bot sur ${guild.name}`);
        } catch (error) {
            console.log(`⚠️ Impossible de positionner le rôle: ${error.message}`);
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
    
    // Créer ou mettre à jour le channel
    let adminChannel = guild.channels.cache.find(c => c.name === 'bot-pulse' && c.type === ChannelType.GuildText);
    
    if (!adminChannel) {
        adminChannel = await guild.channels.create({
            name: 'bot-pulse',
            type: ChannelType.GuildText,
            reason: 'Channel créé automatiquement par Bot Pulse',
            permissionOverwrites: [
                { id: guild.roles.everyone.id, deny: ['ViewChannel'] },
                { id: adminRole.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
                { id: client.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages'] }
            ]
        });
        console.log(`✅ Channel créé sur ${guild.name}`);
    } else {
        // Mettre à jour les permissions du channel existant
        try {
            await adminChannel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false });
            await adminChannel.permissionOverwrites.edit(adminRole, { 
                ViewChannel: true, 
                SendMessages: true, 
                ReadMessageHistory: true 
            });
            await adminChannel.permissionOverwrites.edit(client.user.id, { 
                ViewChannel: true, 
                SendMessages: true, 
                ReadMessageHistory: true, 
                ManageMessages: true 
            });
            console.log(`✅ Permissions du channel mises à jour sur ${guild.name}`);
        } catch (error) {
            console.log(`⚠️ Impossible de mettre à jour les permissions du channel: ${error.message}`);
        }
    }
    
    // Mettre à jour les permissions des channels responsables existants
    try {
        const responsables = await prisma.guildResponsable.findMany({
            where: { guildId: guild.id }
        });
        
        for (const responsable of responsables) {
            try {
                const channel = await guild.channels.fetch(responsable.channelId).catch(() => null);
                if (channel && adminRole) {
                    await channel.permissionOverwrites.edit(adminRole, {
                        ViewChannel: true,
                        SendMessages: true,
                        ReadMessageHistory: true
                    });
                }
            } catch (error) {
                console.log(`⚠️ Impossible de mettre à jour les permissions du channel ${responsable.channelId}: ${error.message}`);
            }
        }
        
        if (responsables.length > 0) {
            console.log(`✅ Permissions des channels responsables mises à jour sur ${guild.name}`);
        }
    } catch (error) {
        console.log(`⚠️ Erreur lors de la mise à jour des channels responsables: ${error.message}`);
    }
}
