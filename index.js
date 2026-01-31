/*
 * BOT TELEGRAM EXCHANGE CRYPTO - MALAGASY V2 (Avec Système Admin)
 * Powered by Gemini API & Coingecko
 */

const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const express = require('express');
const moment = require('moment-timezone');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- KONFIGURATION (MAZAVA NY API IREO) ---

const CONFIG = {
    // Ny Token-n'ny Bot Telegram
    TELEGRAM_TOKEN: '8285282714:AAHG6NX666N30zH6ckmjd4frUciDrS9PZIA', 

    // Ny ID Telegram an'ny Admin (Ianao irery no afaka manao commande Admin)
    ADMIN_ID: '8207051152', 

    // Ireo API KEY an'ny GEMINI (3 keys manao rotation)
    GEMINI_KEYS: [
        'AIzaSyDReJTvdTRk7cS9org2NJk75bFNJm01RyA',
        'AIzaSyBem4Ab3KjFL83HSAXWi9cDNLAIKao0M3Q',
        'AIzaSyBk5Kl_av1TudhMiBplTOsm7rvnRfpVgLo'
    ],

    // LAHARANA MVOLA/ORANGE MONEY (Ho an'ny Dépôt ihany ity)
    ADMIN_PHONE_MONEY: "034 00 000 00 (Mvola) / 032 00 000 00 (Orange)", 

    // Taux de change (USD to MGA)
    USD_TO_MGA_RATE: 4600, 
    
    // Marge (350 Ar)
    MARGE: 350
};

// --- BASE DE DONNÉES SIMPLE (RAM) ---
// Eto no mipetraka ireo crypto nampidirin'ny Admin.
// Rehefa restart ny server dia miverina amin'ity default ity izy.
let CRYPTO_DB = {
    // Azonao fenoina eto ny default raha tianao
    "USDT": { network: "TRC20", address: "Mbola Tsy Nampidirina" } 
};

// --- INITIALISATION ---

const bot = new Telegraf(CONFIG.TELEGRAM_TOKEN);
const app = express();
let currentKeyIndex = 0;

// Stockage provisoire des données utilisateurs (Session)
const userSessions = {}; 

// --- FONCTIONS TEKNIKA ---

// 1. Rotation API Gemini
function getGeminiModel() {
    const key = CONFIG.GEMINI_KEYS[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % CONFIG.GEMINI_KEYS.length;
    const genAI = new GoogleGenerativeAI(key);
    return genAI.getGenerativeModel({ model: "gemini-pro" }); // "gemini-pro" no stable kokoa
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

// 3. Maka ny Prix Crypto
async function getCryptoPrice(symbol) {
    try {
        const response = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol.toUpperCase()}USDT`);
        const priceUSD = parseFloat(response.data.price);
        const priceMGA = priceUSD * CONFIG.USD_TO_MGA_RATE;
        return Math.floor(priceMGA);
    } catch (e) {
        return null; 
    }
}

// --- SYSTÈME ADMIN (COMMANDES) ---

// Commande: /add [SYMBOL] [RESEAU] [ADRESSE]
bot.command('add', (ctx) => {
    // Vérification ID Admin
    if (ctx.from.id.toString() !== CONFIG.ADMIN_ID) return ctx.reply("⛔ Tsy mahazo manao an'io ianao.");

    const args = ctx.message.text.split(' ');
    // args[0]=/add, args[1]=Symbol, args[2]=Reseau, args[3]=Adresse

    if (args.length < 4) {
        return ctx.reply("❌ Diso ny fampidirana.\nAtaovy: /add [SYMBOL] [RESEAU] [ADRESSE]\nOhatra: /add USDT TRC20 T12345678Adiresiko");
    }

    const symbol = args[1].toUpperCase();
    const network = args[2].toUpperCase();
    const address = args[3];

    // Mitahiry ao anaty mémoire
    CRYPTO_DB[symbol] = { network: network, address: address };
    
    ctx.reply(`✅ Voarakitra ny Crypto vaovao:\nSymbol: ${symbol}\nRéseau: ${network}\nAdresse: ${address}`);
});

// Commande: /list (Hijery ny efa nampidirina)
bot.command('list', (ctx) => {
    if (ctx.from.id.toString() !== CONFIG.ADMIN_ID) return;

    let message = "📋 **LISTE DES CRYPTOS DISPONIBLES (Admin):**\n\n";
    const keys = Object.keys(CRYPTO_DB);
    
    if (keys.length === 0) {
        message += "Mbola tsy misy crypto nampidirina.";
    } else {
        for (const symbol of keys) {
            const data = CRYPTO_DB[symbol];
            message += `🔹 **${symbol}** (${data.network})\n   Adresse: ${data.address}\n\n`;
        }
    }
    ctx.replyWithMarkdown(message);
});

// Commande: /delete [SYMBOL] (Hamafa)
bot.command('delete', (ctx) => {
    if (ctx.from.id.toString() !== CONFIG.ADMIN_ID) return;
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply("Ataovy: /delete [SYMBOL]");

    const symbol = args[1].toUpperCase();
    if (CRYPTO_DB[symbol]) {
        delete CRYPTO_DB[symbol];
        ctx.reply(`🗑️ Voafafa ny ${symbol}.`);
    } else {
        ctx.reply("❌ Tsy hita io Crypto io.");
    }
});


// --- LOGIQUE UTILISATEUR (CLIENT) ---

bot.start((ctx) => {
    ctx.reply(`Salama tompoko! Tongasoa eto amin'ny Bot Exchange.\n\nMisafidiana asa tianao atao:`, 
        Markup.keyboard([
            ['📥 Dépôt (Vidy Crypto)', '📤 Retrait (Amidy Crypto)']
        ]).resize()
    );
});

// Gestion Dépôt
bot.hears('📥 Dépôt (Vidy Crypto)', async (ctx) => {
    if (!isShopOpen()) return ctx.reply("Miala tsiny tompoko, mikatona ny guichet amin'izao.\nOra fiasana: \nLundi-Vendredi: 07:30-21:00\nSamedi: 07:30-13:00 / 15:00-21:00");
    
    userSessions[ctx.chat.id] = { type: 'DEPOT', step: 1 };
    
    // Mampiseho ny crypto efa nampidirin'ny Admin
    const dispo = Object.keys(CRYPTO_DB).join(', ');
    ctx.reply(`Inona ny Devise tianao atao Dépôt? \n(Ny efa nampidirina dia: ${dispo}, fa afaka manoratra hafa ianao).`);
});

// Gestion Retrait
bot.hears('📤 Retrait (Amidy Crypto)', async (ctx) => {
    if (!isShopOpen()) return ctx.reply("Miala tsiny tompoko, mikatona ny guichet amin'izao.");

    userSessions[ctx.chat.id] = { type: 'RETRAIT', step: 1 };
    ctx.reply("Inona ny Devise tianao atao Retrait? (ohatra: BTC, ETH, USDT...)");
});

// Gestion Messages (Step by Step)
bot.on('text', async (ctx) => {
    const chatId = ctx.chat.id;
    const session = userSessions[chatId];
    const text = ctx.message.text;

    // Raha commande Admin dia tsy raisina
    if (text.startsWith('/')) return;

    if (!session) return; 

    // STEP 1: DEVISE
    if (session.step === 1) {
        session.currency = text.toUpperCase();
        
        // 1. Zahana raha efa nampidirin'ny Admin ilay izy (Priorité)
        const adminData = CRYPTO_DB[session.currency];
        
        // 2. Zahana ny prix
        const priceCheck = await getCryptoPrice(session.currency);
        
        if (!priceCheck) {
            // Gemini Check (raha tsy hitan'ny Binance API)
            try {
                const model = getGeminiModel();
                const prompt = `Est-ce que la crypto monnaie "${text}" existe? Réponds juste par OUI ou NON.`;
                const result = await model.generateContent(prompt);
                const response = result.response.text();
                
                if (response.toUpperCase().includes("NON")) {
                    return ctx.reply("Miala tsiny, tsy misy io devise io. Avereno azafady.");
                } else {
                     return ctx.reply("Mbola disponible io devise io fa mifandraisa mivantana amin'ny Admin fa tsy mbola nampidirina tao anaty système.");
                }
            } catch (e) {
                return ctx.reply("Misy olana kely, avereno azafady.");
            }
        }

        // Raha misy ao amin'ny DB an'ny Admin
        if (adminData) {
            session.networkInfo = adminData.network;
            session.adminAddress = adminData.address;
        } else {
            session.networkInfo = "Tsy voafaritra (Manontania Admin)";
            session.adminAddress = "Manontania Admin";
        }

        session.basePrice = priceCheck;
        session.step = 2;
        ctx.reply(`Ohatrinona ny Montant ${session.currency} tianao? (Isa fotsiny, ohatra: 20)`);
    }

    // STEP 2: MONTANT & CALCUL PRIX
    else if (session.step === 2) {
        if (isNaN(text)) return ctx.reply("Isa fotsiny soratana azafady.");
        
        session.amount = parseFloat(text);
        
        let finalRate;
        if (session.type === 'DEPOT') {
            finalRate = session.basePrice + CONFIG.MARGE;
        } else {
            finalRate = session.basePrice - CONFIG.MARGE;
        }
        
        session.totalMGA = finalRate * session.amount;
        session.rate = finalRate;

        const message = `
📊 **ANALYSE PRIX**
---------------------------
Crypto: ${session.currency}
Cours: ${session.rate} Ar (${session.type === 'DEPOT' ? '+350' : '-350'})

💰 **TOTAL: ${session.totalMGA.toLocaleString()} Ar**

Raha mety aminao io, hamafiso ny Réseau/Portefeuille ampiasainao?
(Réseau tokony ho izy: ${session.networkInfo})`;
        
        session.step = 3;
        ctx.replyWithMarkdown(message);
    }

    // STEP 3: PORTEFEUILLE / RESEAU
    else if (session.step === 3) {
        session.userNetwork = text;
        session.step = 4;
        
        if (session.type === 'DEPOT') {
            // Raha DEPOT: Laharana Mvola no omena
            ctx.reply(`Mba hanaovana ny Dépôt, azafady alefaso amin'ity laharana ity ny vola:
            
📱 **${CONFIG.ADMIN_PHONE_MONEY}**

Rehefa vita, soraty eto ny Laharana nanao ny transfert (Preuve).`);
        } else {
            // Raha RETRAIT: Adresse Wallet no omena
            // Eto no ampiasaina ilay nampidirin'ny Admin tamin'ny Commande
            if (session.adminAddress === "Manontania Admin") {
                ctx.reply(`⚠️ Mbola tsy nampidirin'ny Admin ny adresse ho an'ny ${session.currency}.
Azafady mifandraisa mivantana aminy na miandrasa kely.`);
            } else {
                ctx.reply(`Mba hanaovana ny Retrait, alefaso amin'ity adresse ity ny ${session.amount} ${session.currency}:
            
🔗 **${session.adminAddress}**
(Réseau: ${session.networkInfo})

Rehefa vita, soraty eto ny Laharana finday handraisanao ny vola.`);
            }
        }
    }

    // STEP 4: NUMERO TELEPHONE / TRANSACTION
    else if (session.step === 4) {
        session.proofOrPhone = text;
        session.step = 5;

        if (session.type === 'DEPOT') {
             ctx.reply("Farany: Inona ny Adresse Wallet tianao handefasana ny Crypto?");
        } else {
             ctx.reply("Farany: Iza ny Anaranao feno (Nom du compte mobile money)?");
        }
    }

    // STEP 5: FINALISATION & CONFIRMATION
    else if (session.step === 5) {
        session.finalInfo = text; 

        // Message ho an'ny Admin
        const adminMsg = `
🔔 **NOUVELLE TRANSACTION**
-----------------------------------
Type: ${session.type}
Devise: ${session.currency}
Montant: ${session.amount}
Réseau User: ${session.userNetwork}
Total Ar: ${session.totalMGA.toLocaleString()} Ar

👤 **INFO CLIENT**
Preuve/Phone: ${session.proofOrPhone}
Wallet/Nom: ${session.finalInfo}
ID Telegram: ${chatId}

⚠️ **ACTION ADMIN:**
1. Hamarino ny vola na crypto voaray.
2. Raha Dépôt: Alefaso ny crypto any amin'ny ${session.finalInfo} (Jereo tsara ny Réseau).
3. Raha Retrait: Alefaso ny vola any amin'ny ${session.proofOrPhone}.
        `;

        // Alefa any amin'ny Admin
        bot.telegram.sendMessage(CONFIG.ADMIN_ID, adminMsg);

        ctx.reply("✅ Voaray ny fangatahanao! Nalefa any amin'ny Admin izany mba hanaovana verification. Mahazo notification ianao rehefa vita ny transaction.");
        
        delete userSessions[chatId];
    }
});

// --- SERVER HTTP ---

app.get('/', (req, res) => {
    res.send('Bot Exchange Gasy Running...');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    bot.launch();
    console.log('Bot Telegram tafaverina!');
});

// Erreur handling
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
