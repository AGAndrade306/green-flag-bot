const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth(),
});

client.on('qr', qr => {
    console.log('📸 Escaneie o QR Code para conectar:');
    qrcode.generate(qr, { small: true });
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