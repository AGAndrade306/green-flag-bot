const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./clientes.db', (err) => {
    if (err) {
        console.error('❌ Erro ao conectar ao banco de dados:', err);
        process.exit(1);
    }
    console.log('📊 Banco de dados conectado com sucesso.');
});

function criarTabelaPedidos() {
    // Tabela de pedidos
    db.run(`
        CREATE TABLE IF NOT EXISTS pedidos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            numero_cliente TEXT NOT NULL,
            valor REAL NOT NULL,
            status TEXT DEFAULT 'pendente',
            data_pedido DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error('❌ Erro ao criar tabela pedidos:', err);
        else console.log('✅ Tabela pedidos criada ou já existente.');
    });

    // Tabela de histórico de pedidos
    db.run(`
        CREATE TABLE IF NOT EXISTS historico_pedidos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            numero_cliente TEXT NOT NULL,
            valor REAL,
            metodo_pagamento TEXT,
            status TEXT DEFAULT 'pending',
            data_pedido DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME
        )
    `, (err) => {
        if (err) console.error('❌ Erro ao criar tabela historico_pedidos:', err);
        else console.log('✅ Tabela historico_pedidos criada ou já existente.');
    });

    // Verifica e adiciona a coluna 'data_pedido' se necessário
    db.all("PRAGMA table_info(pedidos)", (err, rows) => {
        if (err) {
            console.error('❌ Erro ao verificar colunas da tabela pedidos:', err);
            return;
        }
        if (!rows.some(row => row.name === 'data_pedido')) {
            db.run('ALTER TABLE pedidos ADD COLUMN data_pedido DATETIME DEFAULT CURRENT_TIMESTAMP', (err) => {
                if (err) console.error('❌ Erro ao adicionar coluna data_pedido:', err);
                else console.log('✅ Coluna data_pedido adicionada à tabela pedidos.');
            });
        }
    });

    // Verifica e adiciona a coluna 'expires_at' se necessário
    db.all("PRAGMA table_info(historico_pedidos)", (err, rows) => {
        if (err) {
            console.error('❌ Erro ao verificar colunas da tabela historico_pedidos:', err);
            return;
        }
        if (!rows.some(row => row.name === 'expires_at')) {
            db.run('ALTER TABLE historico_pedidos ADD COLUMN expires_at DATETIME', (err) => {
                if (err) console.error('❌ Erro ao adicionar coluna expires_at:', err);
                else console.log('✅ Coluna expires_at adicionada à tabela historico_pedidos.');
            });
        }
    });

    // Verifica e adiciona a coluna 'status' se necessário
    db.all("PRAGMA table_info(historico_pedidos)", (err, rows) => {
        if (err) {
            console.error('❌ Erro ao verificar colunas da tabela historico_pedidos:', err);
            return;
        }
        if (!rows.some(row => row.name === 'status')) {
            db.run('ALTER TABLE historico_pedidos ADD COLUMN status TEXT DEFAULT "pending"', (err) => {
                if (err) console.error('❌ Erro ao adicionar coluna status:', err);
                else console.log('✅ Coluna status adicionada à tabela historico_pedidos.');
            });
        }
    });
}

async function salvarPedido(clienteId, valor) {
    if (!clienteId || valor <= 0) {
        console.error(`❌ Dados inválidos para salvar pedido: clienteId=${clienteId}, valor=${valor}`);
        return false;
    }
    return new Promise((resolve) => {
        db.run(
            'INSERT INTO pedidos (numero_cliente, valor, status) VALUES (?, ?, "pendente")',
            [clienteId, valor],
            (err) => {
                if (err) {
                    console.error(`❌ Erro ao salvar pedido para ${clienteId}:`, err);
                    return resolve(false);
                }
                console.log(`✅ Pedido salvo para ${clienteId}: R$ ${valor.toFixed(2)}`);
                resolve(true);
            }
        );
    });
}

async function obterValorPedido(clienteId) {
    if (!clienteId) {
        console.error('❌ clienteId não fornecido para buscar valor do pedido');
        return 0;
    }
    return new Promise((resolve) => {
        db.get(
            'SELECT valor FROM pedidos WHERE numero_cliente = ? AND status = "pendente" ORDER BY id DESC LIMIT 1',
            [clienteId],
            (err, row) => {
                if (err) {
                    console.error(`❌ Erro ao buscar valor do pedido para ${clienteId}:`, err);
                    return resolve(0);
                }
                resolve(row ? row.valor : 0);
            }
        );
    });
}

async function salvarHistoricoPedido(clienteId, valor, metodoPagamento, status = 'pending') {
    if (!clienteId) {
        console.error(`❌ Dados inválidos para salvar histórico: clienteId=${clienteId}`);
        return false;
    }
    // Se valor e metodoPagamento forem null (caso do webhook atualizando status), não calcular expires_at
    const expiresAt = (valor && metodoPagamento) ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null;

    return new Promise((resolve) => {
        // Se valor e metodoPagamento forem fornecidos, insere um novo registro
        if (valor && metodoPagamento) {
            db.run(
                'INSERT INTO historico_pedidos (numero_cliente, valor, metodo_pagamento, status, expires_at) VALUES (?, ?, ?, ?, ?)',
                [clienteId, valor, metodoPagamento, status, expiresAt],
                (err) => {
                    if (err) {
                        console.error(`❌ Erro ao salvar histórico do pedido para ${clienteId}:`, err);
                        return resolve(false);
                    }
                    console.log(`✅ Histórico salvo para ${clienteId}: R$ ${valor ? valor.toFixed(2) : 'N/A'} (${metodoPagamento}), status: ${status}, expira em ${expiresAt || 'N/A'}`);
                    resolve(true);
                }
            );
        } else {
            // Se não houver valor ou metodoPagamento, atualiza o status do último pedido pendente
            db.run(
                'UPDATE historico_pedidos SET status = ? WHERE numero_cliente = ? AND status = "pending" ORDER BY id DESC LIMIT 1',
                [status, clienteId],
                (err) => {
                    if (err) {
                        console.error(`❌ Erro ao atualizar status do histórico para ${clienteId}:`, err);
                        return resolve(false);
                    }
                    console.log(`✅ Status do histórico atualizado para ${clienteId}: ${status}`);
                    resolve(true);
                }
            );
        }
    });
}

module.exports = { criarTabelaPedidos, salvarPedido, obterValorPedido, salvarHistoricoPedido };