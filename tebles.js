const { poolPromise } = require('./db');
async function run() {
    let pool = await poolPromise;
    let r = await pool.request().query(`
        SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME
    `);
    console.log('----- كل الجداول اللي في الداتابيز -----');
    for (let row of r.recordset) {
        console.log(row.TABLE_NAME);
    }
    process.exit(0);
}
run();