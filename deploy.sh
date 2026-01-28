#!/bin/bash
cd /var/www/bot-pulse
git pull
npm install --production
npx prisma generate
pm2 restart bot-pulse
