import { SlashCommandBuilder } from 'discord.js';
import { tacheList } from '../components/tache/List.js';

export default {
    data: new SlashCommandBuilder()
        .setName('tache')
        .setDescription('Gérer les tâches')
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Affiche les tâches à faire ou en cours du responsable du channel')
        ),
    
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'list') {
            await tacheList(interaction);
        } else {
            await interaction.reply({
                content: '❌ Sous-commande inconnue.',
                ephemeral: true
            });
        }
    },
};
