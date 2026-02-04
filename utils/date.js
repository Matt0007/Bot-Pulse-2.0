/**
 * Utilitaire pour les dates : référence unique "aujourd'hui Paris"
 * utilisé à la fois pour l'ajout de tâches et le filtre de la liste.
 */

/**
 * Retourne le timestamp (ms) de minuit (00:00) aujourd'hui en heure de Paris.
 * Utilisé pour que "aujourd'hui" soit cohérent partout (add + liste), quel que soit
 * le fuseau du serveur ou de l'utilisateur (ex: Indonésie vs Paris).
 * Utilise formatToParts pour éviter les variations de format selon l'environnement.
 * @returns {number} Timestamp en millisecondes (UTC)
 */
export function getTodayParisTimestamp() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Paris',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const parts = formatter.formatToParts(now);
    const get = (type) => parseInt(parts.find(p => p.type === type)?.value ?? '0', 10);
    const year = get('year');
    const month = get('month') - 1;
    const day = get('day');

    const utcMidnight = Date.UTC(year, month, day);
    const hourFormatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Paris',
        hour: 'numeric',
        hour12: false
    });
    const parisHour = parseInt(hourFormatter.format(utcMidnight), 10);
    const parisMidnight = utcMidnight - (Number.isNaN(parisHour) ? 0 : parisHour) * 3600 * 1000;
    return Number.isFinite(parisMidnight) && parisMidnight > 0 ? parisMidnight : Date.UTC(year, month, day);
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

/**
 * Retourne le timestamp (ms) de minuit (00:00) du samedi de la semaine en cours en heure de Paris.
 * Utilisé pour filtrer "échéances cette semaine" (lundi 00:00 -> vendredi 23:59).
 * @returns {number} Timestamp en millisecondes (UTC)
 */
export function getEndOfWeekParisTimestamp() {
    const startOfWeek = getStartOfWeekParisTimestamp();
    const oneDayMs = 24 * 60 * 60 * 1000;
    return startOfWeek + 5 * oneDayMs;
}
