import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import prisma from '../../utils/prisma.js';
import { createErrorEmbed, createInfoEmbed, createWarningEmbed } from '../common/embeds.js';
// Fonctions importées depuis les fichiers modulaires
export { tacheAddModal, tacheAddModifyModal } from './add/modal.js';
export { tacheAddParamsSelect } from './add/paramsSelect.js';
export { tacheAddDateModal } from './add/paramsDate.js';
export { tacheAddLocationProjectSelect, tacheAddLocationListSelect, tacheAddLocationBack } from './add/paramsProject.js';
export { tacheAddPrioritySelect, tacheAddPriorityBack, tacheAddCategorySelect, tacheAddCategoryBack } from './add/paramsPriorityCategory.js';
export { tacheAddConfirm, tacheAddConfirmBack, tacheAddConfirmFinal, tacheAddConfirmCategorySelect } from './add/confirm.js';

// Cache temporaire pour stocker les données de la tâche en cours de création
export const taskDataCache = new Map();

/**
 * Affiche le modal pour demander le nom de la tâche
 */
export async function tacheAdd(interaction) {
    try {
        const guildId = interaction.guild.id;
        
        // Vérifier si on est dans un channel responsable
        const responsable = await prisma.guildResponsable.findUnique({
            where: { channelId: interaction.channel.id },
            include: { users: true }
        });
        
        // Si on est dans un channel responsable, vérifier les permissions
        if (responsable) {
            const isUserInResponsable = responsable.users.some(u => u.userId === interaction.user.id);
            const adminRole = interaction.guild.roles.cache.find(r => r.name === 'Bot Pulse Admin');
            const isAdmin = adminRole && interaction.member.roles.cache.has(adminRole.id);
            const isOwner = interaction.guild.ownerId === interaction.user.id;
            
            if (!isUserInResponsable && !isAdmin && !isOwner) {
                await interaction.reply({ embeds: [createErrorEmbed('Cette commande ne peut être utilisée que dans votre channel privé de responsable.')], ephemeral: true });
                return;
            }
        }
        
        // Vérifier que la liste d'ajout est configurée
        const guildConfig = await prisma.guildConfig.findUnique({
            where: { guildId }
        });
        
        if (!guildConfig?.selectedListId || !guildConfig?.selectedListName) {
            await interaction.reply({ embeds: [createErrorEmbed('Vous devez d\'abord sélectionner une liste d\'ajout dans les paramètres (Paramètre > Liste d\'ajout).')], ephemeral: true });
            return;
        }
        
        // Créer le modal pour demander le nom de la tâche
        const modal = new ModalBuilder()
            .setCustomId('tache_add_modal')
            .setTitle('Ajouter une tâche');
        
        const taskNameInput = new TextInputBuilder()
            .setCustomId('tache_name')
            .setLabel('Nom de la tâche')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Entrez le nom de la tâche')
            .setRequired(true)
            .setMaxLength(100);
        
        const row = new ActionRowBuilder().addComponents(taskNameInput);
        modal.addComponents(row);
        
        await interaction.showModal(modal);
    } catch (error) {
        console.error('Erreur lors de l\'affichage du modal:', error);
        await interaction.reply({
            content: '❌ Erreur lors de l\'ouverture du formulaire.'
        });
    }
}


/**
 * Fonction helper pour construire la description du récapitulatif avec les paramètres
 */
export function buildRecapDescription(taskData, projectName, listName, responsableInfo) {
    // Utiliser les valeurs du cache si disponibles, sinon les paramètres passés
    const finalProjectName = taskData.projectName || projectName;
    const finalListName = taskData.listName || listName;
    
    // Nom de la tâche en haut
    let description = `**Nom de la tâche :** ${taskData.taskName}\n`;
    
    // Paramètres et responsable
    let paramsSection = '';
    
    // Responsable
    if (responsableInfo) {
        paramsSection += responsableInfo.replace('\n**Responsable :**', '**Responsable :**');
    }
    
    // Priorité (toujours affichée car elle est en Normale par défaut)
    const priorityNames = { 1: 'Urgent', 2: 'Élevé', 3: 'Normale', 4: 'Basse' };
    const priorityText = priorityNames[taskData.priority] || 'Normale';
    if (paramsSection) {
        paramsSection += `\n**Priorité :** ${priorityText}`;
    } else {
        paramsSection = `**Priorité :** ${priorityText}`;
    }
    
    // Date de début (affichage en heure de Paris pour cohérence avec la date par défaut)
    if (taskData.startDate) {
        const startDate = new Date(taskData.startDate);
        paramsSection += `\n**Date de début :** ${startDate.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}`;
    }
    
    // Date d'échéance (affichage en heure de Paris)
    if (taskData.dueDate) {
        const dueDate = new Date(taskData.dueDate);
        paramsSection += `\n**Date d'échéance :** ${dueDate.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}`;
    }
    
    // Catégorie
    if (taskData.category) {
        paramsSection += `\n**Catégorie :** ${taskData.category}`;
    }
    
    // Ajouter la section paramètres si elle existe
    if (paramsSection) {
        description += `\n${paramsSection}`;
    }
    
    // Emplacement en bas avec un espace
    description += `\n\n**Emplacement :**\n**Projet :** ${finalProjectName}\n**Liste :** ${finalListName}`;
    
    return description;
}

/**
 * Fonction helper pour mettre à jour le récapitulatif
 */
export async function updateRecap(interaction, messageId) {
    const taskData = taskDataCache.get(messageId);
    if (!taskData || !taskData.messageId) {
        console.error('updateRecap: TaskData non trouvé ou messageId manquant', { messageId, taskData });
        return;
    }
    
    const guildId = interaction.guild.id;
    const guildConfig = await prisma.guildConfig.findUnique({
        where: { guildId }
    });
    
    // Utiliser les valeurs du cache si disponibles, sinon celles de la config
    const projectName = taskData.projectName || guildConfig?.selectedProjectName || 'Projet inconnu';
    const listName = taskData.listName || guildConfig?.selectedListName || 'Liste inconnue';
    
    const responsable = await prisma.guildResponsable.findUnique({
        where: { channelId: interaction.channel.id }
    });
    const responsableInfo = responsable 
        ? `\n**Responsable :** ${responsable.responsableName}`
        : '';
    
    const description = buildRecapDescription(taskData, projectName, listName, responsableInfo);
    
    const recapEmbed = createInfoEmbed('📋 Récapitulatif de la tâche', description);
    
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`tache_add_params_${messageId}`)
        .setPlaceholder('Ajouter des paramètres...')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Nom')
                .setValue('name')
                .setDescription('Changer le nom de la tâche'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Date de début')
                .setValue('start_date')
                .setDescription('Définir la date de début de la tâche'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Date d\'échéance')
                .setValue('due_date')
                .setDescription('Définir la date d\'échéance de la tâche'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Priorité')
                .setValue('priority')
                .setDescription('Définir la priorité de la tâche'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Catégorie')
                .setValue('category')
                .setDescription('Définir la catégorie de la tâche'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Emplacement')
                .setValue('location')
                .setDescription('Modifier le projet et la liste de destination')
        );
    
    const selectRow = new ActionRowBuilder().addComponents(selectMenu);
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`tache_add_confirm_${messageId}`)
                .setLabel('Valider')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('tache_add_cancel')
                .setLabel('Annuler')
                .setStyle(ButtonStyle.Danger)
        );
    
    // Toujours éditer le message du récapitulatif directement
    // (on ne peut pas utiliser editReply car l'interaction peut être éphémère depuis un modal)
    try {
        const channel = await interaction.client.channels.fetch(interaction.channel.id);
        const message = await channel.messages.fetch(taskData.messageId);
        await message.edit({ embeds: [recapEmbed], components: [selectRow, buttons] });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du récapitulatif:', error);
    }
}



/**
 * Annule la création de la tâche
 */
export async function tacheAddCancel(interaction) {
    try {
        // Trouver le messageId dans le cache en utilisant l'ID du message Discord
        let taskName = 'la tâche';
        const messageId = interaction.message.id;
        
        // Parcourir le cache pour trouver l'entrée correspondante
        for (const [cacheKey, taskData] of taskDataCache.entries()) {
            if (taskData.messageId === messageId) {
                taskName = taskData.taskName || 'la tâche';
                // Nettoyer le cache
                taskDataCache.delete(cacheKey);
                break;
            }
        }
        
        const cancelEmbed = createWarningEmbed('❌ Création annulée', `La création de la tâche **${taskName}** a été annulée.`);
        await interaction.update({ embeds: [cancelEmbed], components: [] });
    } catch (error) {
        console.error('Erreur lors de l\'annulation:', error);
    }
}