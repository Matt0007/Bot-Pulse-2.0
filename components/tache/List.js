import { EmbedBuilder } from 'discord.js';
import prisma from '../../utils/prisma.js';
import { useGetAllTask } from '../../hook/clickup/useGetAllTask.js';

// Emojis de statut
const STATUS_EMOJIS = {
    A_FAIRE: '⬜',    // Rond blanc
    EN_COURS: '🟦'   // Rond bleu
};

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
        const adminRole = interaction.guild.roles.cache.find(role => role.name === 'Admin Bot' || role.name === 'bot_admin');
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

        // Créer la liste des tâches (limité à 25 pour l'embed Discord)
        const maxTasks = 25;
        const tasksToShow = tasks.slice(0, maxTasks);
        
        let taskNumber = 0;
        const tasksList = tasksToShow.map((task) => {
            const statutEmoji = task.statut === 'En cours' ? STATUS_EMOJIS.EN_COURS : STATUS_EMOJIS.A_FAIRE;
            
            // Numéroter toutes les tâches (principales et sous-tâches)
            taskNumber++;
            const numberStr = taskNumber.toString().padStart(2, '0');
            
            if (task.isSubtask) {
                // Sous-tâche : numéro avant emoji, puis "-"
                return `${numberStr}. ${statutEmoji} - ${task.nom}`;
            } else {
                // Tâche principale : numéro avant emoji, nom en gras
                return `${numberStr}. ${statutEmoji} **${task.nom}**`;
            }
        }).join('\n');

        // Créer l'embed
        const embed = new EmbedBuilder()
            .setTitle(`📋 Tâches de ${responsable.responsableName}`)
            .setDescription(tasksList)
            .setFooter({ 
                text: tasks.length > maxTasks 
                    ? `Affichage de ${maxTasks} tâches sur ${tasks.length} total` 
                    : `Total: ${tasks.length} tâche(s)` 
            })
            .setColor(EMBED_COLORS.TASK);

        await interaction.editReply({
            embeds: [embed],
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
