import cron from 'node-cron';
import prisma from '../utils/prisma.js';
import { useGetCompletedTasks } from '../hook/clickup/useGetCompletedTasks.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export const completedTasksCache = new Map();
const ITEMS_PER_PAGE = 25;
const EMBED_COLORS = { ERROR: 0xFF0000, TASK: 0x5865F2 };

function formatDate() {
    const today = new Date();
    const jours = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
    const jour = jours[today.getDay()];
    const jourNum = String(today.getDate()).padStart(2, '0');
    const mois = String(today.getMonth() + 1).padStart(2, '0');
    const annee = today.getFullYear();
    return `${jour} ${jourNum}/${mois}/${annee}`;
}

export function createCompletedTaskList(tasks, currentPage = null) {
    const startIndex = currentPage !== null ? currentPage * ITEMS_PER_PAGE : 0;
    const endIndex = currentPage !== null ? Math.min(startIndex + ITEMS_PER_PAGE, tasks.length) : tasks.length;
    const tasksList = [];
    let taskNumber = startIndex;
    
    for (let i = startIndex; i < endIndex; i++) {
        const task = tasks[i];
        taskNumber++;
        const numberStr = taskNumber.toString().padStart(2, '0');
        tasksList.push(task.isSubtask 
            ? `${numberStr}. _-_ ${task.nom}`
            : `${numberStr}. **${task.nom}**`);
    }
    
    const result = tasksList.join('\n');
    const legend = `\n\n**Tâche** | - Sous-tâche`;
    
    if (result.length + legend.length > 4096) {
        return result.length > 4096 ? result.substring(0, 4093) + '...' : result;
    }
    return result + legend;
}

function createPaginationComponents(tasks, currentPage) {
    const totalPages = Math.ceil(tasks.length / ITEMS_PER_PAGE);
    if (totalPages <= 1) return { components: [], totalPages };
    
    return {
        components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('completed-tasks-page-prev').setLabel(' << ').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 0),
            new ButtonBuilder().setCustomId('completed-tasks-page-next').setLabel(' >> ').setStyle(ButtonStyle.Secondary).setDisabled(currentPage >= totalPages - 1)
        )],
        totalPages
    };
}

function createEmbed(responsableName, tasksList, footerText) {
    return new EmbedBuilder()
        .setTitle(`✅ Tâches complétées de ${responsableName} le ${formatDate()}`)
        .setDescription(tasksList)
        .setFooter({ text: footerText })
        .setColor(0x00FF00)
        .setTimestamp();
}

async function sendCompletedTasks(client, guildId, responsableName, channelId, configuredProjectIds) {
    try {
        const completedTasks = await useGetCompletedTasks(guildId, responsableName, configuredProjectIds);
        if (completedTasks.length === 0) return;

        const channel = await client.channels.fetch(channelId);
        if (!channel) {
            console.error(`Channel ${channelId} introuvable pour le responsable ${responsableName}`);
            return;
        }

        const tasksList = createCompletedTaskList(completedTasks);
        const embed = createEmbed(responsableName, tasksList, `${completedTasks.length} tâche(s) complétée(s)`);
        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error(`Erreur lors de l'envoi des tâches complétées pour ${responsableName}:`, error);
    }
}

async function checkAndSendCompletedTasks(client) {
    try {
        const dayOfWeek = new Date().getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) return;

        const guildConfigs = await prisma.guildConfig.findMany({
            where: { completedHour: { not: null }, clickupApiKey: { not: null } }
        });

        const currentHour = new Date().getHours();

        for (const config of guildConfigs) {
            if (config.completedHour !== currentHour) continue;

            try {
                const [responsables, projects] = await Promise.all([
                    prisma.guildResponsable.findMany({ where: { guildId: config.guildId } }),
                    prisma.guildProject.findMany({ where: { guildId: config.guildId } })
                ]);

                const projectIds = projects.map(p => p.projectId);
                for (const responsable of responsables) {
                    await sendCompletedTasks(client, config.guildId, responsable.responsableName, responsable.channelId, projectIds);
                }
            } catch (error) {
                console.error(`Erreur lors du traitement du serveur ${config.guildId}:`, error);
            }
        }
    } catch (error) {
        console.error('Erreur lors de la vérification des tâches complétées:', error);
    }
}

export function startCompletedTasksScheduler(client) {
    cron.schedule('0 * * * 1-5', () => checkAndSendCompletedTasks(client));
    console.log('✅ Scheduler des tâches complétées démarré (lundi à vendredi uniquement)');
}

export async function tacheCompleted(interaction) {
    try {
        await interaction.deferReply();

        const responsable = await prisma.guildResponsable.findUnique({
            where: { channelId: interaction.channel.id },
            include: { users: true }
        });
        
        if (!responsable) {
            return await interaction.editReply({
                embeds: [new EmbedBuilder().setTitle('❌ Channel non associé')
                    .setDescription('Ce channel n\'est pas associé à un responsable. Utilisez le menu admin pour associer un responsable à ce channel.')
                    .setColor(EMBED_COLORS.ERROR)]
            });
        }
        
        const isUserInResponsable = responsable.users.some(u => u.userId === interaction.user.id);
        const adminRole = interaction.guild.roles.cache.find(role => role.name === 'Admin Bot' || role.name === 'bot_admin');
        const isAdmin = adminRole && interaction.member.roles.cache.has(adminRole.id);
        const isOwner = interaction.guild.ownerId === interaction.user.id;
        
        if (!isUserInResponsable && !isAdmin && !isOwner) {
            return await interaction.editReply({
                embeds: [new EmbedBuilder().setTitle('❌ Accès refusé')
                    .setDescription('Cette commande ne peut être utilisée que dans votre channel privé de responsable.')
                    .setColor(EMBED_COLORS.ERROR)]
            });
        }

        const projets = await prisma.guildProject.findMany({ where: { guildId: interaction.guild.id } });
        if (projets.length === 0) {
            return await interaction.editReply({
                embeds: [new EmbedBuilder().setTitle('❌ Aucun projet configuré')
                    .setDescription('Aucun projet configuré. Un admin doit ajouter des projets.')
                    .setColor(EMBED_COLORS.ERROR)]
            });
        }

        const completedTasks = await useGetCompletedTasks(interaction.guild.id, responsable.responsableName, projets.map(p => p.projectId));

        if (completedTasks.length === 0) {
            return await interaction.editReply({
                content: `✅ Aucune tâche complétée aujourd'hui pour **${responsable.responsableName}**.\n\n💡 Vérifiez que:\n- Le statut de la tâche contient "complété" ou "completed"\n- La tâche a été complétée aujourd'hui\n- Le responsable correspond exactement à "${responsable.responsableName}"`
            });
        }

        const currentPage = 0;
        completedTasksCache.set(interaction.user.id, {
            tasks: completedTasks,
            currentPage,
            responsableName: responsable.responsableName,
            timestamp: Date.now()
        });

        const tasksList = createCompletedTaskList(completedTasks, currentPage);
        const { components, totalPages } = createPaginationComponents(completedTasks, currentPage);
        const footerText = `${completedTasks.length} tâche(s) complétée(s)${totalPages > 1 ? ` • Page ${currentPage + 1}/${totalPages}` : ''}`;
        const embed = createEmbed(responsable.responsableName, tasksList, footerText);

        await interaction.editReply({
            embeds: [embed],
            components: components.length > 0 ? components : undefined
        });
    } catch (error) {
        console.error('Erreur lors de l\'exécution de la commande /tache completed:', error);
        await interaction.editReply({
            embeds: [new EmbedBuilder().setTitle('❌ Erreur')
                .setDescription('Erreur lors de la récupération des tâches complétées. Veuillez réessayer plus tard.')
                .setColor(EMBED_COLORS.ERROR)]
        });
    }
}

export async function handleCompletedTasksPagination(interaction) {
    try {
        const userId = interaction.user.id;
        const cachedData = completedTasksCache.get(userId);
        const sessionTimeout = 30 * 60 * 1000;
        
        if (!cachedData || Date.now() - cachedData.timestamp > sessionTimeout) {
            if (cachedData) completedTasksCache.delete(userId);
            return await interaction.reply({
                content: '❌ La session a expiré. Utilisez `/tache completed` pour rafraîchir.',
                ephemeral: true
            });
        }

        const { tasks, currentPage, responsableName } = cachedData;
        let newPage = currentPage;
        
        if (interaction.customId === 'completed-tasks-page-prev') {
            newPage = Math.max(0, currentPage - 1);
        } else if (interaction.customId === 'completed-tasks-page-next') {
            newPage = Math.min(Math.ceil(tasks.length / ITEMS_PER_PAGE) - 1, currentPage + 1);
        }

        completedTasksCache.set(userId, { ...cachedData, currentPage: newPage });

        const tasksList = createCompletedTaskList(tasks, newPage);
        const { components, totalPages } = createPaginationComponents(tasks, newPage);
        const footerText = `${tasks.length} tâche(s) complétée(s)${totalPages > 1 ? ` • Page ${newPage + 1}/${totalPages}` : ''}`;
        const embed = createEmbed(responsableName, tasksList, footerText);

        await interaction.update({ embeds: [embed], components: components.length > 0 ? components : undefined });
    } catch (error) {
        console.error('Erreur lors de la pagination des tâches complétées:', error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Erreur lors de la pagination. Veuillez réessayer.', ephemeral: true });
        }
    }
}
