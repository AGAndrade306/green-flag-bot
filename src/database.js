const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('pedidos.db');

function criarTabelaPedidos() {
    db.run(`
        CREATE TABLE IF NOT EXISTS pedidos (
            clienteId TEXT,
            nomeCliente TEXT,
            endereco TEXT,
            itens TEXT,  -- Armazenado como JSON: [{"item": "pepperoncino", "quantidade": 2}, ...]
            valor REAL,
            metodoPagamento TEXT,
            status TEXT,
            paymentId TEXT,
            dataExpiracao TEXT,
            dataCriacao TEXT DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (clienteId, paymentId)
        )
    `);
}

function salvarPedido(clienteId, nomeCliente, itens, valorTotal) {
    return new Promise((resolve, reject) => {
        const itensJson = JSON.stringify(itens);
        db.run(
            `INSERT INTO pedidos (clienteId, nomeCliente, itens, valor, metodoPagamento, status, paymentId, dataExpiracao) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(clienteId, paymentId) 
             DO UPDATE SET nomeCliente = ?, itens = ?, valor = ?, metodoPagamento = ?, status = ?, dataExpiracao = ?`,
            [clienteId, nomeCliente, itensJson, valorTotal, null, 'pending', null, null, nomeCliente, itensJson, valorTotal, null, 'pending', null],
            (err) => {
                if (err) {
                    console.error(`❌ Erro ao salvar pedido para ${clienteId}:`, err);
                    reject(err);
                } else {
                    resolve(true);
                }
            }
        );
    });
}

function obterValorPedido(clienteId) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT valor FROM pedidos WHERE clienteId = ? AND status = 'pending'`,
            [clienteId],
            (err, row) => {
                if (err) {
                    console.error(`❌ Erro ao obter valor do pedido para ${clienteId}:`, err);
                    reject(err);
                } else {
                    resolve(row ? row.valor : null);
                }
            }
        );
    });
}

function salvarHistoricoPedido(clienteId, nomeCliente, endereco, itens, valor, metodoPagamento, status, paymentId, dataExpiracao = null) {
    return new Promise((resolve, reject) => {
        const itensJson = JSON.stringify(itens);
        db.run(
            `INSERT INTO pedidos (clienteId, nomeCliente, endereco, itens, valor, metodoPagamento, status, paymentId, dataExpiracao) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(clienteId, paymentId) 
             DO UPDATE SET nomeCliente = ?, endereco = ?, itens = ?, valor = ?, metodoPagamento = ?, status = ?, dataExpiracao = ?`,
            [clienteId, nomeCliente, endereco, itensJson, valor, metodoPagamento, status, paymentId, dataExpiracao, 
             nomeCliente, endereco, itensJson, valor, metodoPagamento, status, dataExpiracao],
            (err) => {
                if (err) {
                    console.error(`❌ Erro ao salvar histórico para ${clienteId}:`, err);
                    reject(err);
                } else {
                    console.log(`✅ Histórico salvo para ${clienteId}: R$ ${valor} (${metodoPagamento}), status: ${status}, paymentId: ${paymentId}, expira em ${dataExpiracao}`);
                    resolve(true);
                }
            }
        );
    });
}

function obterPedidoPorPaymentId(paymentId) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT * FROM pedidos WHERE paymentId = ? AND status = 'pending'`,
            [paymentId],
            (err, row) => {
                if (err) {
                    console.error(`❌ Erro ao obter pedido por paymentId ${paymentId}:`, err);
                    reject(err);
                } else {
                    if (row) {
                        row.itens = JSON.parse(row.itens || '[]');
                    }
                    resolve(row || null);
                }
            }
        );
    });
}

function obterHistoricoPedidos(clienteId) {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT * FROM pedidos WHERE clienteId = ? ORDER BY dataCriacao DESC`,
            [clienteId],
            (err, rows) => {
                if (err) {
                    console.error(`❌ Erro ao obter histórico de pedidos para ${clienteId}:`, err);
                    reject(err);
                } else {
                    rows.forEach(row => {
                        row.itens = JSON.parse(row.itens || '[]');
                    });
                    resolve(rows);
                }
            }
        );
    });
}

module.exports = {
    criarTabelaPedidos,
    salvarPedido,
    obterValorPedido,
    salvarHistoricoPedido,
    obterPedidoPorPaymentId,
    obterHistoricoPedidos
};
