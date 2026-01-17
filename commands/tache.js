import { SlashCommandBuilder } from 'discord.js';
import { tacheList } from '../components/tache/List.js';
import { tacheAdd } from '../components/tache/add.js';

export default {
    data: new SlashCommandBuilder()
        .setName('tache')
        .setDescription('Gérer les tâches')
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Affiche les tâches à faire ou en cours du responsable du channel')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Ajouter une nouvelle tâche')
        ),
    
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'list') {
            await tacheList(interaction);
        } else if (subcommand === 'add') {
            await tacheAdd(interaction);
        } else {
            await interaction.reply({
                content: '❌ Sous-commande inconnue.',
                ephemeral: true
            });
        }
    },
};
