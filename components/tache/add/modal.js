import { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import prisma from '../../../utils/prisma.js';
import { taskDataCache, updateRecap, buildRecapDescription } from '../add.js';

/**
 * Traite la soumission du modal initial et crée le récapitulatif
 */
export async function tacheAddModal(interaction) {
    try {
        await interaction.deferReply();
        
        const guildId = interaction.guild.id;
        const taskName = interaction.fields.getTextInputValue('tache_name').trim();
        
        if (!taskName) {
            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('❌ Erreur')
                    .setDescription('Le nom de la tâche ne peut pas être vide.')
                    .setColor(0xFF0000)
                ]
            });
            return;
        }
        
        // Récupérer la liste d'ajout configurée
        const guildConfig = await prisma.guildConfig.findUnique({
            where: { guildId }
        });
        
        if (!guildConfig?.selectedListId) {
            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('❌ Erreur')
                    .setDescription('Aucune liste d\'ajout configurée. Veuillez configurer une liste dans les paramètres.')
                    .setColor(0xFF0000)
                ]
            });
            return;
        }
        
        const listId = guildConfig.selectedListId;
        const listName = guildConfig.selectedListName;
        const projectName = guildConfig.selectedProjectName || 'Projet inconnu';
        
        // Récupérer le responsable du channel
        const responsable = await prisma.guildResponsable.findUnique({
            where: { channelId: interaction.channel.id }
        });
        
        const responsableName = responsable?.responsableName || null;
        const responsableInfo = responsable 
            ? `\n**Responsable :** ${responsable.responsableName}`
            : '';
        
        // Stocker les données dans le cache
        const messageId = `${interaction.user.id}_${Date.now()}`; // Utiliser un ID unique basé sur l'utilisateur et le timestamp
        taskDataCache.set(messageId, {
            listId,
            listName,
            projectId: guildConfig.selectedProjectId || null,
            projectName,
            taskName,
            responsableName,
            startDate: null,
            dueDate: null,
            priority: 3, // Normal par défaut
            category: null,
            messageId: null // Sera mis à jour après l'envoi du message
        });
        
        // Construire la description du récapitulatif
        const initialTaskData = {
            taskName,
            startDate: null,
            dueDate: null,
            priority: 3,
            category: null
        };
        const description = buildRecapDescription(initialTaskData, projectName, listName, responsableInfo);
        
        // Afficher le récapitulatif avec boutons Valider/Annuler et select menu
        const recapEmbed = new EmbedBuilder()
            .setTitle('📋 Récapitulatif de la tâche')
            .setDescription(description)
            .setColor(0x5865F2);
        
        // Select menu pour les paramètres supplémentaires
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
        
        const reply = await interaction.editReply({ embeds: [recapEmbed], components: [selectRow, buttons] });
        
        // Stocker l'ID du message dans le cache
        const cachedData = taskDataCache.get(messageId);
        if (cachedData) {
            cachedData.messageId = reply.id;
            taskDataCache.set(messageId, cachedData);
        }
    } catch (error) {
        console.error('Erreur lors de la création de la tâche:', error);
        
        const errorMessage = error.message?.includes('API ClickUp') 
            ? error.message 
            : 'Impossible de créer la tâche dans ClickUp.';
        
        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setTitle('❌ Erreur')
                .setDescription(errorMessage)
                .setColor(0xFF0000)
            ]
        });
    }
}

/**
 * Traite la soumission du modal de modification
 */
export async function tacheAddModifyModal(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });
        
        const customId = interaction.customId;
        const taskName = interaction.fields.getTextInputValue('tache_name').trim();
        
        if (!taskName) {
            await interaction.editReply({
                content: '❌ Le nom de la tâche ne peut pas être vide.'
            });
            return;
        }
        
        // Extraire messageId depuis le customId
        // Format: tache_add_modify_modal_{messageId}
        const messageId = customId.replace('tache_add_modify_modal_', '');
        
        const taskData = taskDataCache.get(messageId);
        if (!taskData) {
            await interaction.editReply({
                content: '❌ Session expirée. Veuillez recommencer.'
            });
            return;
        }
        
        // Mettre à jour le cache avec le nouveau nom
        taskData.taskName = taskName;
        taskDataCache.set(messageId, taskData);
        
        // Mettre à jour le récapitulatif
        await updateRecap(interaction, messageId);
        
        // Supprimer le message éphémère
        await interaction.deleteReply();
    } catch (error) {
        console.error('Erreur lors de la modification du nom:', error);
        
        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setTitle('❌ Erreur')
                .setDescription('Impossible de modifier le nom de la tâche.')
                .setColor(0xFF0000)
            ]
        });
    }
}
