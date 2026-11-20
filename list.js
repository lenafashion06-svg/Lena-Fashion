const { poolPromise } = require('./db');
async function run() {
    let pool = await poolPromise;
    console.log('===== كل الجداول في الداتابيز الحقيقية =====');
    let t = await pool.request().query(`SELECT TABLE_SCHEMA + '.' + TABLE_NAME as t FROM INFORMATION_SCHEMA.TABLES ORDER BY TABLE_NAME`);
    for (let row of t.recordset) console.log(row.t);

    console.log('');
    console.log('===== بندور على TCLW =====');
    let cols = await pool.request().query(`SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE DATA_TYPE IN ('nvarchar','varchar','nchar','char')`);
    for (let c of cols.recordset) {
        try {
            let r = await pool.request().query(`SELECT TOP 1 [${c.COLUMN_NAME}] as v FROM [${c.TABLE_SCHEMA}].[${c.TABLE_NAME}] WITH (NOLOCK) WHERE [${c.COLUMN_NAME}] LIKE '%TCLW%'`);
            if (r.recordset.length > 0) console.log('لقيته في: ' + c.TABLE_SCHEMA + '.' + c.TABLE_NAME + ' | عمود: ' + c.COLUMN_NAME + ' | قيمة: ' + r.recordset[0].v);
        } catch(e) {}
    }
    console.log('خلصنا');
    process.exit(0);
}
run();