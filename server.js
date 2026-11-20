const express = require('express');
const cors = require('cors');
const { sql, poolPromise } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

function norm(s) {
    return (s || '')
        .replace(/\s+/g, '')
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/[ىی]/g, 'ي')
        .replace(/[کك]/g, 'ك')
        .replace(/[0-9٠-٩۰-۹]/g, '');
}

const COLOR_MAP = {
  'white':'ابيض', 'off white':'اوف وايت', 'offwhite':'اوف وايت',
  'black':'اسود', 'red':'احمر', 'burgundy':'برجاندى', 'maroon':'نبيتي', 'wine':'نبيتي',
  'green':'اخضر', 'light green':'اخضر فاتح', 'mint green':'منت جرين', 'mint':'منت جرين',
  'dark blue':'ازرق غامق', 'light blue':'ازرق فاتح', 'blue':'ازرق', 'baby blue':'بيبي بلو', 'babyblue':'بيبي بلو',
  'dark yellow':'اصفر غامق', 'light yellow':'اصفر فاتح', 'yellow':'اصفر',
  'orange':'اورانج', 'petrol':'بترولي', 'pistachio':'بستاج',
  'purple':'بنفسجي', 'mauve':'موف', 'lavender':'لافندر',
  'brown':'بني', 'dark beige':'بيج غامق', 'beige':'بيج',
  'pink':'بينك', 'rose':'روز',
  'dark grey':'جراي غامق', 'dark gray':'جراي غامق', 'light grey':'جراي فاتح', 'light gray':'جراي فاتح', 'grey':'جراي', 'gray':'جراي',
  'camel':'جملى', 'jeans':'جنزارى', 'denim':'جنزارى',
  'dark olive':'زيتي غامق', 'light olive':'زيتي فاتح', 'olive':'زيتي',
  'salmon':'سيمون', 'fuchsia':'فوشيا', 'turquoise':'فيروزى',
  'coffee':'كافية', 'linen':'كتان', 'navy':'كحلي',
  'cashmere':'كشمير', 'cumin':'كموني', 'kiwi':'كيوى',
  'lemon':'لموني', 'mustard':'مستردة', 'havan':'هافان', 'havana':'هافان',
  'varied':'متنوع', 'mixed':'متنوع',
  'checkered':'كاروة', 'plaid':'كاروة', 'caro':'كاروة',
  'brown plaid':'كاروه بني', 'orange plaid':'كاروه اوانج',
  'beige plaid':'كاروة بيج ف اسود', 'grey plaid':'كاروة جراي ف بينك'
};

function fixColor(c) {
  const low = (c || '').toLowerCase().trim();
  if (/[\u0600-\u06FF]/.test(c)) return c;
  if (COLOR_MAP[low]) return COLOR_MAP[low];
  if (low.includes('light')) {
    const base = low.replace('light','').trim();
    if (COLOR_MAP[base]) return COLOR_MAP[base] + ' فاتح';
  }
  if (low.includes('dark')) {
    const base = low.replace('dark','').trim();
    if (COLOR_MAP[base]) return COLOR_MAP[base] + ' غامق';
  }
  return c;
}

function extractModel(title) {
  let clean = (title || '').replace(/[()]/g, '').trim();
  clean = clean.replace(/^(PANT|SHIRT|DRESS|TOP|SKIRT|COAT|JACKET|BLOUSE)/i, '').trim();
  const parts = clean.split(/\s+/);
  return parts[parts.length - 1];
}

async function getStock(pool, model, color, size) {
    const res = await pool.request()
        .input('model', sql.NVarChar, `%${model}%`)
        .query(`SELECT ModelName, ColorName, SizeName, AlexQty, CairoQty, WebAvailableQty
                FROM dbo.WebStock_WithPriority
                WHERE ModelName LIKE @model`);
    const nModel = norm(model);
    const nColor = norm(color);
    const nSize = (size || '').trim();
    const filtered = res.recordset.filter(r => {
        const m = norm(r.ModelName);
        const c = norm(r.ColorName);
        const s = (r.SizeName || '').trim();
        const modelOk = m.includes(nModel) || nModel.includes(m);
        const colorOk = c.includes(nColor) || nColor.includes(c);
        return modelOk && colorOk && s === nSize;
    });
    return { all: res.recordset, filtered };
}

async function createWTWRequest(pool, warehouseID, model, color, size, qtyToDeduct) {
    if (qtyToDeduct <= 0) return true;
    const res = await pool.request()
        .input('model', sql.NVarChar, `%${model}%`)
        .query(`SELECT ItemID, ModelName, ColorName, SizeName, ISNULL(SellPriceMajor,0) AS SellPriceMajor, ISNULL(SellPriceMinor,0) AS SellPriceMinor, MinorUnit FROM dbo.Items WHERE ModelName LIKE @model`);
    const nModel = norm(model);
    const nColor = norm(color);
    const nSize = (size || '').trim();
    const found = res.recordset.find(r => {
        const m = norm(r.ModelName);
        const c = norm(r.ColorName);
        const s = (r.SizeName || '').trim();
        return (m.includes(nModel) || nModel.includes(m)) && (c.includes(nColor) || nColor.includes(c)) && s === nSize;
    });
    if (!found) return false;

    const fromWh = warehouseID;
    const toWh = 4;

    const wtwIdRes = await pool.request()
        .query(`SELECT ISNULL(MAX(WTWID),0)+1 AS NewWTWID FROM WTWs WHERE FiscalYearID = 1 AND BranchID = 1`);
    const newWTWID = wtwIdRes.recordset[0].NewWTWID;

    const headRes = await pool.request()
        .input('wtwid', sql.Int, newWTWID)
        .input('fromWh', sql.Int, fromWh)
        .input('toWh', sql.Int, toWh)
        .input('notes', sql.NVarChar, `Web Order - موديل ${model} لون ${color} مقاس ${size}`)
        .query(`INSERT INTO WTWs (FiscalYearID, BranchID, WTWID, FromWarehouseID, ToWarehouseID, WTWDate, WTWDay, WTWMonth, WTWYear, SaveStatus, UserID, TimeStamp, Notes)
                OUTPUT INSERTED.ReceiptID
                VALUES (1, 1, @wtwid, @fromWh, @toWh, GETDATE(), DAY(GETDATE()), MONTH(GETDATE()), YEAR(GETDATE()), 1, 1, GETDATE(), @notes)`);
    const receiptID = headRes.recordset[0].ReceiptID;

    await pool.request()
        .input('receipt', sql.Int, receiptID)
        .input('item', sql.Int, found.ItemID)
        .input('fromWh', sql.Int, fromWh)
        .input('toWh', sql.Int, toWh)
        .input('price', sql.Decimal(18,2), found.SellPriceMajor || 0)
        .input('minorPrice', sql.Decimal(18,2), found.SellPriceMinor || 0)
        .input('qty', sql.Decimal(10,2), qtyToDeduct)
        .input('unit', sql.NVarChar, found.MinorUnit || '')
        .query(`INSERT INTO WTWItems (ReceiptID, ItemID, FromWarehouseID, ToWarehouseID, UnitPrice, Quantity, Discount, TotalSum, MajorQty, MinorQty, Unit, TimeStamp, MinorPrice, MajorPrice)
                VALUES (@receipt, @item, @fromWh, @toWh, @price, @qty, 0, @price * @qty, @qty, @qty, @unit, GETDATE(), @minorPrice, @price)`);

    console.log(`> عملت تحويل WTW رقم ${newWTWID} - من ${fromWh} لـ 4 الشحن - خصم ${qtyToDeduct}`);
    return true;
}

app.post('/api/sync-order', async (req, res) => {
    try {
        const { items, clientName } = req.body;
        let pool = await poolPromise;
        let results = [];
        for (let item of items) {
            const model = extractModel(item.model || item.title || '');
            const color = fixColor(item.color || '');
            const size = item.size || '';
            const quantity = item.quantity || 1;
            if (!model) continue;
            console.log(`> هخصم ${quantity} من: موديل=${model} لون=${color} مقاس=${size} - عميلة: ${clientName || ''}`);
            const { all, filtered } = await getStock(pool, model, color, size);
            const row = filtered[0];
            if (!row || row.WebAvailableQty < quantity) {
                const avail = all.filter(r => (r.SizeName || '').trim() === (size || '').trim() && r.WebAvailableQty > 0);
                console.log(`> غير متاح - المتاح: ${row?.WebAvailableQty ?? 0} - الألوان المتاحة: ${avail.map(r=>r.ColorName).join(' | ')}`);
                results.push({ title: item.title, color, size, status: 'غير متاح', available: row?.WebAvailableQty ?? 0, availableColors: avail });
                continue;
            }
            const deductAlex = Math.min(row.AlexQty, quantity);
            const deductCairo = quantity - deductAlex;
            const ok1 = await createWTWRequest(pool, 1, model, color, size, deductAlex);
            const ok2 = await createWTWRequest(pool, 2, model, color, size, deductCairo);
            results.push({ title: item.title, color, size, status: (ok1 || ok2) ? 'تم الخصم' : 'فشل' });
        }
        res.json({ success: true, results });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/orders', async (req, res) => {
    try {
        const { customerName, totalAmount } = req.body;
        const pool = await poolPromise;
        const result = await pool.request()
            .input('CustomerName', sql.NVarChar, customerName || 'عميلة لينا فاشون')
            .input('TotalAmount', sql.Decimal(10, 2), totalAmount || 0)
            .query('INSERT INTO dbo.Orders (CustomerName, TotalAmount, OrderDate) VALUES (@CustomerName, @TotalAmount, GETDATE()); SELECT SCOPE_IDENTITY() AS OrderId;');
        res.status(201).json({ success: true, orderId: result.recordset[0].OrderId });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(3000, () => console.log(`Server running on port 3000`));