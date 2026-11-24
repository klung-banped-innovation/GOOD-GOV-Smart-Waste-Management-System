/**
 * waste-invoice.js — ระบบออกใบแจ้งหนี้ค่าธรรมเนียมขยะมูลฝอย
 * รองรับการกรองรายหมู่ กรองเดือน แก้ไขข้อมูลลูกค้า ออกใบแจ้งหนี้รายบุคคล และออกรายงานตามตัวกรอง
 * ดึง Barcode และ QR Code (Comcode / Cross-Bank Bill Payment) เหมือนระบบหน้าบ้านประชาชนชำระค่าขยะ
 */

const INV_MONTH_SHORT = ['ต.ค.', 'พ.ย.', 'ธ.ค.', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.'];
const INV_MONTH_FULL  = ['ตุลาคม', 'พฤศจิกายน', 'ธันวาคม', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน'];
const INV_MONTH_KEYS  = ['oct', 'nov', 'dec', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep'];
const THAI_CAL_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

// เก็บข้อมูลที่กรอกเพิ่มเติมรายบุคคลในหน้าใบแจ้งหนี้ (เช่น ปริมาณมูลฝอย หรือค่ากำจัดมูลฝอย)
let customInvoiceOverrides = {};
try {
    customInvoiceOverrides = JSON.parse(localStorage.getItem('waste_invoice_overrides') || '{}');
} catch (e) {
    customInvoiceOverrides = {};
}

function saveInvoiceOverride(customerId, field, value) {
    if (!customInvoiceOverrides[customerId]) customInvoiceOverrides[customerId] = {};
    customInvoiceOverrides[customerId][field] = value;
    try {
        localStorage.setItem('waste_invoice_overrides', JSON.stringify(customInvoiceOverrides));
    } catch (e) {}
}

function getInvoiceOverride(customerId, field, defaultVal = '') {
    if (customInvoiceOverrides[customerId] && customInvoiceOverrides[customerId][field] !== undefined && customInvoiceOverrides[customerId][field] !== '') {
        return customInvoiceOverrides[customerId][field];
    }
    return defaultVal;
}

/**
 * แปลงตัวเลขเป็นคำอ่านภาษาไทย (บาทถ้วน / สตางค์)
 */
function numberToThaiBahtText(amount) {
    amount = parseFloat(amount) || 0;
    if (amount === 0) return 'ศูนย์บาทถ้วน';

    const numText = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
    const unitText = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

    function convertInteger(numStr) {
        let result = '';
        const len = numStr.length;
        for (let i = 0; i < len; i++) {
            const digit = parseInt(numStr.charAt(i), 10);
            const pos = len - i - 1;
            const unitPos = pos % 6;

            if (digit !== 0) {
                if (unitPos === 0 && digit === 1 && len > 1 && i > 0 && numStr.charAt(i - 1) !== '0') {
                    result += 'เอ็ด';
                } else if (unitPos === 1 && digit === 2) {
                    result += 'ยี่';
                } else if (unitPos === 1 && digit === 1) {
                    result += '';
                } else {
                    result += numText[digit];
                }
                result += unitText[unitPos];
            }
            if (pos > 0 && unitPos === 0) {
                result += 'ล้าน';
            }
        }
        return result;
    }

    const parts = amount.toFixed(2).split('.');
    const bahtPart = parseInt(parts[0], 10);
    const satangPart = parseInt(parts[1], 10);

    let text = '';
    if (bahtPart > 0) {
        text += convertInteger(String(bahtPart)) + 'บาท';
    }
    if (satangPart > 0) {
        text += convertInteger(String(satangPart)) + 'สตางค์';
    } else {
        text += 'ถ้วน';
    }
    return text;
}

/**
 * แปลงวันที่ YYYY-MM-DD เป็นรูปแบบไทย เช่น 24 สิงหาคม 2564
 */
function formatThaiFullDate(dateStr) {
    if (!dateStr) {
        const now = new Date();
        return `${now.getDate()} ${THAI_CAL_MONTHS[now.getMonth()]} ${now.getFullYear() + 543}`;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getDate()} ${THAI_CAL_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

/**
 * คำนวณข้อมูลใบแจ้งหนี้ของลูกค้ารายบุคคล รองรับทั้งปีเดียวและหลายปีงบประมาณ (ย้อนหลัง / ปัจจุบัน / ล่วงหน้า)
 * รวมถึงการเลือกช่วงเดือนและช่วงปี
 */
function calculateCustomerInvoiceData(customer, fiscalYearOrOpts, targetMonthKey = 'oct', calcMode = 'single') {
    const ms = typeof getMonthlyStatus === 'function' ? getMonthlyStatus() : {};
    const customerAllStatus = ms[customer.id] || {};

    let startFY, endFY, startMonthKey, endMonthKey, mode;

    if (typeof fiscalYearOrOpts === 'object' && fiscalYearOrOpts !== null) {
        startFY = parseInt(fiscalYearOrOpts.startFiscalYear || fiscalYearOrOpts.fiscalYear || 2568, 10);
        endFY = parseInt(fiscalYearOrOpts.endFiscalYear || fiscalYearOrOpts.fiscalYear || startFY, 10);
        if (startFY > endFY) {
            const tmp = startFY;
            startFY = endFY;
            endFY = tmp;
        }
        startMonthKey = fiscalYearOrOpts.startMonthKey || fiscalYearOrOpts.monthKey || 'oct';
        endMonthKey = fiscalYearOrOpts.endMonthKey || fiscalYearOrOpts.monthKey || startMonthKey;
        mode = fiscalYearOrOpts.calcMode || 'range';
    } else {
        startFY = parseInt(fiscalYearOrOpts, 10) || 2568;
        endFY = startFY;
        startMonthKey = targetMonthKey || 'oct';
        endMonthKey = targetMonthKey || 'oct';
        mode = calcMode || 'single';
    }

    const startMIdx = Math.max(0, INV_MONTH_KEYS.indexOf(startMonthKey));
    const endMIdx = Math.max(0, INV_MONTH_KEYS.indexOf(endMonthKey));

    // กำหนดช่วงเริ่มต้นและสิ้นสุดของการคิดยอดตามโหมด
    let effStartFY = startFY;
    let effEndFY = endFY;
    let effStartMIdx = startMIdx;
    let effEndMIdx = endMIdx;

    if (mode === 'single') {
        effStartFY = endFY;
        effEndFY = endFY;
        effStartMIdx = endMIdx;
        effEndMIdx = endMIdx;
    } else if (mode === 'cumulative') {
        effStartFY = startFY;
        effEndFY = endFY;
        effStartMIdx = 0; // ตั้งแต่ ต.ค. ของปีเริ่มต้น
        effEndMIdx = endMIdx; // ถึงเดือนที่เลือกของปีสิ้นสุด
    } else if (mode === 'all_year') {
        effStartFY = startFY;
        effEndFY = endFY;
        effStartMIdx = 0;  // ต.ค. ของปีเริ่มต้น
        effEndMIdx = 11;   // ก.ย. ของปีสิ้นสุด
    } else if (mode === 'range') {
        effStartFY = startFY;
        effEndFY = endFY;
        effStartMIdx = startMIdx;
        effEndMIdx = endMIdx;
        if (effStartFY === effEndFY && effStartMIdx > effEndMIdx) {
            effEndMIdx = effStartMIdx;
        }
    }

    const yearsList = [];
    for (let y = effStartFY; y <= effEndFY; y++) {
        yearsList.push(String(y));
    }

    const yearlyBreakdown = {};
    let totalBillAmount = 0;
    const unpaidMonthsList = [];

    yearsList.forEach(yrStr => {
        const yNum = parseInt(yrStr, 10);
        const customerYearStatus = customerAllStatus[yrStr] || {};
        const monthlyUnpaidAmounts = {};
        const monthlyStatuses = {};
        let yearUnpaidAmount = 0;
        const yearUnpaidMonths = [];

        INV_MONTH_KEYS.forEach((mk, idx) => {
            const status = customerYearStatus[mk] || 'unpaid';
            monthlyStatuses[mk] = status;
            const fee = typeof getFeeForMonth === 'function' ? Number(getFeeForMonth(customer.id, mk, yrStr)) : Number(customer.fee || 0);
            const isUnpaid = (status !== 'paid' && status !== 'exempted');

            // ตรวจสอบว่าเดือนนี้อยู่ในช่วงที่เลือกหรือไม่
            let inSelectedWindow = true;
            if (yNum === effStartFY && idx < effStartMIdx) inSelectedWindow = false;
            if (yNum === effEndFY && idx > effEndMIdx) inSelectedWindow = false;

            if (status === 'paid') {
                monthlyUnpaidAmounts[mk] = 'paid';
            } else if (isUnpaid && fee > 0 && inSelectedWindow) {
                monthlyUnpaidAmounts[mk] = fee;
                yearUnpaidAmount += fee;
                totalBillAmount += fee;
                const calYrShort = String(idx < 3 ? (yNum - 1) : yNum).slice(-2);
                const labelWithYr = yearsList.length > 1 ? `${INV_MONTH_SHORT[idx]}${calYrShort}` : INV_MONTH_SHORT[idx];
                unpaidMonthsList.push(labelWithYr);
                yearUnpaidMonths.push(INV_MONTH_SHORT[idx]);
            } else {
                monthlyUnpaidAmounts[mk] = null;
            }
        });

        yearlyBreakdown[yrStr] = {
            fiscalYear: yrStr,
            monthlyUnpaidAmounts,
            monthlyStatuses,
            yearUnpaidAmount,
            yearUnpaidMonths
        };
    });

    // ค่ากำจัดมูลฝอย (ถ้ามีการกรอกแยก)
    const disposalFee = parseFloat(getInvoiceOverride(customer.id, 'disposal_fee', 0)) || 0;
    const totalAmount = totalBillAmount + disposalFee;

    // สร้างข้อความแสดงงวดเดือน/ปี บนใบแจ้งหนี้
    const getCalYear = (fy, mIdx) => (mIdx < 3 ? (fy - 1) : fy);
    let monthFullLabel = '';
    if (effStartFY === effEndFY && effStartMIdx === effEndMIdx) {
        const calY = getCalYear(effEndFY, effEndMIdx);
        monthFullLabel = `${INV_MONTH_FULL[effEndMIdx]} ${calY}`;
    } else if (effStartFY === effEndFY && effStartMIdx === 0 && effEndMIdx === 11) {
        monthFullLabel = `ตุลาคม ${effStartFY - 1} - กันยายน ${effEndFY} (ปีงบฯ ${effEndFY})`;
    } else {
        const startCalY = getCalYear(effStartFY, effStartMIdx);
        const endCalY = getCalYear(effEndFY, effEndMIdx);
        monthFullLabel = `${INV_MONTH_FULL[effStartMIdx]} ${startCalY} - ${INV_MONTH_FULL[effEndMIdx]} ${endCalY}`;
    }

    const fiscalYearLabel = effStartFY === effEndFY ? String(effEndFY) : `${effStartFY} - ${effEndFY}`;

    // เลขที่ใบแจ้งหนี้ (อ้างอิงปีสิ้นสุดและเดือนสิ้นสุด)
    const fyShort = String(effEndFY).slice(-2);
    const calMonthNum = effEndMIdx < 3 ? (effEndMIdx + 10) : (effEndMIdx - 2);
    const mmStr = String(calMonthNum).padStart(2, '0');
    const cidClean = String(customer.id).replace(/\D/g, '');
    const invoiceNo = `${fyShort}${mmStr}${cidClean.slice(-6).padStart(6, '0')}`;

    // สำหรับความเข้ากันได้กับโค้ดเดิมที่อ่านปีเดียว
    const primaryYearData = yearlyBreakdown[String(effEndFY)] || {
        monthlyUnpaidAmounts: {},
        monthlyStatuses: {}
    };

    return {
        customer,
        fiscalYear: String(effEndFY),
        startFiscalYear: String(effStartFY),
        endFiscalYear: String(effEndFY),
        fiscalYearLabel,
        yearsList,
        yearlyBreakdown,
        targetMonthKey: INV_MONTH_KEYS[effEndMIdx],
        targetIdx: effEndMIdx,
        startMonthIdx: effStartMIdx,
        endMonthIdx: effEndMIdx,
        monthFullLabel,
        invoiceNo,
        collectionFee: totalBillAmount,
        disposalFee: disposalFee,
        totalAmount: totalAmount,
        monthlyUnpaidAmounts: primaryYearData.monthlyUnpaidAmounts,
        monthlyStatuses: primaryYearData.monthlyStatuses,
        unpaidMonthsList,
        isTargetMonthPaid: unpaidMonthsList.length === 0
    };
}

/**
 * สร้างข้อมูล Barcode และ QR Code มาตรฐาน Bill Payment (Comcode) เหมือนหน้าบ้านประชาชนชำระค่าขยะ
 */
function buildComcodeBarcodeData(customer, totalAmount, settings, invoiceNo) {
    const taxId = settings.tax_id || settings.company_code || '0994000160381';
    const suffix = settings.branch_suffix || '00';

    // Ref1: รหัสลูกค้า 18 หลัก (เหมือนหน้าบ้าน citizen-waste.js)
    const ref1 = String(customer.id).padStart(18, '0');

    // Ref2: วันที่เวลา + เลขลำดับ (เหมือนหน้าบ้าน citizen-waste.js)
    const now = new Date();
    const yyyy = String(now.getFullYear()).padStart(4, '0');
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const HHmm = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
    const cidTail = String(customer.id).replace(/\D/g, '').slice(-6).padStart(6, '0');
    const ref2 = yyyy + MM + dd + HHmm + cidTail;

    const amountSatang = Math.round((parseFloat(totalAmount) || 0) * 100).toString();

    // รูปแบบมาตรฐานบาร์โค้ดข้ามธนาคาร (Cross-Bank Bill Payment)
    const barcodeData = `|${taxId}${suffix}\r${ref1}\r${ref2}\r${amountSatang}`;
    const barcodeTextDisplay = `|${taxId}${suffix} ${ref1} ${ref2} ${amountSatang}`;

    let qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(barcodeData)}`;
    if (typeof qrcode === 'function') {
        try {
            const qr = qrcode(0, 'M');
            qr.addData(barcodeData);
            qr.make();
            qrUrl = qr.createDataURL(4, 2);
        } catch (e) {
            console.warn('QR generator fallback:', e);
        }
    }

    return {
        taxId,
        suffix,
        ref1,
        ref2,
        amountSatang,
        barcodeData,
        barcodeTextDisplay,
        qrUrl
    };
}

/**
 * สร้าง CSS สำหรับหน้าพิมพ์ใบแจ้งหนี้ (ตามแบบภาพตัวอย่าง)
 */
function buildInvoicePrintCSS(perPage = 1) {
    const isTwoPerPage = Number(perPage) === 2;
    return `
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap');
        @page { size: A4 portrait; margin: 8mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Sarabun', 'TH Sarabun New', sans-serif;
            color: #111;
            background: #e5e7eb;
            font-size: 11pt;
            line-height: 1.35;
        }
        .print-toolbar {
            position: sticky;
            top: 0;
            z-index: 999;
            background: #1e293b;
            color: #fff;
            padding: 12px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        }
        .print-toolbar .btn-action {
            border: none;
            padding: 8px 18px;
            border-radius: 6px;
            font-family: 'Sarabun', sans-serif;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            margin-left: 8px;
        }
        .print-toolbar .btn-print { background: #10b981; color: #fff; }
        .print-toolbar .btn-close-win { background: #ef4444; color: #fff; }

        .a4-sheet {
            width: 210mm;
            min-height: ${isTwoPerPage ? '280mm' : 'auto'};
            background: #fff;
            margin: 12px auto;
            padding: ${isTwoPerPage ? '8mm 12mm' : '14mm 15mm'};
            box-shadow: 0 4px 16px rgba(0,0,0,0.12);
            page-break-after: always;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }
        .invoice-box {
            width: 100%;
            background: #fff;
            padding: ${isTwoPerPage ? '4mm 0' : '2mm 0'};
            ${isTwoPerPage ? 'border-bottom: 1px dashed #9ca3af; margin-bottom: 6mm; padding-bottom: 6mm;' : ''}
        }
        .invoice-box:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
        }

        /* Header */
        .inv-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        .inv-brand {
            display: flex;
            align-items: center;
            gap: 16px;
        }
        .inv-logo {
            width: 64px;
            height: 64px;
            object-fit: contain;
            border-radius: 50%;
        }
        .inv-title {
            font-size: 24pt;
            font-weight: 700;
            color: #111;
            letter-spacing: 0.5px;
        }
        .inv-doc-meta {
            text-align: left;
            min-width: 220px;
            font-size: 11pt;
        }
        .inv-doc-meta .meta-row {
            display: flex;
            margin-bottom: 4px;
        }
        .inv-doc-meta .meta-label {
            font-weight: 700;
            color: #2e5a1c;
            width: 55px;
        }
        .inv-doc-meta .meta-val {
            font-weight: 500;
            color: #111;
        }

        /* Green Organization Bar */
        .inv-org-bar {
            background-color: #e2efda;
            padding: 6px 10px;
            margin-bottom: 8px;
            border-radius: 2px;
        }
        .inv-org-row {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 2px;
        }
        .inv-org-row:last-child {
            margin-bottom: 0;
        }
        .inv-label-green {
            font-weight: 700;
            color: #2e5a1c;
        }

        /* Customer Info */
        .inv-cust-section {
            padding: 2px 10px 6px 10px;
            margin-bottom: 6px;
        }
        .inv-cust-row {
            display: flex;
            align-items: baseline;
            margin-bottom: 4px;
        }

        /* Fee Summary Line */
        .inv-fee-summary {
            padding: 0 10px;
            margin-bottom: 6px;
        }
        .inv-fee-row {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 3px;
        }

        /* Full-width Horizontal Tables Area */
        .inv-full-section {
            width: 100%;
            margin-bottom: 8px;
        }

        .inv-table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #000;
            font-size: 10pt;
        }
        .inv-table th {
            background-color: #e2efda;
            color: #1f3d12;
            font-weight: 700;
            text-align: center;
            padding: 4px 6px;
            border: 1px solid #000;
        }
        .inv-table td {
            padding: 4px 8px;
            border-left: 1px solid #000;
            border-right: 1px solid #000;
            vertical-align: middle;
        }
        .inv-detail-table tbody tr td {
            border-bottom: 1px solid #e5e7eb;
            height: 24px;
        }
        .inv-detail-table tfoot td {
            border-top: 1px solid #000;
            font-weight: 700;
            padding: 4px 8px;
        }
        .inv-detail-table tfoot td.total-label {
            background-color: #e2efda;
            color: #2e5a1c;
            text-align: right;
        }
        .inv-detail-table tfoot td.total-val {
            text-align: right;
            background-color: #fff;
        }

        .inv-history-header {
            background-color: #e2efda;
            color: #1f3d12;
            font-weight: 700;
            text-align: left;
            padding: 4px 10px;
            margin-bottom: 4px;
            font-size: 10.5pt;
            border-radius: 2px;
        }
        .inv-history-wide-table th,
        .inv-history-wide-table td {
            border: 1px solid #000;
            padding: 3px 4px;
            text-align: center;
            font-size: 9.5pt;
            height: 22px;
        }
        .inv-history-wide-table td.yr-cell {
            font-weight: 700;
            background-color: #f8fafc;
            width: 11%;
        }
        .inv-history-wide-table td.m-amt-cell {
            text-align: right;
            width: 6.4%;
        }
        .inv-history-wide-table td.yr-total-cell {
            text-align: right;
            font-weight: 700;
            width: 12%;
            background-color: #fcfdfd;
        }
        .inv-history-wide-table tfoot td {
            border-top: 1.5px solid #000;
            font-weight: 700;
            padding: 4px 6px;
            background-color: #e2efda;
            color: #1f3d12;
        }

        /* Baht Text & Footer Meta */
        .inv-baht-text-row {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-top: 6px;
            margin-bottom: 6px;
            padding-left: 4px;
        }
        .inv-baht-pill {
            background-color: #e2efda;
            padding: 2px 18px;
            font-weight: 700;
            color: #1f3d12;
            min-width: 240px;
            text-align: center;
        }

        .inv-under-tables {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 6px;
            margin-bottom: 8px;
            padding: 0 4px;
        }
        .inv-due-info div {
            margin-bottom: 3px;
        }
        .inv-staff-sign {
            min-width: 220px;
            text-align: center;
            padding-top: 2px;
        }
        .inv-staff-name {
            font-weight: 700;
            font-size: 11pt;
        }
        .inv-staff-role {
            color: #333;
            font-size: 10.5pt;
        }

        /* Barcode & QR Section */
        .inv-barcode-qr-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            gap: 12px;
            margin-top: 4px;
            padding-top: 4px;
        }
        .inv-barcode-area {
            flex: 1;
            text-align: center;
        }
        .inv-barcode-svg {
            width: 100%;
            max-width: 490px;
            height: 62px;
        }
        .inv-barcode-text {
            font-family: 'Sarabun', monospace;
            font-size: 10pt;
            font-weight: 600;
            letter-spacing: 0.3px;
            margin-top: 2px;
            color: #111;
        }
        .inv-qr-area {
            width: 175px;
            text-align: center;
            flex-shrink: 0;
        }
        .inv-qr-img {
            width: 92px;
            height: 92px;
            object-fit: contain;
            border: 1px solid #e5e7eb;
            padding: 2px;
            background: #fff;
        }
        .inv-qr-caption {
            font-size: 8.5pt;
            font-weight: 600;
            color: #111;
            margin-top: 2px;
            white-space: nowrap;
        }

        @media print {
            body { background: #fff; }
            .no-print, .print-toolbar { display: none !important; }
            .a4-sheet {
                margin: 0;
                box-shadow: none;
                width: 100%;
                padding: ${isTwoPerPage ? '4mm 6mm' : '8mm 10mm'};
            }
        }
    `;
}

/**
 * สร้าง HTML ของใบแจ้งหนี้ 1 ใบ (ตารางรายละเอียดแนวนอนเต็มความกว้าง และตารางประวัติการค้างชำระแนวนอนด้านล่าง)
 */
function buildSingleInvoiceHTML(invData, options = {}) {
    const settings = JSON.parse(localStorage.getItem('waste_settings') || '{}');
    const c = invData.customer;

    const orgName = settings.org_name || 'เทศบาลเมืองบ้านเป็ด';
    const orgPhone = settings.org_phone || '043-423869';
    const baseHref = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
    const defaultGarudaUrl = baseHref + 'assets/img/garuda.png';
    let logoUrl = settings.org_logo || defaultGarudaUrl;
    if (logoUrl && !logoUrl.startsWith('http') && !logoUrl.startsWith('data:')) {
        logoUrl = baseHref + logoUrl.replace(/^\//, '');
    }

    // ที่อยู่หน่วยงาน
    let orgAddressFull = settings.org_address || '999 หมู่ 16 ถ.มลิวรรณ ต.บ้านเป็ด อ.เมืองขอนแก่น จ.ขอนแก่น 40000';
    if (settings.org_subdistrict_name && !orgAddressFull.includes(settings.org_subdistrict_name)) {
        orgAddressFull += ` ต.${settings.org_subdistrict_name}`;
    }
    if (settings.org_district_name && !orgAddressFull.includes(settings.org_district_name)) {
        orgAddressFull += ` อ.${settings.org_district_name.replace('อำเภอ', '')}`;
    }
    if (settings.org_province_name && !orgAddressFull.includes(settings.org_province_name)) {
        orgAddressFull += ` จ.${settings.org_province_name}`;
    }

    // ที่อยู่ผู้ชำระค่าธรรมเนียม
    let custSubdistrict = c.subdistrict || settings.org_subdistrict_name || 'บ้านเป็ด';
    if (orgName.includes('บ้านเป็ด') && custSubdistrict === 'เหมืองหม้อ') {
        custSubdistrict = settings.org_subdistrict_name || 'บ้านเป็ด';
    }
    const custDistrict = (settings.org_district_name || 'เมืองขอนแก่น').replace('อำเภอ', '');
    const custProvince = settings.org_province_name || 'ขอนแก่น';
    const custAddress = `${c.house_no || '-'} หมู่ที่ ${c.moo || '-'} ต.${custSubdistrict} อ.${custDistrict} จ.${custProvince}`;

    const issueDateThai = formatThaiFullDate(options.issueDate);
    const dueDateThai = formatThaiFullDate(options.dueDate);
    const staffName = options.staffName || 'เจ้าหน้าที่จัดเก็บรายได้';
    const bankName = settings.bank_name || 'ธนาคารกรุงไทย';
    const comCode = settings.company_code || settings.tax_id || '98553';

    const totalFmt = formatMoneyDecimal(invData.totalAmount);
    const collectionFmt = formatMoneyDecimal(invData.collectionFee);
    const disposalFmt = invData.disposalFee > 0 ? formatMoneyDecimal(invData.disposalFee) : '';
    const bahtText = numberToThaiBahtText(invData.totalAmount);

    const yearsList = Array.isArray(invData.yearsList) && invData.yearsList.length > 0 ? invData.yearsList : [String(invData.fiscalYear)];
    const isMultiYear = yearsList.length > 1;

    // 1. สร้างแถวตารางรายละเอียดด้านบน (แนวนอนเต็มความกว้าง)
    let detailRowsHTML = '';
    if (isMultiYear) {
        let rowSeq = 1;
        yearsList.forEach(yrStr => {
            const yrObj = invData.yearlyBreakdown && invData.yearlyBreakdown[yrStr];
            const yrAmt = yrObj ? yrObj.yearUnpaidAmount : 0;
            const yrMonthsText = (yrObj && yrObj.yearUnpaidMonths && yrObj.yearUnpaidMonths.length > 0)
                ? ` (${yrObj.yearUnpaidMonths.length} เดือน: ${yrObj.yearUnpaidMonths.join(', ')})`
                : '';
            detailRowsHTML += `
                <tr>
                    <td style="text-align: center;">${rowSeq++}</td>
                    <td>ค่าเก็บและขนมูลฝอย ปีงบประมาณ ${yrStr}${yrMonthsText}</td>
                    <td style="text-align: right;">${formatMoneyDecimal(yrAmt)}</td>
                </tr>
            `;
        });
        detailRowsHTML += `
            <tr>
                <td style="text-align: center;">${rowSeq}</td>
                <td>ค่ากำจัดมูลฝอย</td>
                <td style="text-align: right;">${disposalFmt}</td>
            </tr>
        `;
    } else {
        detailRowsHTML = `
            <tr>
                <td style="text-align: center;">1</td>
                <td>ค่าเก็บและขนมูลฝอย</td>
                <td style="text-align: right;">${collectionFmt}</td>
            </tr>
            <tr>
                <td style="text-align: center;">2</td>
                <td>ค่ากำจัดมูลฝอย</td>
                <td style="text-align: right;">${disposalFmt}</td>
            </tr>
        `;
    }

    // 2. สร้างตารางประวัติการค้างชำระแนวนอนด้านล่าง
    // หัวคอลัมน์: ปีงบประมาณ | ต.ค. | พ.ย. | ธ.ค. | ม.ค. | ก.พ. | มี.ค. | เม.ย. | พ.ค. | มิ.ย. | ก.ค. | ส.ค. | ก.ย. | รวมยอด
    let grandHistoryUnpaidTotal = 0;
    let historyWideRowsHTML = '';

    yearsList.forEach(yrStr => {
        const yrObj = (invData.yearlyBreakdown && invData.yearlyBreakdown[yrStr])
            ? invData.yearlyBreakdown[yrStr]
            : { monthlyUnpaidAmounts: invData.monthlyUnpaidAmounts || {}, yearUnpaidAmount: 0 };

        let yearRowSum = 0;
        let monthCellsHTML = '';

        INV_MONTH_KEYS.forEach(mk => {
            const val = yrObj.monthlyUnpaidAmounts[mk];
            if (typeof val === 'number' && val > 0) {
                yearRowSum += val;
                monthCellsHTML += `<td class="m-amt-cell">${formatMoney(Math.round(val))}</td>`;
            } else if (val === 'paid') {
                monthCellsHTML += `<td class="m-amt-cell" style="text-align: center; color: #16a34a; font-size: 8.5pt; font-weight: 600;">ชำระแล้ว</td>`;
            } else {
                monthCellsHTML += `<td class="m-amt-cell"></td>`;
            }
        });

        grandHistoryUnpaidTotal += yearRowSum;

        historyWideRowsHTML += `
            <tr>
                <td class="yr-cell">${yrStr}</td>
                ${monthCellsHTML}
                <td class="yr-total-cell">${formatMoney(Math.round(yearRowSum))}</td>
            </tr>
        `;
    });

    const historyHeaderTitle = isMultiYear
        ? `ประวัติการค้างชำระค่าธรรมเนียม ปีงบประมาณ ${invData.fiscalYearLabel}`
        : `ประวัติการค้างชำระค่าธรรมเนียม ปีงบประมาณ ${invData.fiscalYear}`;

    const historyWideTableHTML = `
        <div class="inv-full-section">
            <div class="inv-history-header">${historyHeaderTitle}</div>
            <table class="inv-table inv-history-wide-table">
                <thead>
                    <tr>
                        <th style="width: 11%;">ปีงบประมาณ</th>
                        ${INV_MONTH_SHORT.map(m => `<th style="width: 6.4%;">${m}</th>`).join('')}
                        <th style="width: 12%;">รวมยอด</th>
                    </tr>
                </thead>
                <tbody>
                    ${historyWideRowsHTML}
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="13" style="text-align: right; padding-right: 10px;">ยอดรวมทั้งหมด (บาท)</td>
                        <td style="text-align: right; background-color: #fff; color: #111;">${formatMoney(Math.round(grandHistoryUnpaidTotal))}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;

    // สร้างข้อมูล Barcode & QR Code
    const bcInfo = buildComcodeBarcodeData(c, invData.totalAmount, settings, invData.invoiceNo);
    const uniqueBarcodeId = `bc_${c.id}_${Math.random().toString(36).substring(2, 7)}`;

    return {
        barcodeId: uniqueBarcodeId,
        barcodeData: bcInfo.barcodeData,
        html: `
        <div class="invoice-box">
            <!-- ส่วนหัวใบแจ้งหนี้ -->
            <div class="inv-header">
                <div class="inv-brand">
                    <img src="${logoUrl}" class="inv-logo" alt="Logo" onerror="this.src='${defaultGarudaUrl}'">
                    <div class="inv-title">ใบแจ้งหนี้</div>
                </div>
                <div class="inv-doc-meta">
                    <div class="meta-row">
                        <span class="meta-label">เลขที่</span>
                        <span class="meta-val">${invData.invoiceNo}</span>
                    </div>
                    <div class="meta-row">
                        <span class="meta-label">วันที่</span>
                        <span class="meta-val">${issueDateThai}</span>
                    </div>
                </div>
            </div>

            <!-- แถบข้อมูลหน่วยงาน (สีเขียวอ่อน) -->
            <div class="inv-org-bar">
                <div class="inv-org-row">
                    <div>
                        <span class="inv-label-green" style="display:inline-block; min-width:115px;">สำนักงาน/หน่วยงาน</span>
                        <span>${orgName}</span>
                    </div>
                    <div style="min-width:220px;">
                        <span class="inv-label-green me-2">โทร</span>
                        <span>${orgPhone}</span>
                    </div>
                </div>
                <div class="inv-org-row">
                    <div>
                        <span class="inv-label-green" style="display:inline-block; min-width:115px;">ที่อยู่สำนักงาน</span>
                        <span>${orgAddressFull}</span>
                    </div>
                </div>
            </div>

            <!-- ข้อมูลผู้ชำระค่าธรรมเนียม -->
            <div class="inv-cust-section">
                <div class="inv-cust-row">
                    <span class="inv-label-green" style="display:inline-block; min-width:135px;">ชื่อผู้ชำระค่าธรรมเนียม</span>
                    <span style="font-weight: 600;">${c.name || '-'}</span>
                </div>
                <div class="inv-cust-row">
                    <span class="inv-label-green" style="display:inline-block; min-width:65px;">ที่อยู่</span>
                    <span>${custAddress}</span>
                </div>
            </div>

            <!-- สรุปเดือนที่แจ้งหนี้ -->
            <div class="inv-fee-summary">
                <div style="margin-bottom: 3px; white-space: nowrap;">
                    <span class="inv-label-green" style="margin-right: 10px;">มีค่าธรรมเนียมจัดการมูลฝอยประจำเดือน</span>
                    <span style="font-weight: 600;">${invData.monthFullLabel}</span>
                </div>
                <div style="margin-bottom: 3px;">
                    <span class="inv-label-green" style="margin-right: 12px;">เป็นจำนวนเงิน</span>
                    <span style="font-weight: 700; margin-right: 12px;">${totalFmt}</span>
                    <span class="inv-label-green">บาท</span>
                </div>
            </div>

            <!-- ตารางรายละเอียด (ขยายแนวยาวเต็มความกว้างแนวนอน) -->
            <div class="inv-full-section">
                <div class="inv-label-green mb-1" style="padding-left: 6px;">รายละเอียดดังนี้</div>
                <table class="inv-table inv-detail-table">
                    <thead>
                        <tr>
                            <th style="width: 10%;">ลำดับ</th>
                            <th style="width: 68%;">รายการ</th>
                            <th style="width: 22%;">จำนวนเงิน (บาท)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${detailRowsHTML}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="2" class="total-label">รวมทั้งสิ้น (บาท)</td>
                            <td class="total-val">${totalFmt}</td>
                        </tr>
                    </tfoot>
                </table>

                <div class="inv-baht-text-row">
                    <span class="inv-label-green">จำนวนเงินทั้งสิ้น</span>
                    <span class="inv-baht-pill">(${bahtText})</span>
                </div>
            </div>

            <!-- ตารางประวัติการค้างชำระ (แนวยาวด้านล่าง: ปีงบประมาณ | ต.ค. - ก.ย. | รวมยอด) -->
            ${historyWideTableHTML}

            <!-- ข้อมูลกำหนดชำระและผู้ทำรายการ -->
            <div class="inv-under-tables">
                <div class="inv-due-info" style="font-size: 10.5pt;">
                    <div>
                        <span class="inv-label-green me-3">กรุณาชำระค่าธรรมเนียมภายในวันที่</span>
                        <span>${dueDateThai}</span>
                    </div>
                    <div>
                        <span class="inv-label-green me-3">ชำระผ่านเคาน์เตอร์${bankName}</span>
                        <span>${comCode}</span>
                    </div>
                </div>
                <div class="inv-staff-sign">
                    <div class="inv-staff-name">${staffName}</div>
                    <div class="inv-staff-role">พนักงานผู้ทำรายการ</div>
                </div>
            </div>

            <!-- ส่วนล่าง: Barcode & QR Code ของ Comcode -->
            <div class="inv-barcode-qr-row">
                <div class="inv-barcode-area">
                    <svg id="${uniqueBarcodeId}" class="inv-barcode-svg"></svg>
                    <div class="inv-barcode-text">${bcInfo.barcodeTextDisplay}</div>
                </div>
                <div class="inv-qr-area">
                    <img id="qr_${uniqueBarcodeId}" src="${bcInfo.qrUrl}" class="inv-qr-img" alt="QR Code">
                    <div class="inv-qr-caption">QR Code ชำระค่าบริการผ่าน Mobile Banking</div>
                </div>
            </div>
        </div>
        `
    };
}

/**
 * เปิดหน้าต่างพิมพ์ใบแจ้งหนี้ (รองรับทั้งรายบุคคลและหลายรายการตามตัวกรอง)
 */
async function openInvoicePrintWindow(invoiceDataList, options = {}) {
    if (!invoiceDataList || invoiceDataList.length === 0) {
        if (typeof showToast === 'function') showToast('ไม่พบรายการสำหรับออกใบแจ้งหนี้', 'warning');
        return;
    }

    // ดึงการตั้งค่าล่าสุดจากฐานข้อมูลก่อนพิมพ์
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        try {
            const { data } = await supabaseClient.from('waste_settings').select('*').limit(1).single();
            if (data) {
                localStorage.setItem('waste_settings', JSON.stringify(data));
            }
        } catch (e) {}
    }

    const perPage = parseInt(options.perPage || 1, 10);
    const css = buildInvoicePrintCSS(perPage);

    let sheetsHTML = '';
    const barcodeQueue = [];

    for (let i = 0; i < invoiceDataList.length; i += perPage) {
        const chunk = invoiceDataList.slice(i, i + perPage);
        let innerHTML = '';
        chunk.forEach(item => {
            const built = buildSingleInvoiceHTML(item, options);
            innerHTML += built.html;
            barcodeQueue.push({ id: built.barcodeId, data: built.barcodeData });
        });
        sheetsHTML += `<div class="a4-sheet">${innerHTML}</div>`;
    }

    const html = `<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <title>พิมพ์ใบแจ้งหนี้ค่าธรรมเนียมขยะ (${invoiceDataList.length} รายการ)</title>
    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
    <script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"><\/script>
    <style>${css}</style>
</head>
<body>
    <div class="print-toolbar no-print">
        <div>
            <strong>🖨️ รายงานใบแจ้งหนี้ค่าธรรมเนียมขยะมูลฝอย</strong>
            <span style="margin-left: 12px; font-size: 13px; opacity: 0.85;">จำนวน ${invoiceDataList.length} รายการ (${Math.ceil(invoiceDataList.length / perPage)} หน้า A4)</span>
        </div>
        <div>
            <button class="btn-action btn-print" onclick="window.print()">🖨️ สั่งพิมพ์ / บันทึก PDF</button>
            <button class="btn-action btn-close-win" onclick="window.close()">✖ ปิดหน้าต่าง</button>
        </div>
    </div>
    ${sheetsHTML}
    <script>
        const barcodes = ${JSON.stringify(barcodeQueue)};
        window.addEventListener('DOMContentLoaded', function() {
            barcodes.forEach(function(b) {
                // 1. วาด 1D Barcode
                const el = document.getElementById(b.id);
                if (el && typeof JsBarcode !== 'undefined') {
                    try {
                        JsBarcode(el, b.data, {
                            format: "CODE128",
                            displayValue: false,
                            height: 55,
                            width: 1.35,
                            margin: 0
                        });
                    } catch (e) {
                        console.error('Barcode error:', e);
                    }
                }
                // 2. วาด 2D QR Code เป็น Base64 ทันทีในหน้าพิมพ์
                const qrEl = document.getElementById('qr_' + b.id);
                if (qrEl && typeof qrcode === 'function') {
                    try {
                        const qr = qrcode(0, 'M');
                        qr.addData(b.data);
                        qr.make();
                        qrEl.src = qr.createDataURL(4, 2);
                    } catch (e) {
                        console.error('QR error:', e);
                    }
                }
            });

            // รอให้รูปภาพทั้งหมดโหลดเสร็จก่อนเปิดหน้าต่างสั่งพิมพ์
            const imgs = Array.from(document.images);
            const imgPromises = imgs.map(function(img) {
                if (img.complete) return Promise.resolve();
                return new Promise(function(resolve) {
                    img.onload = resolve;
                    img.onerror = resolve;
                });
            });

            Promise.all(imgPromises).then(function() {
                setTimeout(function() {
                    window.print();
                }, 300);
            });
        });
    <\/script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=1024,height=900');
    if (!win) {
        Swal.fire('แจ้งเตือน', 'เบราว์เซอร์บล็อกหน้าต่างป๊อปอัป กรุณาอนุญาตป๊อปอัปสำหรับเว็บไซต์นี้', 'warning');
        return;
    }
    win.document.write(html);
    win.document.close();
}
