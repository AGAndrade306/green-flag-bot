const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('pedidos.db');

function criarTabelaPedidos() {
    db.run(`
        CREATE TABLE IF NOT EXISTS pedidos (
            clienteId TEXT,
            valor REAL,
            metodoPagamento TEXT,
            status TEXT,
            paymentId TEXT,
            dataExpiracao TEXT,
            PRIMARY KEY (clienteId, paymentId)
        )
    `);
}

function salvarPedido(clienteId, valorTotal) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO pedidos (clienteId, valor, metodoPagamento, status, paymentId, dataExpiracao) 
             VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(clienteId, paymentId) 
             DO UPDATE SET valor = ?, metodoPagamento = ?, status = ?, dataExpiracao = ?`,
            [clienteId, valorTotal, null, 'pending', null, null, valorTotal, null, 'pending', null],
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

function salvarHistoricoPedido(clienteId, valor, metodoPagamento, status, paymentId, dataExpiracao = null) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO pedidos (clienteId, valor, metodoPagamento, status, paymentId, dataExpiracao) 
             VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(clienteId, paymentId) 
             DO UPDATE SET valor = ?, metodoPagamento = ?, status = ?, dataExpiracao = ?`,
            [clienteId, valor, metodoPagamento, status, paymentId, dataExpiracao, valor, metodoPagamento, status, dataExpiracao],
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
                    resolve(row || null);
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
    obterPedidoPorPaymentId
};
