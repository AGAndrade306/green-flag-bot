const { MercadoPagoConfig, Payment, Preference } = require('mercadopago');

const mpClient = new MercadoPagoConfig({
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN,
});
const paymentClient = new Payment(mpClient);
const preferenceClient = new Preference(mpClient);

async function gerarQRCodePix(clienteId, valor) {
    try {
        console.log(`Iniciando geração de QR Code PIX para ${clienteId}. Valor: ${valor}`);
        console.log(`🔍 ClienteId recebido: ${clienteId}`);

        const body = {
            transaction_amount: valor,
            description: `Pedido #${clienteId}`,
            payment_method_id: 'pix',
            date_of_expiration: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            notification_url: 'https://sprout-bot-ymii.onrender.com/webhook',
            payer: {
                email: 'cliente@exemplo.com',
                identification: {
                    type: 'CPF',
                    number: '12345678909'
                }
            },
            additional_info: {
                items: [
                    {
                        id: clienteId,
                        title: `Pedido #${clienteId}`,
                        description: 'Compra via bot',
                        quantity: 1,
                        unit_price: valor
                    }
                ]
            },
            external_reference: clienteId
        };

        console.log('Requisição enviada ao Mercado Pago:', JSON.stringify(body, null, 2));
        const response = await paymentClient.create({ body });
        console.log('Resposta da API do Mercado Pago:', JSON.stringify(response, null, 2));

        const pixCopiaCola = response.body.point_of_interaction?.transaction_data?.qr_code;
        if (!pixCopiaCola) {
            console.error('❌ Resposta do Mercado Pago não contém o QR Code PIX.');
            return null;
        }

        console.log(`✅ QR Code PIX gerado para ${clienteId}: ${pixCopiaCola}`);
        return {
            pixCopiaCola,
            paymentId: response.body.id.toString()
        };
    } catch (error) {
        console.error(`❌ Erro ao gerar QR Code PIX para ${clienteId}:`, error.message);
        return null;
    }
}

async function gerarLinkPagamentoCartao(clienteId, valor) {
    try {
        console.log(`🔍 Gerando link de pagamento com cartão para ${clienteId}. Valor: ${valor}`);

        const body = {
            items: [
                {
                    title: `Pedido #${clienteId}`,
                    unit_price: valor,
                    quantity: 1,
                    currency_id: 'BRL'
                }
            ],
            back_urls: {
                success: 'https://sprout-bot-ymii.onrender.com/success',
                failure: 'https://sprout-bot-ymii.onrender.com/failure',
                pending: 'https://sprout-bot-ymii.onrender.com/pending'
            },
            auto_return: 'approved',
            payment_methods: {
                excluded_payment_methods: [],
                excluded_payment_types: [],
                installments: 12
            },
            notification_url: 'https://sprout-bot-ymii.onrender.com/webhook',
            external_reference: clienteId
        };

        console.log('Requisição enviada ao Mercado Pago para Preference:', JSON.stringify(body, null, 2));
        const response = await preferenceClient.create({ body });
        console.log('Resposta da API do Mercado Pago:', JSON.stringify(response, null, 2));

        const linkPagamento = response.body.init_point;
        if (!linkPagamento) {
            console.error('❌ Resposta do Mercado Pago não contém o link de pagamento.');
            return null;
        }

        console.log(`✅ Link de pagamento gerado para ${clienteId}: ${linkPagamento}`);
        return {
            link: linkPagamento,
            paymentId: response.body.id
        };
    } catch (error) {
        console.error(`❌ Erro ao gerar link de pagamento com cartão para ${clienteId}:`, error.message);
        return null;
    }
}

module.exports = {
    gerarQRCodePix,
    gerarLinkPagamentoCartao
};
