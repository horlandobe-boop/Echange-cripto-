/*
 * BOT TELEGRAM EXCHANGE CRYPTO - MALAGASY
 * Powered by Gemini API & Coingecko (ho an'ny prix)
 */

const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const express = require('express');
const moment = require('moment-timezone');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- KONFIGURATION (FENOY ITOERANA IRETO) ---

const CONFIG = {
    // Ny Token-n'ny Bot Telegram azonao ao amin'ny @BotFather
    TELEGRAM_TOKEN: '8285282714:AAHG6NX666N30zH6ckmjd4frUciDrS9PZIA', 

    // Ny ID Telegram an'ny Admin (izay handray ny confirmation)
    // Mba hahitana ny ID-nao, mandefasa message amin'ny @userinfobot
    ADMIN_ID: '8207051152', 

    // Ireo API KEY an'ny GEMINI (3 keys manao rotation)
    GEMINI_KEYS: [
        'AIzaSyDReJTvdTRk7cS9org2NJk75bFNJm01RyA',
        'AIzaSyBem4Ab3KjFL83HSAXWi9cDNLAIKao0M3Q',
        'AIzaSyBk5Kl_av1TudhMiBplTOsm7rvnRfpVgLo'
    ],

    // Paramètres Admin (Adresses & Numéros)
    ADMIN_WALLET_CRYPTO: "TRC20: T...Adiresinao... (Ohatra)", // Adresse Wallet an'ny Admin
    ADMIN_PHONE_MONEY: "034 00 000 00 (Mvola) / 032 00 000 00 (Orange)", // Laharana handefasana vola

    // Taux de change (Ohatra: 1 USD = 4600 Ar). 
    // Ny script dia maka ny prix Crypto en USD de avadikany Ar amin'ny alalan'ity.
    USD_TO_MGA_RATE: 4600, 
    
    // Marge (350 Ar)
    MARGE: 350
};

// --- INITIALISATION ---

const bot = new Telegraf(CONFIG.TELEGRAM_TOKEN);
const app = express();
let currentKeyIndex = 0;

// Stockage provisoire des données utilisateurs (Session)
const userSessions = {}; 

// --- FONCTIONS ---

// 1. Rotation API Gemini
function getGeminiModel() {
    const key = CONFIG.GEMINI_KEYS[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % CONFIG.GEMINI_KEYS.length;
    const genAI = new GoogleGenerativeAI(key);
    return genAI.getGenerativeModel({ model: "-2.5-flash" });
}

// 2. Vérification Ora Fiasana
function isShopOpen() {
    const now = moment().tz("Indian/Antananarivo");
    const day = now.day(); // 0 = Dimanche, 6 = Samedi
    const hour = now.hours();
    const minute = now.minutes();
    const timeVal = hour + (minute / 60);

    // Alahady (Tsy miasa)
    if (day === 0) return false;

    // Sabotsy (07:30 - 13:00 ary 15:00 - 21:00)
    if (day === 6) {
        if (timeVal >= 7.5 && timeVal < 13) return true;
        if (timeVal >= 15 && timeVal < 21) return true;
        return false;
    }

    // Alatsinainy - Zoma (07:30 - 21:00)
    if (timeVal >= 7.5 && timeVal < 21) return true;

    return false;
}

// 3. Maka ny Prix Crypto (Mampiasa API Coingecko + Gemini Logic)
async function getCryptoPrice(symbol) {
    try {
        // Maka ny prix en USD aloha
        // NB: Mampiasa Binance API public satria haingana kokoa noho ny Gemini irery
        const response = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol.toUpperCase()}USDT`);
        const priceUSD = parseFloat(response.data.price);
        
        // Avadika Ariary
        const priceMGA = priceUSD * CONFIG.USD_TO_MGA_RATE;
        return Math.floor(priceMGA);
    } catch (e) {
        return null; // Raha tsy mety ny devises
    }
}

// --- LOGIQUE BOT TELEGRAM ---

bot.start((ctx) => {
    ctx.reply(`Salama tompoko! Tongasoa eto amin'ny Bot Exchange.\n\nMisafidiana asa tianao atao:`, 
        Markup.keyboard([
            ['📥 Dépôt (Vidy Crypto)', '📤 Retrait (Amidy Crypto)']
        ]).resize()
    );
});

// Gestion Dépôt (Vidy Crypto : User manome Vola -> Mahazo Crypto)
bot.hears('📥 Dépôt (Vidy Crypto)', async (ctx) => {
    if (!isShopOpen()) return ctx.reply("Miala tsiny tompoko, mikatona ny guichet amin'izao.\nOra fiasana: \nLundi-Vendredi: 07:30-21:00\nSamedi: 07:30-13:00 / 15:00-21:00");
    
    userSessions[ctx.chat.id] = { type: 'DEPOT', step: 1 };
    ctx.reply("Inona ny Devise tianao atao Dépôt? (ohatra: BTC, ETH, USDT, BNB)");
});

// Gestion Retrait (Amidy Crypto : User manome Crypto -> Mahazo Vola)
bot.hears('📤 Retrait (Amidy Crypto)', async (ctx) => {
    if (!isShopOpen()) return ctx.reply("Miala tsiny tompoko, mikatona ny guichet amin'izao.");

    userSessions[ctx.chat.id] = { type: 'RETRAIT', step: 1 };
    ctx.reply("Inona ny Devise tianao atao Retrait? (ohatra: BTC, ETH, USDT, BNB)");
});

// Gestion des messages (Step by Step)
bot.on('text', async (ctx) => {
    const chatId = ctx.chat.id;
    const session = userSessions[chatId];
    const text = ctx.message.text;

    if (!session) return; // Raha tsy manao opération

    // STEP 1: DEVISE
    if (session.step === 1) {
        // Check raha misy ilay crypto (Via API simple)
        const priceCheck = await getCryptoPrice(text);
        
        if (!priceCheck) {
            // Raha tsy fantatra ilay devise, manontany an'i Gemini raha misy
            try {
                const model = getGeminiModel();
                const prompt = `Est-ce que la crypto monnaie "${text}" existe? Réponds juste par OUI ou NON.`;
                const result = await model.generateContent(prompt);
                const response = result.response.text();
                
                if (response.toUpperCase().includes("NON")) {
                    return ctx.reply("Miala tsiny, mbola tsy disponible io devise io na diso ny soratra. Avereno azafady.");
                } else {
                    // Raha misy fa tsy hitan'ny API, dia miteny hoe disponible fa mila admin
                     return ctx.reply("Mbola disponible io devise io fa mifandraisa mivantana amin'ny Admin raha hanao transaction maika.");
                }
            } catch (e) {
                return ctx.reply("Misy olana kely, avereno azafady.");
            }
        }

        session.currency = text.toUpperCase();
        session.basePrice = priceCheck;
        session.step = 2;
        ctx.reply(`Ohatrinona ny Montant ${session.currency} tianao? (Isa fotsiny, ohatra: 20)`);
    }

    // STEP 2: MONTANT & CALCUL PRIX
    else if (session.step === 2) {
        if (isNaN(text)) return ctx.reply("Isa fotsiny soratana azafady.");
        
        session.amount = parseFloat(text);
        
        // Calcul prix Gemini (+/- 350 Ar)
        let finalRate;
        if (session.type === 'DEPOT') {
            finalRate = session.basePrice + CONFIG.MARGE;
        } else {
            finalRate = session.basePrice - CONFIG.MARGE; // Retrait = mividy mora kokoa ny admin
        }
        
        session.totalMGA = finalRate * session.amount;
        session.rate = finalRate;

        // Asehoy ny calcul
        const message = `
📊 **ANALYSE PRIX (Gemini)**
---------------------------
Crypto: ${session.currency}
Cours Normal: ${session.basePrice} Ar
Cours Appliqué: ${session.rate} Ar (${session.type === 'DEPOT' ? '+350' : '-350'})

💰 **TOTAL: ${session.totalMGA.toLocaleString()} Ar**

Raha mety aminao io dia inona ny Portefeuille (Réseau) ampiasainao? (Ex: TRC20, BEP20...)
        `;
        
        session.step = 3;
        ctx.replyWithMarkdown(message);
    }

    // STEP 3: PORTEFEUILLE / RESEAU
    else if (session.step === 3) {
        session.network = text;
        session.step = 4;
        
        if (session.type === 'DEPOT') {
            // Raha DEPOT: Admin manome laharana handefasana vola
            ctx.reply(`Mba hanaovana ny Dépôt, azafady alefaso amin'ity laharana ity ny vola:
            
📱 **${CONFIG.ADMIN_PHONE_MONEY}**

Rehefa vita, soraty eto ny Laharana nandefasanao ny vola (Numéro source).`);
        } else {
            // Raha RETRAIT: Admin manome adresse wallet handefasana crypto
            ctx.reply(`Mba hanaovana ny Retrait, alefaso amin'ity adresse ity ny ${session.amount} ${session.currency}:
            
🔗 **${CONFIG.ADMIN_WALLET_CRYPTO}**

Rehefa vita, soraty eto ny Laharana finday handraisanao ny vola (Mvola/Orange).`);
        }
    }

    // STEP 4: NUMERO TELEPHONE / TRANSACTION
    else if (session.step === 4) {
        session.userPhone = text;
        session.step = 5;

        if (session.type === 'DEPOT') {
             ctx.reply("Farany: Inona ny Adresse Wallet tianao handefasana ny Crypto?");
        } else {
             ctx.reply("Farany: Iza ny Anaranao feno (Nom du compte mobile money)?");
        }
    }

    // STEP 5: FINALISATION & CONFIRMATION
    else if (session.step === 5) {
        session.userInfo = text; // Adresse Wallet (Depot) na Anarana (Retrait)

        // Famintinana ho an'ny Admin
        const adminMsg = `
🔔 **NOUVELLE TRANSACTION EN ATTENTE**
-----------------------------------
Type: ${session.type}
Devise: ${session.currency}
Montant: ${session.amount}
Réseau: ${session.network}
Total Ar: ${session.totalMGA.toLocaleString()} Ar

👤 **INFO CLIENT**
Info (Wallet/Nom): ${session.userInfo}
Téléphone: ${session.userPhone}
ID Telegram: ${chatId}
        `;

        // Alefa any amin'ny Admin
        bot.telegram.sendMessage(CONFIG.ADMIN_ID, adminMsg);

        // Valiny ho an'ny Client
        ctx.reply("✅ Voaray ny fangatahanao! Nalefa any amin'ny Admin izany mba hanaovana verification. Mahazo notification ianao rehefa vita ny transaction.");
        
        // Reset session
        delete userSessions[chatId];
    }
});

// --- SERVER HTTP HO AN'NY CRON-JOB (MBA TSY HATORY NY BOT) ---

app.get('/', (req, res) => {
    res.send('Bot is running...');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    
    // Alefa ny Bot
    bot.launch();
    console.log('Bot Telegram tafaverina!');
});

// Gestion des erreurs fatales
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
