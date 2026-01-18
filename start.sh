#!/bin/bash

# Script de démarrage pour Pterodactyl
# Ce script installe les dépendances, génère le client Prisma et lance l'application

echo "📦 Installation des dépendances..."
npm install

echo "🔧 Génération du client Prisma..."
npx prisma generate

echo "🗄️ Application des migrations Prisma (si nécessaire)..."
npx prisma migrate deploy || npx prisma db push

echo "🚀 Démarrage de l'application..."
npm start
