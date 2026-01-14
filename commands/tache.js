import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { useGetAllTask } from '../hook/clickup/useGetAllTask.js';
import prisma from '../utils/prisma.js';

export default {
    data: new SlashCommandBuilder()
        .setName('tache')
        .setDescription('Gestion des tâches ClickUp')
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Affiche la liste de vos tâches, sous-tâches et sous-sous-tâches')
        ),
    
    async execute(interaction) {
        if (interaction.options.getSubcommand() === 'list') {
            await handleTacheList(interaction);
        }
    }
};

async function handleTacheList(interaction) {
    try {
        // Vérifier que l'utilisateur est dans un channel responsable
        const channelName = interaction.channel.name;
        if (!channelName.startsWith('responsable-')) {
            await interaction.reply({
                content: '❌ Cette commande ne peut être utilisée que dans un channel responsable.',
                ephemeral: true
            });
            return;
        }
        
        // Récupérer le responsable associé au channel
        const responsable = await prisma.guildResponsable.findUnique({
            where: { channelId: interaction.channel.id },
            include: { users: true }
        });
        
        if (!responsable) {
            await interaction.reply({
                content: '❌ Channel responsable non trouvé dans la base de données.',
                ephemeral: true
            });
            return;
        }
        
        // Vérifier que l'utilisateur est dans la liste des utilisateurs du channel
        const userInChannel = responsable.users.some(u => u.userId === interaction.user.id);
        if (!userInChannel) {
            await interaction.reply({
                content: '❌ Vous n\'avez pas accès à ce channel responsable.',
                ephemeral: true
            });
            return;
        }
        
        await interaction.deferReply({ ephemeral: true });
        
        // Récupérer l'identifiant de l'utilisateur Discord
        // Note: L'email n'est disponible que si l'utilisateur a autorisé OAuth2
        // On utilise le username comme fallback, mais idéalement il faudrait mapper Discord -> ClickUp
        const userIdentifier = interaction.user.email || interaction.user.username;
        
        // Récupérer les tâches
        const tasks = await useGetAllTask(interaction.guild.id, userIdentifier);
        
        if (!tasks || tasks.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle('📋 Mes tâches')
                .setDescription('Aucune tâche trouvée pour votre compte.')
                .setColor(0xFFA500);
            
            await interaction.editReply({ embeds: [embed] });
            return;
        }
        
        // Construire la liste formatée avec toutes les tâches
        // Les tâches principales (level 0) en gras, les autres normales
        const taskList = tasks
            .map(task => {
                if (task.level === 0) {
                    return `**- ${task.name}**`;
                } else {
                    return `- ${task.name}`;
                }
            })
            .join('\n');
        
        // Si plus de 2000 caractères, tronquer
        const finalTaskList = taskList.length > 2000 
            ? taskList.substring(0, 1997) + '...' 
            : taskList;
        
        const embed = new EmbedBuilder()
            .setTitle('📋 Mes tâches')
            .setDescription(finalTaskList || 'Aucune tâche')
            .setFooter({ text: `Total: ${tasks.length} tâche(s)` })
            .setColor(0x5865F2);
        
        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Erreur lors de la récupération des tâches:', error);
        await interaction.editReply({
            content: `❌ Erreur lors de la récupération des tâches: ${error.message}`,
            ephemeral: true
        });
    }
}
