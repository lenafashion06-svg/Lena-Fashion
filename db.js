const sql = require('mssql');

const config = {
    user: 'goeasysu_lena',
    password: 'GreatCompany@#2026',
    server: 'ws8.win.arvixe.com',
    database: 'goeasysu_lena',
    port: 1433,
    options: {
        encrypt: true,
        trustServerCertificate: true,
        enableArithAbort: true
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    requestTimeout: 30000,
    connectionTimeout: 30000,
};

const pool = new sql.ConnectionPool(config);
const poolPromise = pool.connect()
    .then(() => {
        console.log('Connected to SQL Server successfully!');
        return pool;
    })
    .catch(err => {
        console.log('Database Connection Failed! Bad Config: ', err);
        throw err;
    });

module.exports = { sql, poolPromise };