import { SlashCommandBuilder } from 'discord.js';
import { tacheList } from '../components/tache/List.js';
import { tacheAdd } from '../components/tache/add.js';
import { tacheCompleted } from '../scheduler/completedTasks.js';

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
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('completed')
                .setDescription('Affiche les tâches complétées aujourd\'hui du responsable du channel')
        ),
    
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'list') {
            await tacheList(interaction);
        } else if (subcommand === 'add') {
            await tacheAdd(interaction);
        } else if (subcommand === 'completed') {
            await tacheCompleted(interaction);
        } else {
            await interaction.reply({
                content: '❌ Sous-commande inconnue.',
                ephemeral: true
            });
        }
    },
};
