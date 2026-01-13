import dotenv from 'dotenv';
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import fg from 'fast-glob';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeGuild } from './utils/GuildInit.js';

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

// Gérer les interactions slash
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

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
});

// Se connecter au serveur Discord
client.login(process.env.DISCORD_TOKEN);