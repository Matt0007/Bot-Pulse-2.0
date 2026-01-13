import { REST, Routes } from 'discord.js';
import fg from 'fast-glob';
import { fileURLToPath } from 'url';
import path from 'path';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Charger toutes les commandes avec fast-glob
const commandFiles = await fg('commands/**/*.js', { cwd: __dirname });
const commands = [];

for (const file of commandFiles) {
    const command = (await import(`file://${path.join(__dirname, file).replace(/\\/g, '/')}`)).default;
    if (command?.data && command?.execute) {
        commands.push(command.data.toJSON());
    }
}

// Déployer les commandes
try {
    const rest = new REST().setToken(process.env.DISCORD_TOKEN);
    console.log(`🔄 Déploiement de ${commands.length} commande(s)...`);
    
    const data = await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands }
    );
    
    console.log(`✅ ${data.length} commande(s) déployée(s) avec succès.`);
} catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
}