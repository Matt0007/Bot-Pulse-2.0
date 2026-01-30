import dotenv from 'dotenv';
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import fg from 'fast-glob';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { initializeGuild } from './utils/GuildInit.js';
import { handleButton } from './components/menuAdmin/menuAdminHandlers.js';
import { handleTachePagination } from './components/tache/liste/pagination.js';
import { handleTacheSelect, handleTacheStatusChange } from './components/tache/liste/index.js';
import { tacheAddModal, tacheAddConfirm, tacheAddConfirmBack, tacheAddConfirmFinal, tacheAddConfirmCategorySelect, tacheAddCancel, tacheAddModifyModal, tacheAddParamsSelect, tacheAddDateModal, tacheAddPrioritySelect, tacheAddPriorityBack, tacheAddCategorySelect, tacheAddCategoryBack, tacheAddLocationProjectSelect, tacheAddLocationListSelect, tacheAddLocationBack } from './components/tache/add.js';
import { tacheAddCategoryPagination } from './components/tache/add/paramsSelect.js';
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

// Gestionnaire d'erreur global pour capturer les erreurs non gérées
client.on('error', error => {
    console.error('Erreur Discord non gérée:', error);
    
    // Créer le dossier logsError s'il n'existe pas
    const logsDir = path.join(__dirname, 'logsError');
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Créer un nom de fichier avec timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `error-${timestamp}.json`;
    const filepath = path.join(logsDir, filename);
    
    // Préparer les données de l'erreur
    const errorData = {
        timestamp: new Date().toISOString(),
        code: error.code,
        message: error.message,
        name: error.name,
        stack: error.stack,
        requestBody: error.requestBody,
        status: error.status,
        method: error.method,
        url: error.url,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
    };
    
    // Écrire dans le fichier
    try {
        fs.writeFileSync(filepath, JSON.stringify(errorData, null, 2), 'utf8');
        console.log(`✅ Erreur enregistrée dans: ${filepath}`);
    } catch (writeError) {
        console.error('❌ Erreur lors de l\'écriture du fichier de log:', writeError);
    }
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

async function replyErrorIfRepliable(interaction) {
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Erreur lors du traitement!', ephemeral: true });
    }
}

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
        try {
            if (interaction.customId === 'tache-list-page-prev' || interaction.customId === 'tache-list-page-next') {
                if (interaction.message.embeds[0]?.title?.startsWith('🌅 Bonjour')) {
                    await handleMorningTasksPagination(interaction);
                } else {
                    await handleTachePagination(interaction);
                }
            } else if (interaction.customId === 'completed-tasks-page-prev' || interaction.customId === 'completed-tasks-page-next') {
                await handleCompletedTasksPagination(interaction);
            } else if (interaction.customId.startsWith('tache-status-')) {
                await handleTacheStatusChange(interaction);
            } else if (interaction.customId.startsWith('tache_add_confirm_final_')) {
                await tacheAddConfirmFinal(interaction);
            } else if (interaction.customId.startsWith('tache_add_confirm_back_')) {
                await tacheAddConfirmBack(interaction);
            } else if (interaction.customId.startsWith('tache_add_confirm_')) {
                await tacheAddConfirm(interaction);
            } else if (interaction.customId === 'tache_add_cancel') {
                await tacheAddCancel(interaction);
            } else if (interaction.customId.startsWith('tache_add_location_back_')) {
                await tacheAddLocationBack(interaction);
            } else if (interaction.customId.startsWith('tache_add_priority_back_')) {
                await tacheAddPriorityBack(interaction);
            } else if (interaction.customId.startsWith('tache_add_category_back_')) {
                await tacheAddCategoryBack(interaction);
            } else if (interaction.customId.startsWith('tache_add_category_page_')) {
                await tacheAddCategoryPagination(interaction);
            } else {
                await handleButton(interaction);
            }
        } catch (error) {
            console.error('Erreur lors du traitement du bouton:', error);
            await replyErrorIfRepliable(interaction);
        }
    }
    
    // Gérer les select menus (String, User, Role, Channel, Mentionable)
    if (interaction.isAnySelectMenu()) {
        try {
            if (interaction.customId === 'tache-list-select') {
                await handleTacheSelect(interaction);
            } else if (interaction.customId.startsWith('tache_add_params_')) {
                await tacheAddParamsSelect(interaction);
            } else if (interaction.customId.startsWith('tache_add_priority_select_')) {
                await tacheAddPrioritySelect(interaction);
            } else if (interaction.customId.startsWith('tache_add_confirm_category_select_')) {
                await tacheAddConfirmCategorySelect(interaction);
            } else if (interaction.customId.startsWith('tache_add_category_select_')) {
                await tacheAddCategorySelect(interaction);
            } else if (interaction.customId.startsWith('tache_add_location_project_')) {
                await tacheAddLocationProjectSelect(interaction);
            } else if (interaction.customId.startsWith('tache_add_location_list_')) {
                await tacheAddLocationListSelect(interaction);
            } else {
                await handleButton(interaction);
            }
        } catch (error) {
            console.error('Erreur lors du traitement du menu:', error);
            await replyErrorIfRepliable(interaction);
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
                await replyErrorIfRepliable(interaction);
            }
        } else if (interaction.customId.startsWith('tache_add_modify_modal_')) {
            try {
                await tacheAddModifyModal(interaction);
            } catch (error) {
                console.error('Erreur lors du traitement du modal de modification:', error);
                await replyErrorIfRepliable(interaction);
            }
        } else if (interaction.customId.startsWith('tache_add_date_modal_')) {
            try {
                await tacheAddDateModal(interaction);
            } catch (error) {
                console.error('Erreur lors du traitement du modal de date:', error);
                await replyErrorIfRepliable(interaction);
            }
        } else if (interaction.customId === 'hour_morning_modal' || interaction.customId === 'hour_completed_modal') {
            try {
                const { hourHandlers } = await import('./components/menuAdmin/hour/hourHandlers.js');
                if (interaction.customId === 'hour_morning_modal') {
                    await hourHandlers.hour_morning_modal(interaction);
                } else {
                    await hourHandlers.hour_completed_modal(interaction);
                }
            } catch (error) {
                console.error('Erreur lors du traitement du modal d\'heure:', error);
                await replyErrorIfRepliable(interaction);
            }
        } else {
            try {
                await handleButton(interaction);
            } catch (error) {
                console.error('Erreur lors du traitement du modal:', error);
                await replyErrorIfRepliable(interaction);
            }
        }
    }
});

// Se connecter au serveur Discord
client.login(process.env.DISCORD_TOKEN);