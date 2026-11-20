import sql from 'mssql';

const config = {
  user: 'goeasysu_lena',
  password: 'GreatCompany@#2026',
  server: 'ws8.win.arvixe.com', 
  database: 'goeasysu_lena',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

export default async function handler(req, res) {
  try {
    await sql.connect(config);
    const result = await sql.query`SELECT * FROM Items`; 
    res.status(200).json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}