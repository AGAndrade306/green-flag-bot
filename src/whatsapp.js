const { Client } = require('whatsapp-web.js');
const SQLiteAuth = require('./auth/SQLiteAuth'); // Importa a nova estratégia de autenticação

const client = new Client({
    authStrategy: new SQLiteAuth(), // Usa SQLite para armazenar a sessão
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'] // Configurações para o Puppeteer
    }
});

client.on('qr', (qr) => {
    console.log('📸 Escaneie o QR Code para conectar:');
    console.log(qr); // Loga o QR code como texto (para depuração local)
    // Para escanear, rode localmente com `vercel dev` e use um gerador de QR code com o texto logado
});

client.on('ready', () => {
    console.log('✅ Sprout conectado ao WhatsApp!');
});

client.on('disconnected', (reason) => {
    console.log(`❌ Cliente desconectado: ${reason}. Tentando reconectar...`);
    client.initialize();
});

client.initialize();

module.exports = client;
