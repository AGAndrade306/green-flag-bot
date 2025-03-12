const axios = require('axios');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

const mpClient = new MercadoPagoConfig({
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN,
    options: { timeout: 5000 }
});
const preferenceClient = new Preference(mpClient);
const paymentClient = new Payment(mpClient);
console.log("✅ Mercado Pago configurado com MercadoPagoConfig. Token:", process.env.MERCADO_PAGO_ACCESS_TOKEN);

async function gerarLinkPagamentoCartao(clienteId, valor) {
    try {
        if (valor <= 0) throw new Error("Valor inválido para pagamento.");

        if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) {
            throw new Error("Variável de ambiente MERCADO_PAGO_ACCESS_TOKEN não configurada.");
        }

        const preferenceData = {
            items: [
                {
                    title: `Pedido #${clienteId}`,
                    unit_price: parseFloat(valor),
                    quantity: 1,
                    currency_id: 'BRL',
                },
            ],
            back_urls: {
                success: 'https://sua-hamburgueria.com/sucesso',
                failure: 'https://sua-hamburgueria.com/cancelado',
                pending: 'https://sua-hamburgueria.com/pendente',
            },
            auto_return: 'approved',
            payment_methods: {
                excluded_payment_methods: [],
                excluded_payment_types: [],
                installments: 12,
            },
            notification_url: 'http://localhost:3000/webhook', // URL do seu webhook
            external_reference: clienteId, // Identificador único para rastrear o cliente
        };

        console.log("Requisição enviada ao Mercado Pago para Preference:", JSON.stringify(preferenceData, null, 2));

        const response = await preferenceClient.create({ body: preferenceData });

        if (!response || !response.init_point) {
            throw new Error(`Resposta inválida da API do Mercado Pago. Resposta: ${JSON.stringify(response)}`);
        }

        console.log(`✅ Link de pagamento gerado para ${clienteId}: ${response.init_point}`);
        return response.init_point;
    } catch (error) {
        console.error(`❌ Erro ao gerar link de pagamento com cartão para ${clienteId}:`, error.message);
        console.error("Detalhes completos do erro:", error);
        return null;
    }
}

async function gerarQRCodePix(clienteId, valor) {
    try {
        console.log(`Iniciando geração de QR Code PIX para ${clienteId}. Valor: ${valor}`);

        if (valor <= 0) throw new Error("Valor inválido para pagamento.");

        if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) {
            throw new Error("Variável de ambiente MERCADO_PAGO_ACCESS_TOKEN não configurada.");
        }

        const paymentData = {
            transaction_amount: parseFloat(valor),
            description: `Pedido #${clienteId}`,
            payment_method_id: 'pix',
            date_of_expiration: new Date(Date.now() + 3600 * 1000).toISOString(),
            notification_url: 'http://localhost:3000/webhook', // URL do seu webhook
            payer: {
                email: 'cliente@exemplo.com',
                identification: { type: 'CPF', number: '12345678909' }
            },
            additional_info: {
                items: [
                    {
                        id: clienteId,
                        title: `Pedido #${clienteId}`,
                        description: 'Compra via bot',
                        quantity: 1,
                        unit_price: parseFloat(valor)
                    }
                ]
            },
            external_reference: clienteId, // Identificador único para rastrear o cliente
        };

        console.log("Requisição enviada ao Mercado Pago:", JSON.stringify(paymentData, null, 2));

        const response = await paymentClient.create({ body: paymentData });

        console.log("Resposta da API do Mercado Pago:", JSON.stringify(response, null, 2));

        if (!response || !response.id) {
            throw new Error(`Resposta inválida da API do Mercado Pago. Resposta: ${JSON.stringify(response)}`);
        }

        const pixCopiaCola = response.point_of_interaction?.transaction_data?.qr_code;
        const qrCodeImagem = response.point_of_interaction?.transaction_data?.qr_code_base64;

        if (!pixCopiaCola || !qrCodeImagem) {
            throw new Error(`Resposta da API não contém PIX Copia e Cola ou QR Code. Resposta: ${JSON.stringify(response)}`);
        }

        console.log(`✅ QR Code PIX gerado para ${clienteId}: ${pixCopiaCola}`);
        return { pixCopiaCola, qrCodeImagem };
    } catch (error) {
        console.error(`❌ Erro ao gerar QR Code PIX para ${clienteId}:`, error.message);
        console.error("Detalhes completos do erro:", error);
        return null;
    }
}

module.exports = { gerarQRCodePix, gerarLinkPagamentoCartao };