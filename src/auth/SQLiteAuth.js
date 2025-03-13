const { RemoteAuth } = require('whatsapp-web.js');
const sqlite3 = require('sqlite3').verbose();

class SQLiteAuth extends RemoteAuth {
    constructor(client) {
        const db = new sqlite3.Database('/tmp/whatsapp-session.db'); // Salva o banco de dados em /tmp
        super(client, {
            storeCredentials: async (credentials) => {
                return new Promise((resolve, reject) => {
                    db.run(
                        `CREATE TABLE IF NOT EXISTS sessions (key TEXT PRIMARY KEY, value TEXT)`,
                        (err) => {
                            if (err) return reject(err);
                            db.run(
                                `INSERT OR REPLACE INTO sessions (key, value) VALUES (?, ?)`,
                                ['session', JSON.stringify(credentials)],
                                (err) => {
                                    if (err) return reject(err);
                                    resolve();
                                }
                            );
                        }
                    );
                });
            },
            getCredentials: async () => {
                return new Promise((resolve, reject) => {
                    db.get(
                        `SELECT value FROM sessions WHERE key = ?`,
                        ['session'],
                        (err, row) => {
                            if (err) return reject(err);
                            resolve(row ? JSON.parse(row.value) : null);
                        }
                    );
                });
            },
            clearCredentials: async () => {
                return new Promise((resolve, reject) => {
                    db.run(`DELETE FROM sessions WHERE key = ?`, ['session'], (err) => {
                        if (err) return reject(err);
                        resolve();
                    });
                });
            }
        });
        this.db = db;
    }

    async destroy() {
        await super.destroy();
        return new Promise((resolve) => {
            this.db.close((err) => {
                if (err) console.error('Erro ao fechar o banco de dados:', err);
                resolve();
            });
        });
    }
}

module.exports = SQLiteAuth;