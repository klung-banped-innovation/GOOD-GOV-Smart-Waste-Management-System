/**
 * waste-ktb-import.js — นำเข้ารายรับประจำวันผ่านไฟล์ Excel กรุงไทย (KTB Corporate Online) และตัดยอดอัตโนมัติ
 * GOOD GOV Municipality Platform
 */

let ktbImportedRows = [];
let ktbRawFileName = '';

const KTB_HISTORY_KEY = 'waste_ktb_import_history';

function getKtbImportHistory() {
    try {
        return JSON.parse(localStorage.getItem(KTB_HISTORY_KEY) || '[]');
    } catch (e) {
        return [];
    }
}

function saveKtbImportHistory(historyList) {
    try {
        localStorage.setItem(KTB_HISTORY_KEY, JSON.stringify(historyList.slice(0, 50)));
    } catch (e) {}
}

/**
 * แปลงวันที่จาก Excel (Serial Number หรือ String เช่น DD/MM/YYYY, YYYY-MM-DD) เป็น YYYY-MM-DD (ค.ศ.)
 */
function parseKtbDate(val, fallbackDate) {
    if (!val && val !== 0) return fallbackDate || new Date().toISOString().split('T')[0];

    // Excel Serial Date (เช่น 45600)
    if (typeof val === 'number' && val > 25000 && val < 90000) {
        const utcDays = Math.floor(val - 25569);
        const d = new Date(utcDays * 86400 * 1000);
        if (!isNaN(d.getTime())) {
            let y = d.getUTCFullYear();
            if (y > 2400) y -= 543;
            const m = String(d.getUTCMonth() + 1).padStart(2, '0');
            const day = String(d.getUTCDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        }
    }

    const str = String(val).trim();
    if (!str) return fallbackDate || new Date().toISOString().split('T')[0];

    // รูปแบบ DD/MM/YYYY หรือ DD-MM-YYYY หรือ DD.MM.YYYY (อาจมีเวลาต่อท้าย)
    const datePart = str.split(/\s+/)[0];
    const dmyMatch = datePart.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
    if (dmyMatch) {
        let day = parseInt(dmyMatch[1], 10);
        let month = parseInt(dmyMatch[2], 10);
        let year = parseInt(dmyMatch[3], 10);
        if (year < 100) {
            // ถ้า 2 หลัก เช่น 68, 69 -> พ.ศ. 2568 หรือ ค.ศ. 2025
            year = year >= 40 ? (2500 + year - 543) : (2000 + year);
        } else if (year > 2400) {
            year -= 543;
        }
        if (month > 12 && day <= 12) {
            const tmp = day; day = month; month = tmp;
        }
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    // รูปแบบ YYYY-MM-DD หรือ YYYY/MM/DD
    const ymdMatch = datePart.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
    if (ymdMatch) {
        let year = parseInt(ymdMatch[1], 10);
        let month = parseInt(ymdMatch[2], 10);
        let day = parseInt(ymdMatch[3], 10);
        if (year > 2400) year -= 543;
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    // รูปแบบ YYYYMMDD (8 หลักติดกัน เช่น 20261113 หรือ 25691113)
    const compactMatch = datePart.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (compactMatch) {
        let year = parseInt(compactMatch[1], 10);
        let month = parseInt(compactMatch[2], 10);
        let day = parseInt(compactMatch[3], 10);
        if (year > 2400) year -= 543;
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
    }

    return fallbackDate || new Date().toISOString().split('T')[0];
}

/**
 * แปลงเวลาจาก Excel หรือ String เป็น HH:mm
 */
function parseKtbTime(val, rawDateVal) {
    if (typeof val === 'number' && val >= 0 && val < 1) {
        const totalMins = Math.round(val * 24 * 60);
        const hh = String(Math.floor(totalMins / 60) % 24).padStart(2, '0');
        const mm = String(totalMins % 60).padStart(2, '0');
        return `${hh}:${mm}`;
    }
    if (val) {
        const str = String(val).trim();
        const m = str.match(/(\d{1,2}):(\d{2})/);
        if (m) return `${ m[1].padStart(2, '0') }:${ m[2] }`;
        const mCompact = str.match(/^(\d{2})(\d{2})(\d{2})?$/);
        if (mCompact) return `${mCompact[1]}:${mCompact[2]}`;
    }
    if (rawDateVal && typeof rawDateVal === 'string') {
        const parts = rawDateVal.trim().split(/\s+/);
        if (parts.length > 1) {
            const m = parts[1].match(/(\d{1,2}):(\d{2})/);
            if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
        }
    }
    return '09:00';
}

/**
 * แปลงจำนวนเงินจาก String หรือ Number
 */
function parseKtbAmount(val) {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (!val) return 0;
    const cleaned = String(val).replace(/[^0-9.\-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

/**
 * ค้นหาลูกค้าจาก Ref1, Ref2 หรือ ชื่อผู้ชำระ
 * รองรับ:
 * - Ref1 แบบ 18 หลัก (เช่น 000000000009900001 -> 9900001)
 * - Ref1 แบบรหัสลูกค้าตรงๆ (เช่น 9900001, WC001)
 * - Ref2 ที่มีรหัสลูกค้า 6-7 หลักท้าย (เช่น 202611131131900001 -> 9900001)
 * - เลขที่ใบแจ้งหนี้ 10 หลัก (เช่น 7001900001 -> 9900001)
 * - เลขบัตรประชาชน 13 หลัก
 * - ชื่อ-นามสกุลผู้ชำระ
 */
function matchCustomerFromKtbRow(ref1Raw, ref2Raw, payerNameRaw, customers) {
    const cleanStr = s => String(s || '').trim().replace(/^'+/, ''); // ลบ ' นำหน้ากรณี Excel text
    const r1 = cleanStr(ref1Raw);
    const r2 = cleanStr(ref2Raw);
    const pName = cleanStr(payerNameRaw);

    // สร้าง Map สำหรับค้นหารวดเร็ว
    const byId = new Map();
    const byNumericId = new Map();
    const byTail6 = new Map();
    const byTail5 = new Map();
    const byIdCard = new Map();

    customers.forEach(c => {
        const cid = String(c.id).trim();
        byId.set(cid.toLowerCase(), c);

        const numOnly = cid.replace(/\D/g, '').replace(/^0+/, '');
        if (numOnly) {
            byNumericId.set(numOnly, c);
        }
        const rawDigits = cid.replace(/\D/g, '');
        if (rawDigits.length >= 6) {
            byTail6.set(rawDigits.slice(-6), c);
        }
        if (rawDigits.length >= 5) {
            byTail5.set(rawDigits.slice(-5), c);
        }
        if (c.id_card) {
            const idc = String(c.id_card).replace(/\D/g, '');
            if (idc.length === 13) byIdCard.set(idc, c);
        }
    });

    // 1. ตรวจสอบจาก Ref1 โดยตรง
    if (r1) {
        if (byId.has(r1.toLowerCase())) {
            return { customer: byId.get(r1.toLowerCase()), matchType: 'Ref1 (ตรงรหัสลูกค้า)' };
        }
        const r1Digits = r1.replace(/\D/g, '');
        const r1NoZero = r1Digits.replace(/^0+/, '');
        if (r1NoZero && byNumericId.has(r1NoZero)) {
            return { customer: byNumericId.get(r1NoZero), matchType: 'Ref1 (18 หลัก Comcode)' };
        }
        if (r1Digits.length === 13 && byIdCard.has(r1Digits)) {
            return { customer: byIdCard.get(r1Digits), matchType: 'Ref1 (เลขบัตรประชาชน)' };
        }
        if (r1Digits.length >= 6) {
            const tail6 = r1Digits.slice(-6);
            if (byTail6.has(tail6)) {
                return { customer: byTail6.get(tail6), matchType: 'Ref1 (รหัสท้าย 6 หลัก)' };
            }
        }
        if (r1Digits.length >= 5) {
            const tail5 = r1Digits.slice(-5);
            if (byTail5.has(tail5)) {
                return { customer: byTail5.get(tail5), matchType: 'Ref1 (รหัสท้าย 5 หลัก)' };
            }
        }
    }

    // 2. ตรวจสอบจาก Ref2 (เช่น YYYYMMDDHHmm + รหัสลูกค้า 6 หลักท้าย หรือ เลขใบแจ้งหนี้ YYMM + 6 หลักท้าย)
    if (r2) {
        if (byId.has(r2.toLowerCase())) {
            return { customer: byId.get(r2.toLowerCase()), matchType: 'Ref2 (ตรงรหัสลูกค้า)' };
        }
        const r2Digits = r2.replace(/\D/g, '');
        const r2NoZero = r2Digits.replace(/^0+/, '');
        if (r2NoZero && byNumericId.has(r2NoZero)) {
            return { customer: byNumericId.get(r2NoZero), matchType: 'Ref2 (รหัสลูกค้า)' };
        }
        if (r2Digits.length >= 6) {
            const tail6 = r2Digits.slice(-6);
            const tail6NoZero = tail6.replace(/^0+/, '');
            if (byTail6.has(tail6)) {
                return { customer: byTail6.get(tail6), matchType: 'Ref2 (รหัสท้าย 6 หลัก)' };
            }
            if (tail6NoZero && byNumericId.has('99' + tail6.slice(-5))) {
                return { customer: byNumericId.get('99' + tail6.slice(-5)), matchType: 'Ref2 (รหัส 99xxxxx)' };
            }
        }
    }

    // 3. ตรวจสอบจากชื่อผู้ชำระ (ถ้ามี)
    if (pName && pName.length >= 3) {
        const cleanTitle = s => s.replace(/^(นาย|นางสาว|นาง|น\.ส\.|ด\.ช\.|ด\.ญ\.|คุณ|บจก\.|หจก\.)\s*/g, '').replace(/\s+/g, ' ').trim();
        const targetClean = cleanTitle(pName);
        if (targetClean) {
            const exact = customers.find(c => c.name && (c.name.trim() === pName || cleanTitle(c.name) === targetClean));
            if (exact) {
                return { customer: exact, matchType: 'ชื่อผู้ชำระ' };
            }
        }
    }

    return { customer: null, matchType: 'ไม่พบลูกค้า' };
}

/**
 * คำนวณเดือนที่จะตัดยอดอัตโนมัติจากจำนวนเงินที่รับชำระ
 * - ค้นหาเดือนที่ค้างชำระ (unpaid) เรียงตามลำดับปีงบประมาณ (หรือปีงบประมาณที่เลือก)
 * - ตัดยอดตามจำนวนเงินจริงหารด้วยค่าธรรมเนียมรายเดือนของบ้านนั้นๆ
 */
function calculateAutoCutOffMonths(customer, paidAmount, targetFiscalYear, preferredMonthKey = 'auto') {
    if (!customer || paidAmount <= 0) {
        return { monthsToCut: [], status: 'ERROR', note: 'จำนวนเงินไม่ถูกต้องหรือไม่พบลูกค้า' };
    }

    const ms = typeof getMonthlyStatus === 'function' ? getMonthlyStatus() : {};
    const custMs = ms[customer.id] || {};
    const baseFee = Number(customer.fee) || 40;

    // รายการเดือนที่ค้างชำระเรียงตามลำดับเวลา
    const candidateMonths = [];

    // ตรวจสอบปีงบประมาณที่เลือก (และปีถัดไปเผื่อชำระล่วงหน้า หรือปีก่อนหน้าเผื่อค้างเก่า)
    const fyNum = parseInt(targetFiscalYear, 10) || parseInt(getCurrentFiscalYear(), 10);
    const yearsToScan = [String(fyNum - 1), String(fyNum), String(fyNum + 1)];

    // ให้ความสำคัญกับปีงบประมาณที่เลือกก่อน หากเลือกเดือนเฉพาะเจาะจง
    const orderedYears = [String(fyNum), String(fyNum - 1), String(fyNum + 1)];

    if (preferredMonthKey && preferredMonthKey !== 'auto') {
        const mIdx = WASTE_MONTH_KEYS.indexOf(preferredMonthKey);
        if (mIdx >= 0) {
            const st = (custMs[String(fyNum)] || {})[preferredMonthKey] || 'unpaid';
            const fee = typeof getFeeForMonth === 'function' ? Number(getFeeForMonth(customer.id, preferredMonthKey, String(fyNum))) : baseFee;
            const calYear = mIdx < 3 ? String(fyNum - 1) : String(fyNum);
            const label = `${WASTE_MONTHS[mIdx]} ${calYear.slice(-2)}`;
            if (st !== 'paid' && st !== 'exempted') {
                candidateMonths.push({
                    year: String(fyNum),
                    key: preferredMonthKey,
                    idx: mIdx,
                    fee: fee > 0 ? fee : baseFee,
                    label,
                    alreadyPaid: false
                });
            }
        }
    }

    // สแกนเดือนที่ยังไม่ได้ชำระในปีงบประมาณที่เลือก -> ปีก่อนหน้า -> ปีถัดไป
    orderedYears.forEach(yr => {
        const yrNum = parseInt(yr, 10);
        const yrStatus = custMs[yr] || {};
        WASTE_MONTH_KEYS.forEach((mk, idx) => {
            // ข้ามถ้าใส่ไปแล้วตอนเลือก preferredMonthKey
            if (candidateMonths.some(x => x.year === yr && x.key === mk)) return;

            const st = yrStatus[mk] || 'unpaid';
            if (st !== 'paid' && st !== 'exempted') {
                const fee = typeof getFeeForMonth === 'function' ? Number(getFeeForMonth(customer.id, mk, yr)) : baseFee;
                const calYear = idx < 3 ? String(yrNum - 1) : String(yrNum);
                const label = `${WASTE_MONTHS[idx]} ${calYear.slice(-2)}`;
                candidateMonths.push({
                    year: yr,
                    key: mk,
                    idx,
                    fee: fee > 0 ? fee : baseFee,
                    label,
                    alreadyPaid: false
                });
            }
        });
    });

    if (candidateMonths.length === 0) {
        return {
            monthsToCut: [],
            status: 'ALREADY_PAID',
            note: 'ลูกค้าชำระครบทุกเดือนแล้ว'
        };
    }

    const monthsToCut = [];
    let remaining = paidAmount;

    for (const cm of candidateMonths) {
        if (remaining <= 0) break;
        if (remaining >= cm.fee) {
            monthsToCut.push(cm);
            remaining = Math.round((remaining - cm.fee) * 100) / 100;
        } else {
            // ถ้ายอดเงินน้อยกว่าค่าธรรมเนียมต่อเดือน หรือไม่ลงตัวแต่ยังไม่ได้เลือกเลยสักเดือน
            if (monthsToCut.length === 0) {
                monthsToCut.push(cm);
                return {
                    monthsToCut,
                    status: 'WARNING',
                    note: `ยอดชำระ (฿${paidAmount}) ไม่ตรงกับค่าธรรมเนียม/เดือน (฿${cm.fee})`
                };
            }
            break;
        }
    }

    if (remaining > 0) {
        return {
            monthsToCut,
            status: 'WARNING',
            note: `ตัดยอด ${monthsToCut.length} เดือน (มีเศษคงเหลือ ฿${remaining})`
        };
    }

    return {
        monthsToCut,
        status: 'READY',
        note: `ตัดยอดอัตโนมัติ ${monthsToCut.length} เดือน`
    };
}

/**
 * วิเคราะห์ข้อมูลจาก Sheet ของไฟล์ Excel KTB Corporate
 */
function parseKtbWorksheet(ws, options = {}) {
    const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (!rawRows || rawRows.length === 0) return [];

    const customers = typeof getWasteCustomers === 'function' ? getWasteCustomers() : [];
    const existingPayments = typeof getWastePayments === 'function' ? getWastePayments() : [];
    const targetFiscalYear = options.fiscalYear || (typeof getCurrentFiscalYear === 'function' ? getCurrentFiscalYear() : '2569');
    const preferredMonthKey = options.preferredMonthKey || 'auto';
    const fallbackDate = options.defaultDate || new Date().toISOString().split('T')[0];

    // 1. ค้นหาบรรทัดที่เป็น Header ของตาราง KTB Corporate Bill Payment
    let headerRowIdx = -1;
    let colMap = {
        seq: -1,
        date: -1,
        time: -1,
        ref1: -1,
        ref2: -1,
        ref3: -1,
        payerName: -1,
        amount: -1,
        channel: -1,
        branch: -1,
        chequeOrTx: -1
    };

    const headerSynonyms = {
        date: ['date', 'eff date', 'effective date', 'payment date', 'trans date', 'transaction date', 'วันที่', 'วันที่ชำระ', 'วันที่ทำรายการ', 'วันเดือนปี'],
        time: ['time', 'trans time', 'เวลา', 'เวลาที่ชำระ', 'เวลาทำรายการ'],
        ref1: ['ref1', 'ref 1', 'reference 1', 'ref.1', 'ref no.1', 'cust id', 'customer no', 'customer id', 'รหัสลูกค้า', 'รหัสผู้ใช้น้ำ/ขยะ', 'อ้างอิง 1', 'เลขอ้างอิง 1', 'หมายเลขอ้างอิง 1', 'ref1 (รหัสลูกค้า)'],
        ref2: ['ref2', 'ref 2', 'reference 2', 'ref.2', 'ref no.2', 'invoice no', 'bill no', 'อ้างอิง 2', 'เลขอ้างอิง 2', 'หมายเลขอ้างอิง 2', 'เลขที่ใบแจ้งหนี้', 'ref2 (เลขใบแจ้งหนี้)'],
        payerName: ['customer name', 'payer name', 'name', 'ชื่อลูกค้า', 'ชื่อผู้ชำระ', 'ชื่อ-สกุล', 'ชื่อเจ้าบ้าน', 'ผู้ชำระ', 'รายละเอียด'],
        amount: ['amount', 'total amount', 'paid amount', 'credit', 'deposit', 'จำนวนเงิน', 'ยอดเงิน', 'ยอดชำระ', 'จำนวนเงิน (บาท)', 'จำนวนเงินที่ชำระ'],
        channel: ['channel', 'payment channel', 'term type', 'service type', 'ช่องทาง', 'ช่องทางชำระ', 'ประเภทช่องทาง']
    };

    for (let r = 0; r < Math.min(rawRows.length, 30); r++) {
        const row = rawRows[r];
        if (!Array.isArray(row)) continue;
        const cells = row.map(c => String(c || '').toLowerCase().trim());

        let matchScore = 0;
        let tempMap = { ...colMap };

        cells.forEach((cellText, cIdx) => {
            if (!cellText) return;
            for (const [field, keywords] of Object.entries(headerSynonyms)) {
                if (tempMap[field] === -1 && keywords.some(kw => cellText === kw || cellText.includes(kw))) {
                    tempMap[field] = cIdx;
                    matchScore++;
                }
            }
        });

        // ถ้าเจออย่างน้อย 2 คอลัมน์สำคัญ (เช่น ref1 + amount หรือ payerName + amount)
        if (matchScore >= 2 && (tempMap.amount !== -1 || tempMap.ref1 !== -1)) {
            headerRowIdx = r;
            colMap = tempMap;
            break;
        }
    }

    const parsedResults = [];
    const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;

    for (let r = startRow; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!Array.isArray(row)) continue;

        // ข้ามแถวว่างหรือแถวสรุปยอดรวมท้ายตาราง (Total / รวมทั้งสิ้น)
        const joinedText = row.map(x => String(x || '').trim()).join(' ').trim();
        if (!joinedText) continue;
        if (/^(total|grand total|summary|รวมทั้งสิ้น|รวมยอด|สรุปยอด|จำนวนรายการทั้งหมด)/i.test(joinedText)) continue;

        let rawDate = colMap.date >= 0 ? row[colMap.date] : '';
        let rawTime = colMap.time >= 0 ? row[colMap.time] : '';
        let ref1 = colMap.ref1 >= 0 ? row[colMap.ref1] : '';
        let ref2 = colMap.ref2 >= 0 ? row[colMap.ref2] : '';
        let payerName = colMap.payerName >= 0 ? row[colMap.payerName] : '';
        let rawAmount = colMap.amount >= 0 ? row[colMap.amount] : '';
        let channel = colMap.channel >= 0 ? row[colMap.channel] : '';

        // กรณีไฟล์ไม่มีหัวตารางชัดเจน หรือตรวจจับคอลัมน์แบบ Heuristic ในแต่ละแถว
        if (headerRowIdx === -1 || (ref1 === '' && ref2 === '' && rawAmount === '')) {
            row.forEach((cell) => {
                const s = String(cell || '').trim().replace(/^'+/, '');
                if (!s) return;
                // ตรวจจับรหัส 18 หลัก (Ref1 Comcode) หรือรหัส 99xxxxx
                if (!ref1 && (/^0{8,11}\d{7,10}$/.test(s) || /^99\d{5}$/.test(s))) {
                    ref1 = s;
                } else if (!ref2 && /^\d{16,20}$/.test(s) && s !== ref1) {
                    ref2 = s;
                } else if (!rawDate && (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(s) || /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(s))) {
                    rawDate = s;
                } else if (rawAmount === '' && typeof cell === 'number' && cell > 0 && cell < 100000) {
                    rawAmount = cell;
                }
            });
        }

        const amount = parseKtbAmount(rawAmount);
        // ถ้าไม่มีทั้ง Ref1, Ref2 และจำนวนเงินเป็น 0 ให้ข้าม (เช่น บรรทัดหมายเหตุท้ายกระดาษ)
        if (!ref1 && !ref2 && amount <= 0) continue;
        if (amount <= 0) continue;

        const payDate = parseKtbDate(rawDate, fallbackDate);
        const payTime = parseKtbTime(rawTime, rawDate);

        // จับคู่ลูกค้า
        const matchInfo = matchCustomerFromKtbRow(ref1, ref2, payerName, customers);
        const customer = matchInfo.customer;

        // คำนวณเดือนที่จะตัดยอดอัตโนมัติ
        const cutOff = calculateAutoCutOffMonths(customer, amount, targetFiscalYear, preferredMonthKey);

        // ตรวจสอบว่าเคยนำเข้ารายการนี้ไปแล้วหรือยัง (ป้องกันนำเข้าซ้ำในวันเดียวกันและยอดเดียวกัน)
        let isDuplicate = false;
        if (customer) {
            isDuplicate = existingPayments.some(p =>
                p.status !== 'cancelled' &&
                p.customer_id === customer.id &&
                p.date === payDate &&
                Number(p.amount) === Number(amount) &&
                (p.source === 'ktb-corporate' || (p.method && p.method.includes('KTB')))
            );
        }

        let finalStatus = cutOff.status; // READY, WARNING, ALREADY_PAID, ERROR
        let finalNote = cutOff.note;
        if (!customer) {
            finalStatus = 'ERROR';
            finalNote = 'ไม่พบรหัสลูกค้าในระบบ';
        } else if (isDuplicate) {
            finalStatus = 'DUPLICATE';
            finalNote = 'มีประวัติรับชำระยอดนี้ในวันที่เดียวกันแล้ว';
        }

        const selectedRow = (finalStatus === 'READY' || finalStatus === 'WARNING');

        parsedResults.push({
            rowIndex: r + 1,
            selected: selectedRow,
            payDate,
            payTime,
            ref1: String(ref1 || '').trim().replace(/^'+/, ''),
            ref2: String(ref2 || '').trim().replace(/^'+/, ''),
            excelPayerName: String(payerName || '').trim(),
            channel: String(channel || '').trim() || 'KTB Corporate',
            amount,
            customer,
            matchType: matchInfo.matchType,
            monthsToCut: cutOff.monthsToCut,
            status: finalStatus,
            note: finalNote
        });
    }

    return parsedResults;
}

/**
 * เปิดไฟล์ Excel KTB Corporate และแสดงตารางตรวจสอบก่อนตัดยอด
 */
function handleKtbExcelFile(event) {
    const file = event.target.files ? event.target.files[0] : null;
    if (!file) return;

    ktbRawFileName = file.name;
    const fileLabel = document.getElementById('ktbFileNameLabel');
    if (fileLabel) {
        fileLabel.innerHTML = `<i class="fa-solid fa-file-excel text-success me-1"></i><strong>${file.name}</strong> <span class="text-muted">(${(file.size / 1024).toFixed(1)} KB)</span>`;
    }

    Swal.fire({ title: 'กำลังอ่านไฟล์ KTB Corporate...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const ws = workbook.Sheets[firstSheetName];

            const fy = document.getElementById('ktbImportFiscalYear')?.value || getCurrentFiscalYear();
            const prefMonth = document.getElementById('ktbImportMonthMode')?.value || 'auto';
            const defDate = document.getElementById('ktbDefaultDate')?.value || new Date().toISOString().split('T')[0];

            ktbImportedRows = parseKtbWorksheet(ws, {
                fiscalYear: fy,
                preferredMonthKey: prefMonth,
                defaultDate: defDate
            });

            window._lastKtbWorksheet = ws;
            Swal.close();
            renderKtbPreviewTable();
        } catch (err) {
            console.error(err);
            Swal.fire('อ่านไฟล์ไม่สำเร็จ', 'กรุณาตรวจสอบรูปแบบไฟล์ Excel (.xlsx, .xls, .csv)', 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

/**
 * คำนวณใหม่เมื่อผู้ใช้เปลี่ยนตัวเลือก ปีงบประมาณ หรือ รูปแบบการตัดเดือน
 */
function reanalyzeKtbWorksheet() {
    if (!window._lastKtbWorksheet) return;
    const fy = document.getElementById('ktbImportFiscalYear')?.value || getCurrentFiscalYear();
    const prefMonth = document.getElementById('ktbImportMonthMode')?.value || 'auto';
    const defDate = document.getElementById('ktbDefaultDate')?.value || new Date().toISOString().split('T')[0];

    ktbImportedRows = parseKtbWorksheet(window._lastKtbWorksheet, {
        fiscalYear: fy,
        preferredMonthKey: prefMonth,
        defaultDate: defDate
    });
    renderKtbPreviewTable();
}

/**
 * แสดงตาราง Preview รายการจากไฟล์ KTB Corporate
 */
function renderKtbPreviewTable() {
    const tbody = document.getElementById('ktbPreviewTableBody');
    const summaryEl = document.getElementById('ktbPreviewSummary');
    const btnConfirm = document.getElementById('btnConfirmKtbImport');
    if (!tbody) return;

    if (!ktbImportedRows || ktbImportedRows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-muted">ไม่พบรายการชำระเงินในไฟล์ หรือยังไม่ได้อัปโหลดไฟล์ Excel</td></tr>`;
        if (summaryEl) summaryEl.style.display = 'none';
        if (btnConfirm) btnConfirm.disabled = true;
        return;
    }

    const readyRows = ktbImportedRows.filter(r => r.status === 'READY' || r.status === 'WARNING');
    const selectedRows = ktbImportedRows.filter(r => r.selected && r.customer && r.monthsToCut.length > 0);
    const totalSelectedAmount = selectedRows.reduce((s, r) => s + r.amount, 0);
    const errorCount = ktbImportedRows.filter(r => r.status === 'ERROR' || r.status === 'ALREADY_PAID' || r.status === 'DUPLICATE').length;

    if (summaryEl) {
        summaryEl.style.display = 'flex';
        summaryEl.innerHTML = `
            <div class="col-6 col-md-3">
                <div class="p-2 rounded border bg-white text-center">
                    <div class="text-xs text-muted">รายการทั้งหมดในไฟล์</div>
                    <div class="fw-bold fs-5 text-dark">${ktbImportedRows.length} รายการ</div>
                </div>
            </div>
            <div class="col-6 col-md-3">
                <div class="p-2 rounded border bg-success bg-opacity-10 border-success text-center">
                    <div class="text-xs text-success fw-semibold">พร้อมตัดยอดอัตโนมัติ</div>
                    <div class="fw-bold fs-5 text-success">${selectedRows.length} รายการ</div>
                </div>
            </div>
            <div class="col-6 col-md-3">
                <div class="p-2 rounded border bg-primary bg-opacity-10 border-primary text-center">
                    <div class="text-xs text-primary fw-semibold">ยอดเงินรวมที่จะนำเข้า</div>
                    <div class="fw-bold fs-5 text-primary">฿${formatMoneyDecimal(totalSelectedAmount)}</div>
                </div>
            </div>
            <div class="col-6 col-md-3">
                <div class="p-2 rounded border bg-warning bg-opacity-10 border-warning text-center">
                    <div class="text-xs text-danger fw-semibold">ซ้ำ / ชำระครบแล้ว / ไม่พบ</div>
                    <div class="fw-bold fs-5 text-danger">${errorCount} รายการ</div>
                </div>
            </div>
        `;
    }

    if (btnConfirm) {
        btnConfirm.disabled = selectedRows.length === 0;
        btnConfirm.innerHTML = `<i class="fa-solid fa-bolt me-1"></i>ยืนยันนำเข้าและตัดยอดอัตโนมัติ (${selectedRows.length} รายการ - ฿${formatMoneyDecimal(totalSelectedAmount)})`;
    }

    tbody.innerHTML = ktbImportedRows.map((r, idx) => {
        const canSelect = r.customer && r.monthsToCut.length > 0;
        let badgeHTML = '';
        if (r.status === 'READY') {
            badgeHTML = `<span class="badge bg-success"><i class="fa-solid fa-check me-1"></i>พร้อมตัดยอด</span>`;
        } else if (r.status === 'WARNING') {
            badgeHTML = `<span class="badge bg-warning text-dark"><i class="fa-solid fa-triangle-exclamation me-1"></i>ตรวจสอบยอด</span>`;
        } else if (r.status === 'DUPLICATE') {
            badgeHTML = `<span class="badge bg-secondary"><i class="fa-solid fa-clone me-1"></i>นำเข้าแล้ว</span>`;
        } else if (r.status === 'ALREADY_PAID') {
            badgeHTML = `<span class="badge bg-info text-dark"><i class="fa-solid fa-circle-check me-1"></i>ชำระครบแล้ว</span>`;
        } else {
            badgeHTML = `<span class="badge bg-danger"><i class="fa-solid fa-xmark me-1"></i>ไม่พบลูกค้า</span>`;
        }

        const custDisplay = r.customer
            ? `<div class="fw-bold text-dark">${r.customer.name}</div>
               <div class="text-xs text-muted">รหัส: <span class="text-primary fw-semibold">${r.customer.id}</span> | บ้านเลขที่ ${r.customer.house_no} ม.${r.customer.moo} (฿${r.customer.fee}/ด.)</div>`
            : `<div class="text-danger fw-semibold">${r.excelPayerName || 'ไม่ระบุชื่อ'}</div>
               <div class="text-xs text-muted">ไม่พบรหัสที่ตรงกับ Ref1/Ref2</div>`;

        const monthsBadges = r.monthsToCut.length > 0
            ? r.monthsToCut.map(m => `<span class="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 me-1 mb-1">${m.label}</span>`).join('')
            : `<span class="text-xs text-muted">-</span>`;

        return `<tr class="${r.selected ? '' : 'table-light text-muted'}">
            <td class="text-center">
                <input type="checkbox" class="form-check-input" ${r.selected ? 'checked' : ''} ${canSelect ? '' : 'disabled'} onchange="toggleKtbRowSelection(${idx}, this.checked)">
            </td>
            <td class="text-xs">${idx + 1}</td>
            <td class="text-xs">
                <div class="fw-semibold">${formatThaiDateShort(r.payDate)}</div>
                <div class="text-muted">${r.payTime} น.</div>
            </td>
            <td class="text-xs font-monospace">
                <div><span class="text-muted">Ref1:</span> <span class="fw-semibold">${r.ref1 || '-'}</span></div>
                <div><span class="text-muted">Ref2:</span> <span>${r.ref2 || '-'}</span></div>
            </td>
            <td>${custDisplay}</td>
            <td>
                <div>${monthsBadges}</div>
                <div class="text-xs text-muted">${r.note || ''}</div>
            </td>
            <td class="text-end fw-bold text-success">฿${formatMoneyDecimal(r.amount)}</td>
            <td class="text-center">${badgeHTML}</td>
            <td class="text-center">
                <button class="btn btn-xs btn-outline-primary" onclick="promptManualMatchKtbRow(${idx})" title="เปลี่ยน/ระบุบ้านลูกค้าด้วยตนเอง">
                    <i class="fa-solid fa-magnifying-glass"></i> เลือกบ้าน
                </button>
            </td>
        </tr>`;
    }).join('');
}

function toggleKtbRowSelection(idx, checked) {
    if (ktbImportedRows[idx]) {
        ktbImportedRows[idx].selected = checked;
        renderKtbPreviewTable();
    }
}

function toggleAllKtbRows(checked) {
    ktbImportedRows.forEach(r => {
        if (r.customer && r.monthsToCut.length > 0 && r.status !== 'DUPLICATE') {
            r.selected = checked;
        }
    });
    renderKtbPreviewTable();
}

/**
 * กรณีระบบหา Ref1/Ref2 ไม่เจอ หรือต้องการเปลี่ยนบ้านที่ตัดยอดด้วยตนเอง
 */
async function promptManualMatchKtbRow(idx) {
    const row = ktbImportedRows[idx];
    if (!row) return;

    const { value: searchVal } = await Swal.fire({
        title: 'ค้นหาลูกค้าเพื่อจับคู่รายการ',
        html: `<div class="text-sm text-muted mb-2">รายการแถวที่ ${idx + 1}: ยอดชำระ <b>฿${formatMoneyDecimal(row.amount)}</b> (Ref1: ${row.ref1 || '-'})</div>`,
        input: 'text',
        inputPlaceholder: 'กรอกรหัสลูกค้า (เช่น 9900001), บ้านเลขที่ หรือ ชื่อเจ้าบ้าน...',
        showCancelButton: true,
        confirmButtonText: 'ค้นหา',
        cancelButtonText: 'ยกเลิก'
    });

    if (!searchVal) return;
    const q = searchVal.trim().toLowerCase();
    const customers = getWasteCustomers();
    const matches = customers.filter(c =>
        String(c.id).toLowerCase().includes(q) ||
        String(c.house_no).toLowerCase().includes(q) ||
        (c.name && c.name.toLowerCase().includes(q))
    ).slice(0, 20);

    if (matches.length === 0) {
        Swal.fire('ไม่พบลูกค้า', `ไม่พบข้อมูลลูกค้าที่ตรงกับ "${searchVal}"`, 'warning');
        return;
    }

    const inputOptions = {};
    matches.forEach(c => {
        inputOptions[c.id] = `[${c.id}] บ้านเลขที่ ${c.house_no} ม.${c.moo} - ${c.name} (฿${c.fee}/เดือน)`;
    });

    const { value: selectedCid } = await Swal.fire({
        title: 'เลือกลูกค้าที่ต้องการตัดยอด',
        input: 'select',
        inputOptions,
        inputPlaceholder: '-- เลือกลูกค้า --',
        showCancelButton: true,
        confirmButtonText: 'ผูกข้อมูลและคำนวณเดือน',
        cancelButtonText: 'ยกเลิก'
    });

    if (selectedCid) {
        const cust = customers.find(c => c.id === selectedCid);
        if (cust) {
            const fy = document.getElementById('ktbImportFiscalYear')?.value || getCurrentFiscalYear();
            const prefMonth = document.getElementById('ktbImportMonthMode')?.value || 'auto';
            const cutOff = calculateAutoCutOffMonths(cust, row.amount, fy, prefMonth);
            row.customer = cust;
            row.matchType = 'เลือกด้วยตนเอง';
            row.monthsToCut = cutOff.monthsToCut;
            row.status = cutOff.status;
            row.note = cutOff.note;
            row.selected = row.monthsToCut.length > 0;
            renderKtbPreviewTable();
        }
    }
}

/**
 * ดำเนินการบันทึกใบเสร็จรับเงิน + ตัดยอด กค.3 อัตโนมัติ (ทั้งใน Supabase และ LocalStorage)
 */
async function executeKtbAutoCutoffImport() {
    const selectedRows = ktbImportedRows.filter(r => r.selected && r.customer && r.monthsToCut.length > 0);
    if (selectedRows.length === 0) {
        Swal.fire('ไม่มีรายการที่เลือก', 'กรุณาเลือกรายการที่ต้องการนำเข้าและตัดยอดอย่างน้อย 1 รายการ', 'warning');
        return;
    }

    const totalAmt = selectedRows.reduce((s, r) => s + r.amount, 0);
    const staffInput = document.getElementById('ktbImportStaff')?.value || 'นำเข้าอัตโนมัติ (KTB Corporate)';
    const methodLabel = document.getElementById('ktbImportMethod')?.value || 'โอน/KTB Corporate';

    const confirmRes = await Swal.fire({
        title: 'ยืนยันการนำเข้าและตัดยอดอัตโนมัติ?',
        html: `
            <div class="text-start bg-light p-3 rounded border text-sm">
                <div><b>ไฟล์:</b> ${ktbRawFileName || '-'}</div>
                <div><b>จำนวนรายการที่จะตัดยอด:</b> <span class="text-success fw-bold">${selectedRows.length} รายการ</span></div>
                <div><b>ยอดรายรับรวมทั้งสิ้น:</b> <span class="text-primary fw-bold">฿${formatMoneyDecimal(totalAmt)}</span></div>
                <div><b>ช่องทางชำระ:</b> ${methodLabel}</div>
                <div><b>ผู้ทำรายการ:</b> ${staffInput}</div>
            </div>
            <div class="text-xs text-muted mt-2">ระบบจะออกเลขที่ใบเสร็จ บันทึกรายงานรายรับประจำวัน และปรับสถานะเดือนที่ค้างชำระใน กค.3 และใบแจ้งหนี้ให้เป็น <b class="text-success">"ชำระแล้ว"</b> โดยอัตโนมัติ</div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#057a55',
        confirmButtonText: '<i class="fa-solid fa-check-circle me-1"></i>ยืนยันตัดยอดทันที',
        cancelButtonText: 'ยกเลิก'
    });

    if (!confirmRes.isConfirmed) return;

    Swal.fire({
        title: 'กำลังนำเข้าและตัดยอดอัตโนมัติ...',
        html: `<div id="ktbImportProgressText">กำลังประมวลผล 0 / ${selectedRows.length} รายการ</div>`,
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < selectedRows.length; i++) {
        const row = selectedRows[i];
        const progEl = document.getElementById('ktbImportProgressText');
        if (progEl) {
            progEl.textContent = `กำลังตัดยอด ${i + 1} / ${selectedRows.length} รายการ (${row.customer.name})...`;
        }

        try {
            const c = row.customer;
            const receiptNo = typeof generateReceiptNumberAsync === 'function'
                ? await generateReceiptNumberAsync()
                : generateReceiptNumber();

            const selectedLabels = row.monthsToCut.map(m => m.label);
            const primaryYear = row.monthsToCut[0]?.year || getCurrentFiscalYear();

            const payment = {
                id: 'PAY' + Date.now().toString().slice(-6) + String(i).padStart(2, '0'),
                receipt_no: receiptNo,
                customer_id: c.id,
                customer_name: c.name,
                house_no: `${c.house_no} ม.${c.moo}`,
                amount: row.amount,
                months_paid: selectedLabels,
                fiscal_year: primaryYear,
                method: methodLabel,
                date: row.payDate,
                time: row.payTime || '09:00',
                status: 'completed',
                staff: staffInput,
                source: 'ktb-corporate'
            };

            await saveWastePaymentDB(payment);

            // ตัดยอดสถานะรายเดือนใน กค.3 (waste_monthly_status)
            for (const m of row.monthsToCut) {
                await saveMonthlyStatusDB(c.id, m.year, m.key, 'paid', payment.id);
            }

            row.status = 'DUPLICATE';
            row.selected = false;
            row.note = `ตัดยอดสำเร็จ (${receiptNo})`;
            successCount++;
        } catch (err) {
            console.error('KTB Import row error:', err);
            failCount++;
        }
    }

    // บันทึกประวัติการนำเข้า KTB Corporate
    const history = getKtbImportHistory();
    history.unshift({
        id: 'KTB-' + Date.now(),
        timestamp: new Date().toISOString(),
        fileName: ktbRawFileName || 'KTB_Report.xlsx',
        totalRows: selectedRows.length,
        successCount,
        failCount,
        totalAmount: totalAmt,
        staff: staffInput
    });
    saveKtbImportHistory(history);

    // โหลดข้อมูลใหม่และอัปเดตหน้ารายงานรายรับทันที
    await Promise.all([
        fetchWastePayments(),
        fetchMonthlyStatus()
    ]);

    if (typeof renderReports === 'function') {
        // ตั้งค่าวันที่ในแท็บ "รายวัน" ให้ตรงกับวันที่ในไฟล์ เพื่อให้เห็นยอดรายวันทันที
        if (selectedRows[0]?.payDate && document.getElementById('filterDate')) {
            document.getElementById('filterDate').value = selectedRows[0].payDate;
        }
        renderReports();
    }

    renderKtbPreviewTable();
    renderKtbHistoryTable();

    Swal.fire({
        title: 'นำเข้าและตัดยอดอัตโนมัติสำเร็จ!',
        html: `
            <div class="text-start bg-light p-3 rounded border text-sm">
                <div class="text-success fw-bold mb-1"><i class="fa-solid fa-circle-check me-1"></i>ตัดยอดสำเร็จ: ${successCount} รายการ</div>
                ${failCount > 0 ? `<div class="text-danger fw-bold mb-1">ล้มเหลว: ${failCount} รายการ</div>` : ''}
                <div><b>ยอดรวมรายรับที่นำเข้า:</b> ฿${formatMoneyDecimal(totalAmt)}</div>
            </div>
        `,
        icon: 'success',
        confirmButtonText: 'ตกลง'
    });
}

/**
 * แสดงประวัติการนำเข้าไฟล์ KTB Corporate
 */
function renderKtbHistoryTable() {
    const tbody = document.getElementById('ktbHistoryTableBody');
    if (!tbody) return;
    const history = getKtbImportHistory();
    if (history.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-3 text-muted text-xs">ยังไม่มีประวัติการนำเข้าไฟล์ KTB Corporate</td></tr>`;
        return;
    }

    tbody.innerHTML = history.slice(0, 10).map(h => {
        const d = new Date(h.timestamp);
        const dtStr = `${d.toLocaleDateString('th-TH')} ${d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`;
        return `<tr>
            <td class="text-xs ps-3">${dtStr}</td>
            <td class="text-xs fw-semibold"><i class="fa-solid fa-file-excel text-success me-1"></i>${h.fileName}</td>
            <td class="text-xs text-center"><span class="badge bg-success">${h.successCount} รายการ</span></td>
            <td class="text-xs text-end fw-bold text-primary">฿${formatMoneyDecimal(h.totalAmount)}</td>
            <td class="text-xs">${h.staff || '-'}</td>
            <td class="text-xs text-center pe-3"><span class="text-success"><i class="fa-solid fa-check-double me-1"></i>ตัดยอดแล้ว</span></td>
        </tr>`;
    }).join('');
}

/**
 * ดาวน์โหลดไฟล์ตัวอย่าง Excel รูปแบบ KTB Corporate Online (Bill Payment Report)
 * โดยดึงข้อมูลลูกค้ารายจริงจากระบบมาสร้างเป็นตัวอย่างเพื่อให้ทดสอบนำเข้าและตัดยอดได้ทันที
 */
function downloadKtbSampleTemplate() {
    const customers = (typeof getWasteCustomers === 'function' ? getWasteCustomers() : []).filter(c => c.status === 'active');
    const sampleCustomers = customers.slice(0, 5);
    const todayStr = new Date().toISOString().split('T')[0];
    const parts = todayStr.split('-');
    const thaiDateSlash = `${parts[2]}/${parts[1]}/${parseInt(parts[0], 10) + 543}`;
    const yyyymmdd = parts.join('');

    const rows = [
        ['รายงานการรับชำระค่าธรรมเนียมขยะมูลฝอยผ่านธนาคารกรุงไทย (KTB Corporate Online - Bill Payment)'],
        ['หน่วยงาน: เทศบาลเมืองบ้านเป็ด', '', 'วันที่ออกรายงาน:', thaiDateSlash],
        [],
        ['ลำดับ (No.)', 'วันที่ชำระ (Payment Date)', 'เวลา (Time)', 'Ref1 (รหัสลูกค้า 18 หลัก)', 'Ref2 (เลขอ้างอิง/ใบแจ้งหนี้)', 'ชื่อผู้ชำระ (Customer Name)', 'ช่องทาง (Channel)', 'จำนวนเงิน (Amount)']
    ];

    if (sampleCustomers.length > 0) {
        sampleCustomers.forEach((c, idx) => {
            const ref1 = String(c.id).padStart(18, '0');
            const cidTail = String(c.id).replace(/\D/g, '').slice(-6).padStart(6, '0');
            const ref2 = `${yyyymmdd}093${idx}${cidTail}`;
            const fee = Number(c.fee) || 40;
            rows.push([
                idx + 1,
                thaiDateSlash,
                `09:3${idx}`,
                ref1,
                ref2,
                c.name || '',
                'KTB NEXT / QR Cross-Bank',
                fee
            ]);
        });
    } else {
        rows.push([1, thaiDateSlash, '09:30', '000000000009900001', `${yyyymmdd}0930900001`, 'ตัวอย่าง ลูกค้า', 'KTB NEXT', 40]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
        { wch: 12 },
        { wch: 22 },
        { wch: 14 },
        { wch: 26 },
        { wch: 26 },
        { wch: 28 },
        { wch: 24 },
        { wch: 18 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'KTB_BillPayment');
    XLSX.writeFile(wb, `ตัวอย่างไฟล์_KTB_Corporate_${todayStr}.xlsx`);
}

/**
 * เปิด Modal หรือสลับไปที่แท็บนำเข้า KTB Corporate
 */
function openKtbImportTab() {
    const tabLink = document.getElementById('tabKtbImportLink');
    if (tabLink) {
        const tab = new bootstrap.Tab(tabLink);
        tab.show();
    }
    initKtbImportUI();
}

function initKtbImportUI() {
    const defDateEl = document.getElementById('ktbDefaultDate');
    if (defDateEl && !defDateEl.value) {
        defDateEl.value = new Date().toISOString().split('T')[0];
    }

    const staffEl = document.getElementById('ktbImportStaff');
    if (staffEl && !staffEl.value) {
        const user = typeof getSessionUser === 'function' ? getSessionUser() : null;
        staffEl.value = (user && user.name) ? user.name : 'เจ้าหน้าที่การเงิน (KTB Corporate)';
    }

    const fyEl = document.getElementById('ktbImportFiscalYear');
    if (fyEl && fyEl.options.length === 0) {
        const cy = typeof getCurrentFiscalYear === 'function' ? getCurrentFiscalYear() : '2569';
        const cyNum = parseInt(cy, 10);
        [cyNum - 1, cyNum, cyNum + 1].forEach(y => {
            const opt = document.createElement('option');
            opt.value = String(y);
            opt.textContent = `ปีงบประมาณ ${y}`;
            if (String(y) === String(cy)) opt.selected = true;
            fyEl.appendChild(opt);
        });
    }

    renderKtbHistoryTable();
}
