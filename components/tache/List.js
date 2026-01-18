import { EmbedBuilder } from 'discord.js';
import prisma from '../../utils/prisma.js';
import { useGetAllTask } from '../../hook/clickup/useGetAllTask.js';
import { createTaskList, createTaskPaginationComponents, createFooterText } from './liste/pagination.js';
import { tasksCache } from './liste/cache.js';

// Couleurs des embeds Discord
const EMBED_COLORS = {
    ERROR: 0xFF0000,      // Rouge - Messages d'erreur
    TASK: 0x5865F2,      // Bleu Discord - Listes de tâches
};

/**
 * Affiche la liste des tâches d'un responsable dans son channel
 */
export async function tacheList(interaction) {
    try {
        await interaction.deferReply();

        // Récupérer le responsable associé au channel
        const responsable = await prisma.guildResponsable.findUnique({
            where: { channelId: interaction.channel.id },
            include: { users: true }
        });
        
        if (!responsable) {
            const embed = new EmbedBuilder()
                .setTitle('❌ Channel non associé')
                .setDescription('Ce channel n\'est pas associé à un responsable. Utilisez le menu admin pour associer un responsable à ce channel.')
                .setColor(EMBED_COLORS.ERROR);
            
            return await interaction.editReply({
                embeds: [embed],
            });
        }
        
        // Vérifier que l'utilisateur est bien associé à ce responsable (ou qu'il est admin)
        const isUserInResponsable = responsable.users.some(u => u.userId === interaction.user.id);
        const adminRole = interaction.guild.roles.cache.find(r => r.name === 'Bot Pulse Admin');
        const isAdmin = adminRole && interaction.member.roles.cache.has(adminRole.id);
        const isOwner = interaction.guild.ownerId === interaction.user.id;
        
        if (!isUserInResponsable && !isAdmin && !isOwner) {
            const embed = new EmbedBuilder()
                .setTitle('❌ Accès refusé')
                .setDescription('Cette commande ne peut être utilisée que dans votre channel privé de responsable.')
                .setColor(EMBED_COLORS.ERROR);
            
            return await interaction.editReply({
                embeds: [embed],
            });
        }

        // Récupérer les projets configurés
        const projets = await prisma.guildProject.findMany({
            where: { guildId: interaction.guild.id }
        });
        
        if (projets.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle('❌ Aucun projet configuré')
                .setDescription('Aucun projet configuré. Un admin doit ajouter des projets.')
                .setColor(EMBED_COLORS.ERROR);
            
            return await interaction.editReply({
                embeds: [embed],
            });
        }

        // Extraire les IDs des projets configurés
        const configuredProjectIds = projets.map(p => p.projectId);

        // Récupérer les tâches du responsable depuis les projets configurés
        const tasks = await useGetAllTask(interaction.guild.id, responsable.responsableName, configuredProjectIds);

        if (tasks.length === 0) {
            return await interaction.editReply({
                content: `✅ Aucune tâche "à faire" ou "en cours" trouvée pour **${responsable.responsableName}**.`,
            });
        }

        // Stocker les tâches dans le cache pour les interactions (avec pagination)
        const currentPage = 0;
        tasksCache.set(interaction.user.id, {
            tasks: tasks,
            timestamp: Date.now(),
            currentPage: currentPage,
            responsableName: responsable.responsableName,
            guildId: interaction.guild.id
        });

        // Créer la liste des tâches de la page actuelle
        const tasksList = createTaskList(tasks, currentPage);
        
        // Créer les composants (boutons de pagination)
        const { components, totalPages } = createTaskPaginationComponents(tasks, currentPage);
        
        // Créer le footer
        const footerText = createFooterText(tasks, totalPages, currentPage);

        // Créer l'embed
        const embed = new EmbedBuilder()
            .setTitle(`📋 Tâches de ${responsable.responsableName}`)
            .setDescription(tasksList)
            .setFooter({ text: footerText })
            .setColor(EMBED_COLORS.TASK);

        const message = await interaction.editReply({
            embeds: [embed],
            components: components.length > 0 ? components : undefined
        });

        // Stocker l'ID du message dans le cache pour pouvoir le mettre à jour plus tard
        tasksCache.set(interaction.user.id, {
            ...tasksCache.get(interaction.user.id),
            listMessageId: message.id,
            listChannelId: interaction.channel.id
        });

    } catch (error) {
        console.error('Erreur lors de l\'exécution de la commande /tache list:', error);
        const embed = new EmbedBuilder()
            .setTitle('❌ Erreur')
            .setDescription('Erreur lors de la récupération des tâches. Veuillez réessayer plus tard.')
            .setColor(EMBED_COLORS.ERROR);
        
        await interaction.editReply({
            embeds: [embed],
        });
    }
}
