const OpenAI = require("openai");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const ASSISTANT_ID = process.env.ASSISTANT_ID;
if (!ASSISTANT_ID) {
    console.error("⚠️ ERRO: 'ASSISTANT_ID' não encontrado no .env!");
    process.exit(1);
}

const threads = new Map();

async function createThread(clienteId) {
    try {
        const thread = await openai.beta.threads.create();
        console.log(`✅ Thread criada para ${clienteId}: ${thread.id}`);
        threads.set(clienteId, thread.id);
        return thread.id;
    } catch (error) {
        console.error(`❌ Erro ao criar thread para ${clienteId}:`, error);
        return null;
    }
}

async function consultarAssistant(clienteId, userMessage) {
    try {
        // Cria uma thread se não existir
        if (!threads.has(clienteId)) {
            const threadId = await createThread(clienteId);
            if (!threadId) throw new Error("Não foi possível criar uma thread.");
        }

        const threadId = threads.get(clienteId);

        // Adiciona a mensagem do usuário
        await openai.beta.threads.messages.create(threadId, {
            role: "user",
            content: userMessage,
        });

        console.log(`📩 Mensagem do cliente ${clienteId} enviada para o Assistant.`);

        // Inicia a execução do Assistant
        const run = await openai.beta.threads.runs.create(threadId, {
            assistant_id: ASSISTANT_ID,
        });

        // Aguarda a conclusão da execução
        let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
        const maxAttempts = 30; // Aumentei o limite
        const delay = 1000; // 1 segundo entre tentativas
        let attempts = 0;

        while (runStatus.status !== "completed" && attempts < maxAttempts) {
            if (runStatus.status === "failed") {
                throw new Error("Execução do Assistant falhou.");
            }
            console.log(`⏳ Aguardando resposta do Assistant... Tentativa ${attempts + 1}/${maxAttempts}`);
            await new Promise(resolve => setTimeout(resolve, delay));
            runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
            attempts++;
        }

        if (runStatus.status !== "completed") {
            throw new Error("Timeout ao aguardar resposta do Assistant.");
        }

        // Recupera a resposta
        const messages = await openai.beta.threads.messages.list(threadId);
        const response = messages.data[0]?.content[0]?.text?.value;
        if (!response) throw new Error("Resposta vazia ou inválida do Assistant.");

        console.log(`✅ Resposta recebida para ${clienteId}: ${response}`);
        return response;
    } catch (error) {
        console.error(`❌ Erro ao consultar o Assistant para ${clienteId}:`, error.message);
        return null;
    }
}

module.exports = { consultarAssistant };