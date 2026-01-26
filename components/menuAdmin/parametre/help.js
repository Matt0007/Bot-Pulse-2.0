import { createBackButton } from '../../common/buttons.js';
import { createInfoEmbed } from '../../common/embeds.js';

export async function helpButton(interaction) {
    const embed = createInfoEmbed('📚 Guide d\'utilisation - Panneau Admin', 'Voici toutes les fonctionnalités disponibles dans le panneau d\'administration :')
        .addFields(
            {
                name: '🔧 Section Admin',
                value: '**Liste** : Affiche tous les administrateurs ayant le rôle "Bot Pulse Admin"\n**Ajouter** : Ajoute un utilisateur au rôle administrateur\n**Retirer** : Retire le rôle administrateur d\'un utilisateur',
                inline: false
            },
            {
                name: '📁 Section Projet',
                value: '**Liste** : Affiche tous les projets ClickUp configurés\n**Ajouter** : Ajoute un projet depuis votre espace ClickUp\n**Retirer** : Supprime un projet de la configuration',
                inline: false
            },
            {
                name: '👤 Section Responsable',
                value: '**Liste** : Affiche tous les responsables configurés avec leurs channels et utilisateurs\n**Ajouter** : Crée un nouveau responsable avec un projet ClickUp, un channel dédié et des utilisateurs\n**Retirer** : Supprime un responsable et son channel associé',
                inline: false
            },
            {
                name: '⏰ Section Heure',
                value: '**Matin** : Configure l\'heure d\'envoi des tâches du matin (par défaut 8h)\n**Complété** : Configure l\'heure d\'envoi des tâches complétées (par défaut 22h)',
                inline: false
            },
            {
                name: '⚙️ Section Paramètre',
                value: '**ClickUp API** : Configure ou modifie votre clé API ClickUp\n**Liste d\'ajout** : Sélectionne la liste ClickUp par défaut pour l\'ajout de nouvelles tâches\n**Historique** : Consulte l\'historique des actions administratives\n**Help** : Affiche ce guide d\'utilisation',
                inline: false
            },
            {
                name: 'ℹ️ Informations importantes',
                value: '• Toutes les commandes doivent être utilisées dans le channel `bot-pulse`\n• Seuls les utilisateurs avec le rôle "Bot Pulse Admin" peuvent utiliser ces fonctionnalités\n• La clé API ClickUp est chiffrée et stockée de manière sécurisée',
                inline: false
            }
        )
        .setFooter({ text: 'Besoin d\'aide ? Contactez un administrateur du serveur.' });

    await interaction.update({ embeds: [embed], components: [createBackButton('parametre_button')] });
}
