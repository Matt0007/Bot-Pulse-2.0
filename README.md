# Bot-Pulse-2.0

Bot Discord pour la gestion de tâches ClickUp.

## Configuration pour Pterodactyl

### Prérequis
- Node.js 18+ installé sur le serveur
- Base de données PostgreSQL configurée
- Variables d'environnement configurées (fichier `.env`)

### Configuration dans Pterodactyl

1. **Type d'application** : Node.js
2. **Script de démarrage** : Utilisez cette commande dans Pterodactyl :

   ```
   if [[ -d .git ]] && [[ 1 == "1" ]]; then git pull; fi; if [[ ! -z ]]; then /usr/local/bin/npm install ; fi; if [ -f /home/container/package.json ]; then /usr/local/bin/npm install; fi; /usr/local/bin/npx prisma generate; /usr/local/bin/npx prisma migrate deploy || /usr/local/bin/npx prisma db push; /usr/local/bin/node /home/container/index.js
   ```

   Cette commande :
   - Fait un `git pull` si c'est un repo git
   - Installe les dépendances npm
   - Génère le client Prisma
   - Applique les migrations (ou fait un `db push` en fallback)
   - Lance l'application

3. **Variables d'environnement** : Assurez-vous d'avoir configuré dans Pterodactyl :
   - `DISCORD_TOKEN` : Token du bot Discord
   - `CLIENT_ID` : ID de l'application Discord
   - `DATABASE_URL` : URL de connexion PostgreSQL (format: `postgresql://user:password@host:port/database`)

### Installation locale

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm start
```

### Déploiement des commandes Discord

```bash
npm run deploy
```
