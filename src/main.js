require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { MessageMedia } = require('whatsapp-web.js');
const client = require('./whatsapp');
const { criarTabelaPedidos, salvarPedido, obterValorPedido, salvarHistoricoPedido } = require('./database');
const { consultarAssistant } = require('./openai');
const { gerarQRCodePix, gerarLinkPagamentoCartao } = require('./payment'); // Adicionada esta linha
const { MercadoPagoConfig, MerchantOrder } = require('mercadopago');

const mpClient = new MercadoPagoConfig({
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN,
});
const merchantOrderClient = new MerchantOrder(mpClient);

console.log("🔍 Iniciando bot...");
console.log("🔍 Caminho do processo:", process.cwd());
console.log("🔍 Verificando EFI_PIX_KEY:", process.env.EFI_PIX_KEY);
console.log("🔍 Verificando variáveis de ambiente...");
console.log("ASSISTANT_ID:", process.env.ASSISTANT_ID);
console.log("EFI_CLIENT_ID:", process.env.EFI_CLIENT_ID);
console.log("EFI_CLIENT_SECRET:", process.env.EFI_CLIENT_SECRET);
console.log("MERCADO_PAGO_ACCESS_TOKEN:", process.env.MERCADO_PAGO_ACCESS_TOKEN || "Não encontrado");

delete require.cache[require.resolve('./payment')];

criarTabelaPedidos();

const pedidosPorCliente = {};
const app = express();
app.use(express.json());

const imagensCardapio = {
    "pepperoncino": "pepperoncino.jpeg",
    "green": "green.jpeg",
    "royal": "royal.jpeg",
    "american": "american.jpeg",
    "vera cruz": "vera_cruz.jpeg",
    "milão": "milao.jpeg"
};

async function enviarImagem(msg, imagePath, caption) {
    try {
        if (!fs.existsSync(imagePath)) {
            console.error(`❌ Imagem não encontrada: ${imagePath}`);
            await client.sendMessage(msg.from, "⚠️ Desculpe, não encontrei a imagem desse item.");
            return false;
        }
        const media = MessageMedia.fromFilePath(imagePath);
        await client.sendMessage(msg.from, media, { caption });
        return true;
    } catch (error) {
        console.error(`❌ Erro ao enviar imagem ${imagePath}:`, error);
        await client.sendMessage(msg.from, "⚠️ Erro ao enviar a imagem. Tente novamente mais tarde.");
        return false;
    }
}

app.post('/webhook', async (req, res) => {
    console.log("🔍 Recebendo webhook...");
    const notification = req.body;
    console.log("📥 Webhook recebido:", JSON.stringify(notification, null, 2));

    if (notification.type === 'payment' && notification.data && notification.data.id) {
        const paymentId = notification.data.id;
        const clienteId = notification.external_reference || null;

        if (!clienteId) {
            console.error("❌ Webhook sem external_reference. Não posso identificar o cliente.");
            return res.status(400).send("Missing external_reference");
        }

        console.log(`🔍 Processando pagamento ${paymentId} para cliente ${clienteId}`);
        const status = notification.action === 'payment.updated' ? (notification.live_mode ? 'approved' : 'pending') : 'unknown';

        if (status === 'approved') {
            console.log(`✅ Pagamento ${paymentId} confirmado para ${clienteId}`);
            await salvarHistoricoPedido(clienteId, null, null, 'approved');
            await client.sendMessage(`${clienteId}@c.us`, "🎉 Pagamento confirmado! Seu pedido está sendo preparado.");
        } else {
            console.log(`⏳ Pagamento ${paymentId} ainda pendente para ${clienteId}`);
        }
    } else if (notification.topic === 'merchant_order') {
        console.log("🔍 Webhook do tipo merchant_order. Consultando detalhes...");
        try {
            const orderId = notification.resource.split('/').pop();
            const order = await merchantOrderClient.get({ merchantOrderId: orderId });
            console.log("📦 Detalhes do merchant_order:", JSON.stringify(order, null, 2));

            const clienteId = order.body.external_reference || null;
            if (!clienteId) {
                console.error("❌ Merchant order sem external_reference. Não posso identificar o cliente.");
                return res.status(400).send("Missing external_reference");
            }

            const payments = order.body.payments || [];
            for (const payment of payments) {
                const paymentId = payment.id;
                const status = payment.status === 'approved' ? 'approved' : 'pending';

                console.log(`🔍 Pagamento ${paymentId} no merchant_order para cliente ${clienteId}: status ${status}`);
                if (status === 'approved') {
                    console.log(`✅ Pagamento ${paymentId} confirmado para ${clienteId}`);
                    await salvarHistoricoPedido(clienteId, null, null, 'approved');
                    await client.sendMessage(`${clienteId}@c.us`, "🎉 Pagamento confirmado! Seu pedido está sendo preparado.");
                } else {
                    console.log(`⏳ Pagamento ${paymentId} ainda pendente para ${clienteId}`);
                }
            }
        } catch (error) {
            console.error("❌ Erro ao consultar merchant_order:", error.message);
        }
    } else {
        console.log("⚠️ Webhook não é um pagamento ou formato inesperado.");
    }

    res.status(200).send("Webhook recebido");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Servidor webhook rodando na porta ${PORT}`);
});

client.on('message', async msg => {
    if (!msg.from.endsWith('@c.us')) return;
    const userMessage = msg.body.toLowerCase().trim();
    console.log(`📩 Mensagem recebida de ${msg.from}: ${userMessage}`);

    const clienteId = msg.from.split('@')[0];

    try {
        if (userMessage.includes("pode finalizar") || userMessage.includes("confirmar")) {
            const valorTotal = pedidosPorCliente[clienteId]?.valorTotal || await obterValorPedido(clienteId);

            if (!valorTotal || valorTotal <= 0) {
                await client.sendMessage(msg.from, "❌ Nenhum pedido pendente encontrado. Faça um pedido antes de confirmar.");
                return;
            }

            const pedidoSalvo = await salvarPedido(clienteId, valorTotal);
            if (!pedidoSalvo) {
                await client.sendMessage(msg.from, "❌ Erro ao salvar o pedido. Tente novamente.");
                return;
            }

            console.log(`✅ Pedido confirmado! Total: R$ ${valorTotal.toFixed(2)}`);
            await client.sendMessage(msg.from, `✅ Pedido confirmado! Total: R$ ${valorTotal.toFixed(2)}. Como deseja pagar? Digite "PIX" ou "Cartão".`);
            return;
        }

        const assistantResponse = await consultarAssistant(clienteId, userMessage);
        if (!assistantResponse) {
            await client.sendMessage(msg.from, "⚠️ Desculpe, não consegui processar sua mensagem. Tente novamente.");
            return;
        }
        await client.sendMessage(msg.from, assistantResponse);

        if (userMessage.includes("cardápio") || userMessage.includes("menu") || userMessage.includes("hambúrguer")) {
            for (const [item, fileName] of Object.entries(imagensCardapio)) {
                const imagePath = path.join(__dirname, 'src/images', fileName);
                await enviarImagem(msg, imagePath, `📸 ${item.charAt(0).toUpperCase() + item.slice(1)}`);
            }
        }

        for (const [item, fileName] of Object.entries(imagensCardapio)) {
            if (userMessage.includes(item)) {
                const imagePath = path.join(__dirname, 'src/images', fileName);
                await enviarImagem(msg, imagePath, `📸 Aqui está o seu pedido: ${item.charAt(0).toUpperCase() + item.slice(1)}`);
            }
        }

        const valorTotalMatch = assistantResponse.match(/(?:total|valor|R\$)[\s:]*([0-9]+[.,][0-9]{2})/i);
        if (valorTotalMatch) {
            const valorTotal = parseFloat(valorTotalMatch[1].replace(',', '.'));
            if (!isNaN(valorTotal) && valorTotal > 0) {
                pedidosPorCliente[clienteId] = { valorTotal };
            }
        }

        if (userMessage.includes("pix")) {
            const valorPedido = pedidosPorCliente[clienteId]?.valorTotal || await obterValorPedido(clienteId);

            if (!valorPedido || valorPedido <= 0) {
                await client.sendMessage(msg.from, "⚠️ Nenhum pedido pendente encontrado para pagamento.");
                return;
            }

            const pixData = await gerarQRCodePix(clienteId, valorPedido);
            if (!pixData) {
                await client.sendMessage(msg.from, "⚠️ Erro ao gerar o PIX. Tente outro método ou fale com o suporte.");
                return;
            }

            await client.sendMessage(msg.from, "💳 PIX Copia e Cola:");
            await client.sendMessage(msg.from, pixData.pixCopiaCola);
            await salvarHistoricoPedido(clienteId, valorPedido, 'PIX', 'pending');
            await client.sendMessage(msg.from, 'Aguardando pagamento. Irei atualizar você assim que for confirmado.');
            console.log(`📤 Mensagem enviada para ${clienteId}: 'Aguardando pagamento. Irei atualizar você assim que for confirmado.'`);
        }

        if (userMessage.includes("cartão")) {
            const valorPedido = pedidosPorCliente[clienteId]?.valorTotal || await obterValorPedido(clienteId);

            if (!valorPedido || valorPedido <= 0) {
                await client.sendMessage(msg.from, "⚠️ Nenhum pedido pendente encontrado para pagamento.");
                return;
            }

            const linkPagamento = await gerarLinkPagamentoCartao(clienteId, valorPedido);
            if (!linkPagamento) {
                await client.sendMessage(msg.from, "⚠️ Erro ao gerar o link de pagamento com cartão. Tente outro método ou fale com o suporte.");
                return;
            }
            await client.sendMessage(msg.from, `🔗 Link para pagamento com cartão: ${linkPagamento}`);
            await salvarHistoricoPedido(clienteId, valorPedido, 'Cartão', 'pending');
            await client.sendMessage(msg.from, 'Aguardando pagamento. Irei atualizar você assim que for confirmado.');
            console.log(`📤 Mensagem enviada para ${clienteId}: 'Aguardando pagamento. Irei atualizar você assim que for confirmado.'`);
        }
    } catch (error) {
        console.error(`❌ Erro ao processar mensagem de ${clienteId}:`, error);
        await client.sendMessage(msg.from, "⚠️ Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente mais tarde.");
    }
});
