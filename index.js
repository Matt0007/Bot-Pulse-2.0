import dotenv from 'dotenv';
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import fg from 'fast-glob';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeGuild } from './utils/GuildInit.js';
import { handleButton } from './components/menuAdmin/menuAdminHandlers.js';
import { handleTachePagination } from './components/tache/liste/pagination.js';
import { handleTacheSelect, handleTacheStatusChange } from './components/tache/liste/index.js';
import { tacheAddModal, tacheAddConfirm, tacheAddCancel, tacheAddModifyModal, tacheAddParamsSelect, tacheAddDateModal, tacheAddPrioritySelect, tacheAddPriorityBack, tacheAddCategorySelect, tacheAddCategoryBack, tacheAddLocationProjectSelect, tacheAddLocationListSelect, tacheAddLocationBack } from './components/tache/add.js';
import { startCompletedTasksScheduler, handleCompletedTasksPagination } from './scheduler/completedTasks.js';
import { startMorningTasksScheduler, handleMorningTasksPagination } from './scheduler/morningTasks.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Créer un nouveau client Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Collection pour stocker les commandes
client.commands = new Collection();

// Charger toutes les commandes avec fast-glob
const commandFiles = await fg('commands/**/*.js', { cwd: __dirname });

for (const file of commandFiles) {
    const command = (await import(`file://${path.join(__dirname, file).replace(/\\/g, '/')}`)).default;
    
    if (command?.data && command?.execute) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[ATTENTION] La commande ${file} manque une propriété "data" ou "execute".`);
    }
}

// Quand le bot est prêt
client.once('ready', () => {
    console.log(`✅ Bot connecté en tant que ${client.user.tag}!`);
    console.log(`📋 ${client.commands.size} commande(s) chargée(s)`);
    
    // Démarrer les schedulers
    startCompletedTasksScheduler(client);
    startMorningTasksScheduler(client);
});

// Quand le bot rejoint un nouveau serveur
client.on('guildCreate', async guild => {
    console.log(`🆕 Bot ajouté au serveur: ${guild.name}`);
    try {
        await initializeGuild(guild, client);
    } catch (error) {
        console.error(`❌ Erreur lors de l'initialisation du serveur ${guild.name}:`, error);
    }
});

// Gérer les interactions (commandes slash, boutons et select menus)
client.on('interactionCreate', async interaction => {
    // Gérer les commandes slash
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`Aucune commande correspondant à ${interaction.commandName} n'a été trouvée.`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`Erreur lors de l'exécution de ${interaction.commandName}:`, error);
            await interaction.reply({ 
                content: '❌ Il y a eu une erreur lors de l\'exécution de cette commande!', 
                ephemeral: true 
            });
        }
    }
    
    // Gérer les boutons
    if (interaction.isButton()) {
        // Vérifier si c'est une interaction de pagination des tâches
        if (interaction.customId === 'tache-list-page-prev' || interaction.customId === 'tache-list-page-next') {
            // Vérifier si c'est un message du scheduler matinal (via le titre de l'embed)
            if (interaction.message.embeds[0]?.title?.startsWith('🌅 Bonjour')) {
                await handleMorningTasksPagination(interaction);
            } else {
                await handleTachePagination(interaction);
            }
        } else if (interaction.customId === 'completed-tasks-page-prev' || interaction.customId === 'completed-tasks-page-next') {
            await handleCompletedTasksPagination(interaction);
        } else if (interaction.customId.startsWith('tache-status-')) {
            // Interaction de changement de statut
            await handleTacheStatusChange(interaction);
        } else if (interaction.customId.startsWith('tache_add_confirm_')) {
            // Confirmation de création de tâche
            await tacheAddConfirm(interaction);
        } else if (interaction.customId === 'tache_add_cancel') {
            // Annulation de création de tâche
            await tacheAddCancel(interaction);
        } else if (interaction.customId.startsWith('tache_add_location_back_')) {
            // Retour à la sélection du projet
            await tacheAddLocationBack(interaction);
        } else if (interaction.customId.startsWith('tache_add_priority_back_')) {
            // Retour au récapitulatif depuis la sélection de priorité
            await tacheAddPriorityBack(interaction);
        } else if (interaction.customId.startsWith('tache_add_category_back_')) {
            // Retour au récapitulatif depuis la sélection de catégorie
            await tacheAddCategoryBack(interaction);
        } else {
            await handleButton(interaction);
        }
    }
    
    // Gérer les select menus (String, User, Role, Channel, Mentionable)
    if (interaction.isAnySelectMenu()) {
        // Vérifier si c'est une interaction de sélection de tâche
        if (interaction.customId === 'tache-list-select') {
            await handleTacheSelect(interaction);
        } else if (interaction.customId.startsWith('tache_add_params_')) {
            // Sélection d'un paramètre à ajouter
            await tacheAddParamsSelect(interaction);
        } else if (interaction.customId.startsWith('tache_add_priority_select_')) {
            // Sélection de la priorité
            await tacheAddPrioritySelect(interaction);
        } else if (interaction.customId.startsWith('tache_add_category_select_')) {
            // Sélection de la catégorie
            await tacheAddCategorySelect(interaction);
        } else if (interaction.customId.startsWith('tache_add_location_project_')) {
            // Sélection du projet pour modifier l'emplacement
            await tacheAddLocationProjectSelect(interaction);
        } else if (interaction.customId.startsWith('tache_add_location_list_')) {
            // Sélection de la liste pour modifier l'emplacement
            await tacheAddLocationListSelect(interaction);
        } else {
            await handleButton(interaction);
        }
    }
    
    // Gérer les modals
    if (interaction.isModalSubmit()) {
        // Gérer le modal d'ajout de tâche
        if (interaction.customId === 'tache_add_modal') {
            try {
                await tacheAddModal(interaction);
            } catch (error) {
                console.error('Erreur lors du traitement du modal de tâche:', error);
                if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
                    await interaction.reply({ 
                        content: '❌ Erreur lors du traitement!'
                    });
                }
            }
        } else if (interaction.customId.startsWith('tache_add_modify_modal_')) {
            // Gérer le modal de modification de nom de tâche
            try {
                await tacheAddModifyModal(interaction);
            } catch (error) {
                console.error('Erreur lors du traitement du modal de modification:', error);
                if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
                    await interaction.reply({ 
                        content: '❌ Erreur lors du traitement!'
                    });
                }
            }
        } else if (interaction.customId.startsWith('tache_add_date_modal_')) {
            // Gérer le modal de date (début ou échéance)
            try {
                await tacheAddDateModal(interaction);
            } catch (error) {
                console.error('Erreur lors du traitement du modal de date:', error);
                if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
                    await interaction.reply({ 
                        content: '❌ Erreur lors du traitement!'
                    });
                }
            }
        } else if (interaction.customId === 'hour_morning_modal' || interaction.customId === 'hour_completed_modal') {
            // Gérer les modals de modification d'heure
            try {
                const { hourHandlers } = await import('./components/menuAdmin/hour/hourHandlers.js');
                if (interaction.customId === 'hour_morning_modal') {
                    await hourHandlers.hour_morning_modal(interaction);
                } else {
                    await hourHandlers.hour_completed_modal(interaction);
                }
            } catch (error) {
                console.error('Erreur lors du traitement du modal d\'heure:', error);
                if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
                    await interaction.reply({ 
                        content: '❌ Erreur lors du traitement!'
                    });
                }
            }
        } else {
            await handleButton(interaction);
        }
    }
});

// Se connecter au serveur Discord
client.login(process.env.DISCORD_TOKEN);