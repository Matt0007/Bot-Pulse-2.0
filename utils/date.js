/**
 * Utilitaire pour les dates : référence unique "aujourd'hui Paris"
 * utilisé à la fois pour l'ajout de tâches et le filtre de la liste.
 */

/**
 * Retourne le timestamp (ms) de minuit (00:00) aujourd'hui en heure de Paris.
 * Utilisé pour que "aujourd'hui" soit cohérent partout (add + liste), quel que soit
 * le fuseau du serveur ou de l'utilisateur (ex: Indonésie vs Paris).
 * @returns {number} Timestamp en millisecondes (UTC)
 */
export function getTodayParisTimestamp() {
    const now = new Date();
    const parisDateParts = now.toLocaleString('fr-FR', {
        timeZone: 'Europe/Paris',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).split('/');

    const day = parseInt(parisDateParts[0], 10);
    const month = parseInt(parisDateParts[1], 10) - 1;
    const year = parseInt(parisDateParts[2], 10);

    const utcMidnight = Date.UTC(year, month, day);
    const parisHour = parseInt(new Date(utcMidnight).toLocaleString('en-GB', {
        timeZone: 'Europe/Paris',
        hour: 'numeric',
        hour12: false
    }), 10);
    const parisMidnight = utcMidnight - parisHour * 3600 * 1000;
    return parisMidnight;
}

/**
 * Retourne le timestamp (ms) de minuit (00:00) demain en heure de Paris.
 * Utilisé pour le filtre liste : afficher les tâches dont la date de début est aujourd'hui ou avant.
 * @returns {number} Timestamp en millisecondes (UTC)
 */
export function getTomorrowParisTimestamp() {
    const todayParis = getTodayParisTimestamp();
    const oneDayMs = 24 * 60 * 60 * 1000;
    return todayParis + oneDayMs;
}

/**
 * Retourne le timestamp (ms) de minuit (00:00) du lundi de la semaine en cours en heure de Paris.
 * Utilisé pour les stats "tâches complétées cette semaine".
 * @returns {number} Timestamp en millisecondes (UTC)
 */
export function getStartOfWeekParisTimestamp() {
    const todayParis = getTodayParisTimestamp();
    const parisDate = new Date(todayParis);
    const dayOfWeek = parisDate.toLocaleString('en-GB', { timeZone: 'Europe/Paris', weekday: 'short' });
    const dayMap = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
    const daysSinceMonday = dayMap[dayOfWeek] ?? 0;
    const oneDayMs = 24 * 60 * 60 * 1000;
    return todayParis - daysSinceMonday * oneDayMs;
}
