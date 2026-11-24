// ============================================
// พิมพ์หนังสือทวงหนี้ (2 หน้า) — รูปแบบหนังสือราชการภายนอก
// Font: TH Sarabun New (Sarabun) ขนาด 12pt มาตรฐานราชการ
// กระดาษ: A4 (210mm x 297mm)
// ============================================
var DEBT_LETTER_CONFIG = {
    orgName: 'องค์การบริหารส่วนตำบลเหมืองหม้อ',
    orgAddr: 'ต.เหมืองหม้อ อ.เมืองแพร่ จ.แพร่',
    bylawYear: '2565',
    bylawDays: '15',
    signerName: 'นางสาวปิยวรรณ จิตตะมัย',
    signerTitle: 'นายกองค์การบริหารส่วนตำบลเหมืองหม้อ',
    tambon: 'ตำบลเหมืองหม้อ',
    amphoe: 'อำเภอเมือง',
    province: 'จังหวัดขอนแก่น',
    postCode: '40000',
    postOfficeName: 'ไปรษณีย์ขอนแก่น 40000',
    garudaUrl: (function(){ var b = window.location.href; return b.substring(0, b.lastIndexOf('/')+1) + 'assets/img/garuda.png'; })(),
    bylawName: 'ข้อบัญญัติองค์การบริหารส่วนตำบลเหมืองหม้อ',
    orgTel: ''
};

function debtLetterNumberToThaiBahtText(amount) {
    amount = parseFloat(amount) || 0;
    if (amount === 0) return 'ศูนย์บาทถ้วน';

    var numText = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
    var unitText = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

    function convertInteger(numStr) {
        var result = '';
        var len = numStr.length;
        for (var i = 0; i < len; i++) {
            var digit = parseInt(numStr.charAt(i), 10);
            var pos = len - i - 1;
            var unitPos = pos % 6;

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

    var parts = amount.toFixed(2).split('.');
    var bahtPart = parseInt(parts[0], 10);
    var satangPart = parseInt(parts[1], 10);

    var text = '';
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

function buildDebtLetterComcodeData(d, settings) {
    var compCode = settings.company_code || '98553';
    var taxId = settings.tax_id || settings.company_code || '0994000160381';
    var suffix = settings.branch_suffix || '00';
    var billerId = String(taxId).length >= 15 ? String(taxId) : (String(taxId) + String(suffix));

    // Ref1: รหัสลูกค้า 18 หลัก (มาตรฐานเดียวกับระบบหน้าบ้านและใบแจ้งหนี้)
    var ref1 = String(d.id).padStart(18, '0');

    // Ref2: วันที่เวลา + รหัสลูกค้า 6 หลักท้าย (18 หลัก)
    var now = new Date();
    var yyyy = String(now.getFullYear()).padStart(4, '0');
    var MM = String(now.getMonth() + 1).padStart(2, '0');
    var dd = String(now.getDate()).padStart(2, '0');
    var HHmm = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
    var cidTail = String(d.id).replace(/\D/g, '').slice(-6).padStart(6, '0');
    var ref2 = yyyy + MM + dd + HHmm + cidTail;

    var totalAmount = parseFloat(d.total_debt) || 0;
    var amountSatang = Math.round(totalAmount * 100).toString();

    // รูปแบบบาร์โค้ดมาตรฐาน Cross-Bank Bill Payment
    var barcodeData = '|' + billerId + '\r' + ref1 + '\r' + ref2 + '\r' + amountSatang;
    var barcodeTextDisplay = billerId + ' ' + ref1 + ' ' + ref2 + ' ' + amountSatang;

    // กำหนดชำระภายในวันที่ (ดึงจากช่องระบุกำหนดชำระในหน้า waste-debtors.html หรือ localStorage ก่อน)
    var customDueIso = '';
    if (typeof document !== 'undefined') {
        var dueInput = document.getElementById('debtDueDate');
        if (dueInput && dueInput.value) customDueIso = dueInput.value;
    }
    if (!customDueIso) {
        try { customDueIso = localStorage.getItem('waste_debt_due_date') || ''; } catch (e) {}
    }

    var dueDateStr = '';
    if (customDueIso && customDueIso.split('-').length === 3) {
        var parts = customDueIso.split('-');
        var yNum = parseInt(parts[0], 10);
        if (yNum < 2400) yNum += 543;
        dueDateStr = parts[2] + '/' + parts[1] + '/' + String(yNum);
    } else {
        var dueDays = parseInt(settings.due_days || DEBT_LETTER_CONFIG.bylawDays || 15, 10);
        if (isNaN(dueDays) || dueDays < 1) dueDays = 15;
        var dueDate = new Date(now.getTime() + dueDays * 24 * 60 * 60 * 1000);
        var dueDd = String(dueDate.getDate()).padStart(2, '0');
        var dueMm = String(dueDate.getMonth() + 1).padStart(2, '0');
        var dueYyyy = String(dueDate.getFullYear() + 543);
        dueDateStr = dueDd + '/' + dueMm + '/' + dueYyyy;
    }

    var qrFallbackUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(barcodeData);

    return {
        compCode: compCode,
        taxId: taxId,
        suffix: suffix,
        billerId: billerId,
        ref1: ref1,
        ref2: ref2,
        amountSatang: amountSatang,
        barcodeData: barcodeData,
        barcodeTextDisplay: barcodeTextDisplay,
        dueDateStr: dueDateStr,
        qrFallbackUrl: qrFallbackUrl
    };
}

function buildDebtLetterCSS() {
    return [
        "@import url('https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');",
        "@page { size: A4; margin: 0; }",
        "* { margin:0; padding:0; box-sizing:border-box; }",
        "body { font-family: 'Sarabun', 'TH Sarabun New', 'TH SarabunPSK', sans-serif; font-size: 11.5pt; color: #000; line-height: 1.15; background: #eee; }",

        // === PAGE 1: หนังสือราชการภายนอก + แบบฟอร์มชำระเงิน ธ.กรุงไทย ===
        ".page {",
        "  width: 210mm; height: 297mm;",
        "  padding: 0;",
        "  position: relative;",
        "  page-break-after: always;",
        "  background: #fff;",
        "  margin: 10px auto;",
        "  box-shadow: 0 2px 8px rgba(0,0,0,0.15);",
        "  overflow: hidden;",
        "}",
        ".garuda { position: absolute; top: 8mm; left: 50%; transform: translateX(-50%); }",
        ".garuda img { height: 24mm; }",
        ".content-wrapper { padding: 30mm 20mm 0 24mm; }",
        ".header-row { position: relative; margin-bottom: 4mm; min-height: 11mm; }",
        ".doc-no { position: absolute; left: 0; top: 0; font-size: 11.5pt; }",
        ".org-info { position: absolute; left: 55%; top: 0; right: 0; font-size: 11.5pt; line-height: 1.25; text-align: left; }",
        ".date-line { margin-left: 50%; font-size: 11.5pt; margin-bottom: 2.5mm; }",
        ".subject { font-size: 11.5pt; margin-bottom: 2mm; }",
        ".to-line { font-size: 11.5pt; margin-bottom: 2.5mm; }",
        ".body-text { text-indent: 22mm; text-align: justify; font-size: 11.5pt; line-height: 1.26; margin-bottom: 2mm; }",
        ".closing-block { margin-top: 2.5mm; margin-left: 48%; width: 65mm; text-align: center; }",
        ".closing-block .regards { font-size: 11.5pt; margin-bottom: 2mm; text-align: center; }",
        ".closing-block .sign-area { text-align: center; }",
        ".closing-block .sign-area .signer-name { font-size: 11.5pt; }",
        ".closing-block .sign-area .signer-title { font-size: 11pt; line-height: 1.2; }",

        // === แบบฟอร์มการชำระเงิน บมจ. ธนาคารกรุงไทย (ส่วนท้าย หน้าที่ 1) ===
        ".ktb-payment-form {",
        "  position: absolute;",
        "  bottom: 7mm;",
        "  left: 14mm;",
        "  right: 14mm;",
        "  border-top: 1px solid #222;",
        "  padding-top: 2mm;",
        "  font-size: 9pt;",
        "  line-height: 1.25;",
        "  color: #000;",
        "}",
        ".ktb-header-row {",
        "  display: flex;",
        "  justify-content: space-between;",
        "  align-items: flex-start;",
        "  margin-bottom: 1.2mm;",
        "}",
        ".ktb-brand-left {",
        "  display: flex;",
        "  align-items: center;",
        "  gap: 2.5mm;",
        "}",
        ".ktb-logo-box {",
        "  display: flex;",
        "  flex-direction: column;",
        "  align-items: center;",
        "  justify-content: center;",
        "  width: 11.5mm;",
        "  flex-shrink: 0;",
        "}",
        ".ktb-logo-text {",
        "  font-size: 7.5pt;",
        "  font-weight: 700;",
        "  color: #005691;",
        "  line-height: 1;",
        "  margin-top: 0.6mm;",
        "}",
        ".ktb-title-block {",
        "  font-size: 9.3pt;",
        "  line-height: 1.3;",
        "}",
        ".ktb-for-bank {",
        "  font-size: 9.3pt;",
        "  white-space: nowrap;",
        "}",
        ".ktb-customer-line {",
        "  font-size: 9.3pt;",
        "  margin-bottom: 0.8mm;",
        "}",
        ".ktb-ref-table {",
        "  width: 100%;",
        "  border-collapse: collapse;",
        "  margin-bottom: 1.5mm;",
        "  font-size: 9pt;",
        "}",
        ".ktb-ref-table td {",
        "  padding: 0.3mm 0;",
        "  white-space: nowrap;",
        "  vertical-align: middle;",
        "}",
        ".ktb-ref-label-col1 {",
        "  display: inline-block;",
        "  min-width: 39mm;",
        "  padding-right: 2.5mm;",
        "}",
        ".ktb-ref-label-col2 {",
        "  display: inline-block;",
        "  min-width: 21mm;",
        "  padding-right: 2.5mm;",
        "}",
        ".ktb-table {",
        "  width: 100%;",
        "  border-collapse: collapse;",
        "  margin-bottom: 1.8mm;",
        "  font-size: 8.8pt;",
        "}",
        ".ktb-table th, .ktb-table td {",
        "  border: 1px solid #000;",
        "  padding: 1mm 1.8mm;",
        "  vertical-align: middle;",
        "}",
        ".ktb-table th {",
        "  text-align: center;",
        "  font-weight: 600;",
        "  background: #fff;",
        "  white-space: nowrap;",
        "}",
        ".ktb-nowrap {",
        "  white-space: nowrap;",
        "}",
        ".ktb-circle {",
        "  display: inline-block;",
        "  width: 3mm;",
        "  height: 3mm;",
        "  border: 1px solid #000;",
        "  border-radius: 50%;",
        "  vertical-align: middle;",
        "  margin-right: 1.5mm;",
        "}",
        ".ktb-amount-cell {",
        "  text-align: right;",
        "  font-weight: 700;",
        "  font-size: 10.5pt;",
        "  padding-right: 2.5mm !important;",
        "  white-space: nowrap;",
        "}",
        ".ktb-baht-text-cell {",
        "  text-align: center;",
        "  font-weight: 600;",
        "}",
        ".ktb-depositor-row td {",
        "  padding: 1.5mm 2mm;",
        "  font-size: 8.8pt;",
        "}",
        ".ktb-depositor-flex {",
        "  display: flex;",
        "  align-items: baseline;",
        "  width: 100%;",
        "  white-space: nowrap;",
        "  gap: 1mm;",
        "}",
        ".ktb-dot-line {",
        "  flex: 1;",
        "  border-bottom: 1px dotted #000;",
        "  height: 3.2mm;",
        "  min-width: 15mm;",
        "}",
        ".ktb-dot-line.tel {",
        "  flex: 0.7;",
        "}",
        ".ktb-bottom-row {",
        "  display: flex;",
        "  align-items: flex-start;",
        "  justify-content: space-between;",
        "  gap: 3mm;",
        "}",
        ".ktb-barcode-col {",
        "  flex: 1;",
        "  min-width: 0;",
        "}",
        ".ktb-barcode-svg {",
        "  width: 100%;",
        "  max-width: 112mm;",
        "  height: 12mm;",
        "  display: block;",
        "}",
        ".ktb-barcode-num {",
        "  font-size: 8.4pt;",
        "  letter-spacing: 0.2px;",
        "  margin-top: 0.4mm;",
        "  margin-bottom: 0.8mm;",
        "  font-family: 'Sarabun', monospace;",
        "  white-space: nowrap;",
        "}",
        ".ktb-footnote {",
        "  font-size: 7.5pt;",
        "  line-height: 1.22;",
        "  color: #111;",
        "}",
        ".ktb-qr-col {",
        "  width: 23mm;",
        "  flex-shrink: 0;",
        "  display: flex;",
        "  justify-content: center;",
        "  align-items: center;",
        "}",
        ".ktb-qr-img {",
        "  width: 22mm;",
        "  height: 22mm;",
        "  border: 1px solid #000;",
        "  padding: 0.5mm;",
        "  background: #fff;",
        "  display: block;",
        "}",
        ".ktb-notice-col {",
        "  width: 42mm;",
        "  flex-shrink: 0;",
        "  display: flex;",
        "  flex-direction: column;",
        "  align-items: flex-end;",
        "  gap: 1.5mm;",
        "}",
        ".ktb-warning-box {",
        "  width: 100%;",
        "  border: 1px solid #000;",
        "  padding: 1.6mm 2mm;",
        "  text-align: center;",
        "  font-size: 8.4pt;",
        "  line-height: 1.25;",
        "}",
        ".ktb-channel-icons {",
        "  display: flex;",
        "  align-items: center;",
        "  justify-content: flex-end;",
        "  gap: 1.2mm;",
        "}",
        ".ktb-ch-badge {",
        "  display: inline-flex;",
        "  align-items: center;",
        "  justify-content: center;",
        "  width: 4.5mm;",
        "  height: 4.5mm;",
        "  border-radius: 50%;",
        "  background: #333;",
        "  color: #fff;",
        "  font-size: 5.5pt;",
        "  font-weight: 700;",
        "}",

        // === PAGE 2: ซองจดหมาย ===
        ".page2 {",
        "  width: 210mm; height: 297mm;",
        "  padding: 0;",
        "  position: relative;",
        "  page-break-after: always;",
        "  background: #fff;",
        "  margin: 10px auto;",
        "  box-shadow: 0 2px 8px rgba(0,0,0,0.15);",
        "  overflow: hidden;",
        "}",
        ".envelope-header { position: absolute; top: 25mm; left: 15mm; display: flex; align-items: flex-start; gap: 5mm; max-width: 95mm; }",
        ".envelope-header img { height: 25mm; flex-shrink: 0; }",
        ".envelope-org { font-size: 13pt; line-height: 1.4; margin-top: 16mm; word-wrap: break-word; }",
        ".stamp-box { position: absolute; top: 25mm; right: 15mm; width: 65mm; border: 1px solid #000; padding: 6mm 2mm; text-align: center; }",
        ".stamp-box div { font-size: 14pt; margin-bottom: 8px; }",
        ".stamp-box div:last-child { margin-bottom: 0; }",
        ".send-to { position: absolute; top: 95mm; left: 70mm; font-size: 15pt; line-height: 1.6; }",

        // === PRINT ===
        "@media print {",
        "  .no-print { display: none !important; }",
        "  body { background: #fff; }",
        "  .page, .page2 { margin: 0; box-shadow: none; }",
        "}",
        ".no-print { display: flex; gap: 10px; justify-content: center; padding: 15px; background: #f3f4f6; margin-bottom: 20px; font-family: 'Sarabun', sans-serif; }",
        ".btn-print-action { border: none; padding: 10px 20px; border-radius: 6px; font-family: 'Sarabun', sans-serif; font-size: 16px; cursor: pointer; color: #fff; font-weight: 600; }",
        ".btn-print-action.primary { background: #1a56db; } .btn-print-action.danger { background: #dc2626; }"
    ].join('\n');
}

function buildDebtLetterPages(d, year, barcodeQueue) {
    var settings = JSON.parse(localStorage.getItem('waste_settings') || '{}');
    var cfg = DEBT_LETTER_CONFIG;
    var orgName = settings.org_name || cfg.orgName;
    var orgAddr = settings.org_address || cfg.orgAddr;
    var orgTel = settings.org_phone || cfg.orgTel || '';
    var signerName = settings.mayor_name || cfg.signerName;
    var signerTitle = settings.mayor_title || cfg.signerTitle;
    var postOfficeName = settings.env_post_office || cfg.postOfficeName;
    var garudaUrl = cfg.garudaUrl;
    var bylawName = 'เทศบัญญัติ' + orgName;

    // Extract address details from orgAddr or settings
    var parsedTambon = settings.org_subdistrict_name ? 'ตำบล' + settings.org_subdistrict_name : cfg.tambon;
    var parsedAmphoe = settings.org_district_name ? 'อำเภอ' + settings.org_district_name.replace('เขต', '').replace('อำเภอ', '') : cfg.amphoe;
    var parsedProvince = settings.org_province_name ? 'จังหวัด' + settings.org_province_name : cfg.province;
    var parsedPostCode = cfg.postCode;

    // Fallback to parsing orgAddr if settings names are missing
    if (orgAddr) {
        if (!settings.org_subdistrict_name) {
            var mTambon = orgAddr.match(/ต\.\s*(.+?)(?=\s+อ\.|\s+จ\.|\s+\d|$)/);
            if(mTambon) parsedTambon = 'ตำบล' + mTambon[1].replace(/,/, '').trim();
        }
        
        if (!settings.org_district_name) {
            var mAmphoe = orgAddr.match(/อ\.\s*(.+?)(?=\s+จ\.|\s+\d|$)/);
            if(mAmphoe) parsedAmphoe = 'อำเภอ' + mAmphoe[1].replace(/,/, '').trim();
        }
        
        if (!settings.org_province_name) {
            var mProvince = orgAddr.match(/จ\.\s*(.+?)(?=\s+\d|$)/);
            if(mProvince) parsedProvince = 'จังหวัด' + mProvince[1].replace(/,/, '').trim();
        }

        var mPostCode = orgAddr.match(/(\d{5})/);
        if(mPostCode) parsedPostCode = mPostCode[1];
    }
    
    // Also try to extract postcode from env_post_office if not found in orgAddr
    if (!mPostCode && postOfficeName) {
        var mPostCode2 = postOfficeName.match(/(\d{5})/);
        if(mPostCode2) parsedPostCode = mPostCode2[1];
    }

    var now = new Date();
    var thaiMonthNames = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    var thaiDate = now.getDate() + ' ' + thaiMonthNames[now.getMonth()] + ' ' + (now.getFullYear() + 543);
    var docYear = String(now.getFullYear() + 543);
    var docNo = settings.doc_invoice_no || ('ทม.บป.' + String(Math.floor(Math.random()*9000)+1000) + '/' + docYear.substring(2));
    var unpaidList = '';
    if (Array.isArray(d.unpaid_months) && d.unpaid_months.length > 1) {
        unpaidList = d.unpaid_months[0] + ' - ' + d.unpaid_months[d.unpaid_months.length - 1];
    } else if (Array.isArray(d.unpaid_months) && d.unpaid_months.length === 1) {
        unpaidList = d.unpaid_months[0];
    }
    var feeText = formatMoney(d.fee);
    var totalDebtNum = parseFloat(d.total_debt) || 0;
    var totalText = formatMoney(totalDebtNum);
    var totalDecimalText = totalDebtNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '-';
    var thaiBahtText = debtLetterNumberToThaiBahtText(totalDebtNum);
    var monthCount = d.unpaid_count;
    var stampNo = settings.env_license_no || (String(Math.floor(Math.random()*900)+100) + '/' + docYear.substring(2) + String(parseInt(docYear.substring(2))+1));

    // ลายเซ็น
    var signatureHTML = '';
    if (settings.mayor_signature) {
        signatureHTML = '<img src="' + settings.mayor_signature + '" style="height:10mm; display:block; margin:0 auto 1mm;">';
    } else {
        signatureHTML = '<div style="height:9mm;"></div>';
    }

    // ข้อมูล Comcode, Ref1, Ref2, Barcode, QR Code
    var comcodeInfo = buildDebtLetterComcodeData(d, settings);
    var uniqueId = 'debt_bc_' + String(d.id).replace(/\W/g, '') + '_' + Math.floor(Math.random() * 100000);
    if (Array.isArray(barcodeQueue)) {
        barcodeQueue.push({
            id: uniqueId,
            data: comcodeInfo.barcodeData
        });
    }

    var displayOrgAddr = orgAddr;
    if (settings.org_province_name) {
        var addrParts = [];
        if (settings.org_address) addrParts.push(settings.org_address);
        if (settings.org_subdistrict_name && !String(settings.org_address).includes(settings.org_subdistrict_name)) {
            addrParts.push('ต.' + settings.org_subdistrict_name);
        }
        if (settings.org_district_name && !String(settings.org_address).includes(settings.org_district_name.replace('อำเภอ', ''))) {
            addrParts.push('อ.' + settings.org_district_name.replace('เขต', '').replace('อำเภอ', ''));
        }
        if (settings.org_province_name && !String(settings.org_address).includes(settings.org_province_name)) {
            addrParts.push('จ.' + settings.org_province_name);
        }
        if (parsedPostCode && !String(settings.org_address).includes(parsedPostCode)) {
            addrParts.push(parsedPostCode);
        }
        displayOrgAddr = addrParts.join(' ');
    }

    // โลโก้นกวายุภักษ์ ธนาคารกรุงไทย (Official Vector SVG)
    var ktbLogoSvg =
        '<div class="ktb-logo-box">' +
            '<svg viewBox="0 0 128 128" width="26" height="26" xmlns="http://www.w3.org/2000/svg">' +
                '<circle cx="64" cy="64" r="62" fill="#00A5E5"/>' +
                '<g transform="matrix(1.12,0,0,-1.12,332.5,472.5)">' +
                    '<path fill="#FFFFFF" d="M-220.1,336.6c0,0,0.6,1,0.9-0.4c0,0,0.6-8.1-4.1-13.1c-3.2-3.3-10.6-8-18.9-5.9c0,0,13.3,0.9,16.7,14.1l0.4,1.5C-225.3,332.8-222,333.7-220.1,336.6 M-189.8,377.4c0,0.2,0,0.3-0.1,0.5c0,0-0.2,0.8-0.7,2.2c-0.1,0.2-0.2,0.4-0.2,0.6l0,0c0,0.1-0.1,0.2-0.1,0.2c-0.9,2.1-2.6,5.1-5.5,8c0,0,3.1,0.2-0.3,4c0,0-5.6,6.6-16.5,11.7c-5.8,2.7-12.4,1.6-11.8-4.9c0.4-4.5-3.8-6.3-7.1-5.9c-3.9,0.5-6.3,3.7-5.6,6.3c0.7,2.8,2.1,5,4.3,6.7c1.5,1.2,2.5,2,5.2,2.5c1.6,0.3,3.8,0.9,4.4-1c1.1,0.6,3.1,4.4-3.4,4.4c0,0-1,2.1-3.2,1.7c0,0-6.5,6.4-13.8-1.5c0,0-2.8-1.1-3,0c0.6-0.5,1.7,1,0.3,1.6c-0.7,0.3-1.5-0.5-1.6-1.1c-0.1-0.5,0.1-1.7,1.5-1.9c0.4-0.1,1.1,0,1.1,0l-0.5-0.6c-2.2-0.9-4.2-0.2-4.6,1.3c0.5-0.3,1.1,0.1,1.2,0.6c0.2,0.6-0.2,1.4-1.1,1.5c-1.2,0.2-1.7-1.2-1.5-2.4c0.4-1.9,2.2-3.2,4.6-2.8l-0.4-0.6c0,0-2.4-3-4.3-6.4c-2-3.4-10.1-7.2-8.7,1c0.4,2.6-3.9,5.7-11.6,0.5c-4-2.8-9-7-12.8-13.8c0,0-1.6-2.6,1.1-2.7c0,0-5.5-2.6-5.8-15.1l0,0c0,0,0-0.5,0-1.2c0-0.4,0-0.9,0-1.3c0-1.4,0.1-3,0.2-3.9c0,0,0.6-7.5,1.9-8.8c0,0,0.1,0,0.2,0c0.4-0.3,0.9-0.4,1.6,0.3l0,0c0-0.1,1.7-8.5,5.1-15.6c2.8-5.6,7.9-13.8,5.9-15.8c-2-2-4.8,2-4.4,0.4c0.9-3.3,4.4-3.8,6.2-2.4c4.8,3.8-2.2,12.9-4.4,24.4c4.6,2,4.4,9.2,4.4,9.2s6.5,0.2,8.5,7.9c0,0,7.9-2.3,11.7,4.6c0,0,0,0,0,0.1l0.1,0.1c0.8-2.4,2.3-4.5,4.4-6.4c0,0-0.4-3.3-4.1-4.5c0,0-4.5,1.9-9.5,0c-4.5-1.8-2.7-6.6,0.6-5.4c-1,0.5-1.3,2.1,0.3,2.5c0.4-0.3,0.8-0.5,1.3-0.6l0,0c0.1,0,4-0.7,6.8,0.4c0.2,0.1,0.4,0.1,0.6,0.3h0.1l0,0c0.3,0.2,0.5,0.4,0.7,0.6c1-0.1,1.7-1.6,0.3-2.3c2.7-0.6,3.7,2.3,2.6,3.8c0,0,0.6,0.4,1.4,1c0,0,0.9,0.8,1.5,1.8c0,0,2.7-2.1,7.6-3.3c0,0-2.6-4.3-6.4-5.1c0,0-5.4,1.8-9.1-0.5c0,0-2-1.1-1.7-3.2c0.2-1.6,1.6-2.8,3.5-2.5c-0.8,0.4-2.6,2.4-0.3,3.3c0.4-0.6,0.9-1,1.6-1.1l0,0c0,0,3.4-0.8,7.6,1c0.2,0.1,0.3,0.1,0.5,0.2c0,0,0.1,0,0.2,0.1l0,0c0.3,0.2,0.5,0.4,0.6,0.6c1.1,0.2,2.6-0.3,2-2.4c1.3,0.2,3.4,2.5,0.3,4.4c0,0,1.8,0.9,3.3,2.2l2.2,2.2c4.3-0.6,7.5-4.7,7.5-9.7c0-4.1-3.5-8.9-7.2-9.9c0.1,0,0.3,0.1,0.4,0.1l-0.5-0.1h0.1c-0.6-0.1-1.2-0.2-2-0.2c-3.8,0.1-1.5,4.5-1.5,4.5c-0.6,0.1-1.2-0.1-1.7-0.7c-0.6-0.7-0.8-2-0.6-3.4c-0.2,0.1-0.4,0.1-0.5,0.2c-3.3,1.4-3.1,3.9-3.1,3.9c-0.9-0.4-1.5-1.5-1.2-3.4c0.5-2.5,3.7-3.6,6.3-3.9c1.5-1.5,3.9-3,9.4-2.1c0,0-2.4-12.8-18.6-12.2c0,0-4.9,1.8-4.7,5.9c0.2,5.5,4,7.4,4,7.4c-1.4,0.2-4.8-0.2-6.3-4.7c-0.7-2-0.5-5.4,1.3-7.7c-6.1,1.6-10.7,6.2-8.8,12.6c0.3,1,0.9,2,1.7,2.9c4.6,4.3,11.4,1.7,11.4,1.7c-0.3,1.5-2.2,3.5-5.6,3.7c-3.5,0.2-10.2-1.9-10.7-10c-0.5-7.4,4.2-12.8,15.9-14.5l0.2-0.1c0,0,7.1-5,17.1-2.3c0,0,20.2,4.1,15.9,27.2c0,0,4.7,15.4-5.2,24.1c6.1-5,13.6-2.1,13.6-2.1c-0.5-14,5.4-15.8,5.4-15.8l0.2,0.1c0,0-11.1-23.9-4.6-27c2.2-1,4.8-0.5,6.1,2.3c1.1,2.3-2.4-2.2-4.4-0.3c-2.4,2.4,0.6,8.1,3.5,14.2c4.1,8.2,6.8,14.3,7.3,18.4c0,0,0.6-0.4,1.3-0.1l0.1-0.1c1.6,0.4,2.6,7,2.8,8.1C-188.8,370-189.2,374.5-189.8,377.4"/>' +
                '</g>' +
            '</svg>' +
            '<span class="ktb-logo-text">กรุงไทย</span>' +
        '</div>';

    // แบบฟอร์มการชำระเงินค่าธรรมเนียมขยะมูลฝอยผ่าน บมจ. ธนาคารกรุงไทย
    var ktbPaymentFormHTML =
        '<div class="ktb-payment-form">' +
            '<div class="ktb-header-row">' +
                '<div class="ktb-brand-left">' +
                    ktbLogoSvg +
                    '<div class="ktb-title-block">' +
                        '<div>แบบฟอร์มการชำระเงินค่าธรรมเนียมขยะมูลฝอยผ่าน บมจ. ธนาคารกรุงไทย</div>' +
                        '<div>ชำระให้' + orgName + '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="ktb-for-bank">(สำหรับธนาคาร)</div>' +
            '</div>' +

            '<div class="ktb-customer-line">' +
                'ชื่อ <b>' + (d.name || '-') + '</b> (' + d.id + ') บ้านเลขที่ ' + (d.house_no || '-') + ' หมู่ที่ ' + (d.moo || '-') +
            '</div>' +

            '<table class="ktb-ref-table">' +
                '<tr>' +
                    '<td style="width: 40%;"><span class="ktb-ref-label-col1">Comp. Code :</span><span>&nbsp;' + comcodeInfo.compCode + '</span></td>' +
                    '<td style="width: 34%;"><span class="ktb-ref-label-col2">รหัสอ้างอิง 1 :</span><span>&nbsp;' + comcodeInfo.ref1 + '</span></td>' +
                    '<td style="width: 26%; text-align: right;">กำหนดชำระภายในวันที่ : &nbsp;&nbsp;' + comcodeInfo.dueDateStr + '</td>' +
                '</tr>' +
                '<tr>' +
                    '<td><span class="ktb-ref-label-col1">Biller ID (ชำระธนาคารอื่น) :</span><span>&nbsp;' + comcodeInfo.billerId + '</span></td>' +
                    '<td><span class="ktb-ref-label-col2">รหัสอ้างอิง 2 :</span><span>&nbsp;' + comcodeInfo.ref2 + '</span></td>' +
                    '<td>&nbsp;</td>' +
                '</tr>' +
            '</table>' +

            '<table class="ktb-table">' +
                '<thead>' +
                    '<tr>' +
                        '<th style="width: 23%;">หมายเลขที่เช็ค/Cheque No</th>' +
                        '<th style="width: 19%;">เช็คลงวันที่/Date</th>' +
                        '<th style="width: 22%;">ชื่อธนาคาร/Bank Name</th>' +
                        '<th style="width: 16%;">สาขา/Branch</th>' +
                        '<th style="width: 20%;">บาท/Baht</th>' +
                    '</tr>' +
                '</thead>' +
                '<tbody>' +
                    '<tr>' +
                        '<td style="height: 5mm;">&nbsp;</td>' +
                        '<td>&nbsp;</td>' +
                        '<td>&nbsp;</td>' +
                        '<td>&nbsp;</td>' +
                        '<td rowspan="3" class="ktb-amount-cell">' + totalDecimalText + '</td>' +
                    '</tr>' +
                    '<tr>' +
                        '<td class="ktb-nowrap"><span class="ktb-circle"></span>เงินโอน A/C Transfer</td>' +
                        '<td class="ktb-nowrap">เลขที่บัญชี A/C No</td>' +
                        '<td colspan="2">&nbsp;</td>' +
                    '</tr>' +
                    '<tr>' +
                        '<td class="ktb-nowrap"><span class="ktb-circle"></span>เงินสด/Cash</td>' +
                        '<td class="ktb-nowrap">จำนวนเงินเป็นตัวอักษร</td>' +
                        '<td colspan="2" class="ktb-baht-text-cell">- ' + thaiBahtText + ' -</td>' +
                    '</tr>' +
                    '<tr class="ktb-depositor-row">' +
                        '<td colspan="5">' +
                            '<div class="ktb-depositor-flex">' +
                                '<span>ชื่อผู้นำฝาก</span><span class="ktb-dot-line"></span>' +
                                '<span>โทร</span><span class="ktb-dot-line tel"></span>' +
                                '<span>เจ้าหน้าที่ธนาคารผู้รับเงิน</span><span class="ktb-dot-line"></span>' +
                            '</div>' +
                        '</td>' +
                    '</tr>' +
                '</tbody>' +
            '</table>' +

            '<div class="ktb-bottom-row">' +
                '<div class="ktb-barcode-col">' +
                    '<svg id="' + uniqueId + '" class="ktb-barcode-svg"></svg>' +
                    '<div class="ktb-barcode-num">' + comcodeInfo.barcodeTextDisplay + '</div>' +
                    '<div class="ktb-footnote">' +
                        'หมายเหตุ สามารถชำระผ่านช่องทางสาขาธนาคาร เอทีเอ็ม อินเตอร์เน็ต Krungthai NEXT ของธนาคารกรุงไทย<br>' +
                        'และช่องทางอิเล็กทรอนิกส์ของทุกธนาคารที่เข้าร่วมบริการ Cross Bank Bill Payment *ค่าธรรมเนียมขึ้นกับช่องทางการชำระ' +
                    '</div>' +
                '</div>' +
                '<div class="ktb-qr-col">' +
                    '<img id="qr_' + uniqueId + '" class="ktb-qr-img" src="' + comcodeInfo.qrFallbackUrl + '" alt="QR Code">' +
                '</div>' +
                '<div class="ktb-notice-col">' +
                    '<div class="ktb-warning-box">' +
                        '<u>ห้ามรับชำระเกินกำหนดเวลา</u><br>' +
                        'และให้รับชำระเงินตามยอดที่ระบุเท่านั้น' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>';

    // ============ PAGE 1: หนังสือราชการภายนอก + แบบฟอร์มชำระเงิน ธ.กรุงไทย ============
    var page1 =
        '<div class="page">' +

        // ครุฑ (กลางหน้าบน)
        '<div class="garuda"><img src="' + garudaUrl + '" alt="ครุฑ"></div>' +

        '<div class="content-wrapper">' +

        // ที่ + ส่วนราชการ
        '<div class="header-row">' +
            '<div class="doc-no">ที่ ' + docNo + '</div>' +
            '<div class="org-info">' + orgName + '<br>' + displayOrgAddr + '</div>' +
        '</div>' +

        // วันที่
        '<div class="date-line">วันที่ ' + thaiDate + '</div>' +

        // เรื่อง
        '<div class="subject">เรื่อง แจ้งเตือนให้ชำระค่าธรรมเนียมขยะมูลฝอยประจำปีงบประมาณ ' + year + ' ครั้งที่ ๑</div>' +

        // เรียน
        '<div class="to-line">เรียน ' + d.name + ' บ้านเลขที่ ' + d.house_no + ' หมู่ที่ ' + d.moo + '</div>' +

        // วรรคแรก
        '<div class="body-text">' +
            'ตามที่ ' + orgName + ' ได้ออก' + bylawName + 'ว่าด้วยการจัดการสิ่งปฏิกูลและขยะมูลฝอย พ.ศ.๒๕๖๔ โดยประกาศ ณ วันที่ ๒๕ พฤษภาคม ๒๕๖๕ ' +
            'เพื่อให้เป็นไปตามพระราชบัญญัติการสาธารณสุข พ.ศ.๒๕๓๕ ให้อำนาจองค์กรปกครองส่วนท้องถิ่นกำหนด' +
            'อัตราธรรมเนียมให้เป็นไปตามความเหมาะสมกับแหล่งกำเนิดขยะมูลฝอย และไม่เกินกว่าที่กฎหมายกำหนดไว้ นั้น' +
        '</div>' +

        // วรรคสอง
        '<div class="body-text">' +
            orgName + ' จึงขอแจ้งมายังท่านให้ดำเนินการชำระค่าธรรมเนียมการให้' +
            'บริการเก็บขนและกำจัดสิ่งปฏิกูลหรือมูลฝอย ตั้งแต่เดือน <b>' + unpaidList + '</b> ' +
            'จำนวน <b>' + monthCount + ' เดือน</b> เป็นจำนวนเงิน <b>' + totalText + ' บาท (' + thaiBahtText + ')</b> ' +
            'อัตราค่าธรรมเนียมต่อเดือน <b>' + feeText + ' บาท</b> ชำระได้ที่' +
            'งานจัดเก็บรายได้ กองคลัง ' + orgName + ' หรือสแกนชำระผ่าน QR CODE / เคาน์เตอร์ธนาคารกรุงไทย ตามแบบฟอร์มด้านล่างนี้' +
        '</div>' +

        // วรรคสาม
        '<div class="body-text">' +
            'จึงเรียนมาเพื่อโปรดทราบและขอความร่วมมือจากท่าน ไปชำระค่าธรรมเนียมดังกล่าวตามกำหนดเวลา' +
        '</div>' +

        // คำลงท้าย
        '<div class="closing-block">' +
            '<div class="regards">ขอแสดงความนับถือ</div>' +
            '<div class="sign-area">' +
                signatureHTML +
                '<div class="signer-name">(' + signerName + ')</div>' +
                '<div class="signer-title">' + signerTitle + '</div>' +
            '</div>' +
        '</div>' +

        '</div>' + // end content-wrapper

        // แบบฟอร์มการชำระเงิน บมจ. ธนาคารกรุงไทย (ส่วนท้าย หน้าที่ 1)
        ktbPaymentFormHTML +

        '</div>'; // end page

    var orgAddrLine1 = displayOrgAddr;
    var orgAddrLine2 = orgTel ? 'โทร.' + orgTel.replace(/^โทร\./, '') : '';
    var provMatch = displayOrgAddr.match(/(จ\..+)/);
    if (provMatch) {
        orgAddrLine1 = displayOrgAddr.substring(0, provMatch.index).trim();
        orgAddrLine2 = provMatch[1].trim() + (orgTel ? ' โทร.' + orgTel.replace(/^โทร\./, '') : '');
    }

    // ============ PAGE 2: หน้าซองจดหมาย ============
    var page2 =
        '<div class="page2">' +

        // ส่วนหัวซอง — ครุฑ + ข้อมูลหน่วยงาน (บนซ้าย)
        '<div class="envelope-header">' +
            '<img src="' + garudaUrl + '" alt="ครุฑ">' +
            '<div class="envelope-org">' +
                '<div>' + orgName + '</div>' +
                '<div>' + orgAddrLine1 + '</div>' +
                '<div>' + orgAddrLine2 + '</div>' +
            '</div>' +
        '</div>' +

        // กล่องแสตมป์ (บนขวา)
        '<div class="stamp-box">' +
            '<div>ชำระค่าฝากส่งเป็นรายเดือน</div>' +
            '<div>ใบอนุญาตเลขที่ ' + (stampNo || '') + '</div>' +
            '<div>' + postOfficeName + '</div>' +
        '</div>' +

        // ที่อยู่ผู้รับ (ตรงกลางค่อนไปทางขวา)
        '<div class="send-to">' +
            '<div>' + d.name + '</div>' +
            '<div>' + d.house_no + ' หมู่ ' + d.moo + ' ซอย - ถนน -</div>' +
            '<div>ตำบล/แขวง ' + parsedTambon.replace('ตำบล', '') + ' อำเภอ/เขต ' + parsedAmphoe.replace('อำเภอ', '') + '</div>' +
            '<div>จังหวัด ' + parsedProvince.replace('จังหวัด', '') + '</div>' +
            '<div>' + parsedPostCode + '</div>' +
        '</div>' +

        '</div>'; // end page2

    return page1 + page2;
}

function openDebtLetterPrintWindow(pagesHTML, barcodeQueue) {
    var css = buildDebtLetterCSS();
    var noPrintDiv = '<div class="no-print"><button class="btn-print-action danger" onclick="window.close()">ปิดหน้านี้</button><button class="btn-print-action primary" onclick="window.print()">พิมพ์อีกครั้ง</button></div>';
    var renderScript =
        '<script>' +
        'var barcodes = ' + JSON.stringify(barcodeQueue || []) + ';' +
        'window.addEventListener("DOMContentLoaded", function() {' +
            'barcodes.forEach(function(b) {' +
                'var el = document.getElementById(b.id);' +
                'if (el && typeof JsBarcode !== "undefined") {' +
                    'try {' +
                        'JsBarcode(el, b.data, {' +
                            'format: "CODE128",' +
                            'displayValue: false,' +
                            'height: 44,' +
                            'width: 1.25,' +
                            'margin: 0' +
                        '});' +
                    '} catch (e) { console.error("Barcode error:", e); }' +
                '}' +
                'var qrEl = document.getElementById("qr_" + b.id);' +
                'if (qrEl && typeof qrcode === "function") {' +
                    'try {' +
                        'var qr = qrcode(0, "M");' +
                        'qr.addData(b.data);' +
                        'qr.make();' +
                        'qrEl.src = qr.createDataURL(4, 2);' +
                    '} catch (e) { console.error("QR error:", e); }' +
                '}' +
            '});' +
            'var imgs = Array.prototype.slice.call(document.images);' +
            'var promises = imgs.map(function(img) {' +
                'if (img.complete) return Promise.resolve();' +
                'return new Promise(function(resolve) { img.onload = resolve; img.onerror = resolve; });' +
            '});' +
            'Promise.all(promises).then(function() {' +
                'setTimeout(function() { window.print(); }, 350);' +
            '});' +
        '});' +
        '<\/script>';

    var html =
        '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<title>หนังสือแจ้งเตือนให้ชำระค่าธรรมเนียมขยะมูลฝอย</title>' +
        '<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>' +
        '<script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"><\/script>' +
        '<style>' + css + '</style></head><body>' +
        noPrintDiv + pagesHTML + renderScript +
        '</body></html>';

    var w = window.open('', '_blank', 'width=950,height=1200');
    if (!w) {
        if (typeof showToast === 'function') showToast('กรุณาอนุญาตป๊อปอัปเพื่อพิมพ์หนังสือทวงหนี้', 'warning');
        return;
    }
    w.document.write(html);
    w.document.close();
}

// พิมพ์ทวงหนี้รายบุคคล
async function printDebtLetter(customerId) {
    var year = (typeof debtorSelectedYear !== 'undefined' && debtorSelectedYear) ? debtorSelectedYear : getCurrentFiscalYear();
    var debtors = window.currentFilteredDebtors || calculateDebtors(year);
    var d = debtors.find(function(x){ return x.id === customerId; });
    if (!d) { showToast('ไม่พบข้อมูลลูกหนี้','error'); return; }

    // Fetch settings directly from Supabase
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        try {
            const { data } = await supabaseClient.from('waste_settings').select('*').limit(1).single();
            if (data) {
                if (typeof ThaiAddress !== 'undefined') {
                    await ThaiAddress.loadData();
                    if (data.org_province) data.org_province_name = ThaiAddress.getProvinceName(parseInt(data.org_province));
                    if (data.org_district) data.org_district_name = ThaiAddress.getDistrictName(parseInt(data.org_district));
                }
                localStorage.setItem('waste_settings', JSON.stringify(data));
            }
        } catch (e) {
            console.warn('Could not fetch settings from Supabase', e);
        }
    }

    var barcodeQueue = [];
    var pages = buildDebtLetterPages(d, year, barcodeQueue);
    openDebtLetterPrintWindow(pages, barcodeQueue);
}

// พิมพ์ทวงหนี้ทั้งหมด
async function printAllDebtLetters() {
    var year = (typeof debtorSelectedYear !== 'undefined' && debtorSelectedYear) ? debtorSelectedYear : getCurrentFiscalYear();
    var debtors = window.currentFilteredDebtors || calculateDebtors(year);

    if (debtors.length === 0) {
        showToast('ไม่มีลูกหนี้ค้างชำระในปีนี้','warning');
        return;
    }

    Swal.fire({
        title: 'พิมพ์หนังสือทวงหนี้ทั้งหมด?',
        html: '<b>' + debtors.length + ' ราย</b> (' + (debtors.length * 2) + ' หน้า)<br><span style="font-size:13px;color:#6b7280;">ปีงบประมาณ ' + year + '</span>',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'พิมพ์ทั้งหมด',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#1a56db'
    }).then(async function(r) {
        if (r.isConfirmed) {
            Swal.fire({
                title: 'กำลังเตรียมข้อมูล...',
                text: 'กรุณารอสักครู่',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });

            // Fetch settings directly from Supabase
            if (typeof supabaseClient !== 'undefined' && supabaseClient) {
                try {
                    const { data } = await supabaseClient.from('waste_settings').select('*').limit(1).single();
                    if (data) {
                        if (typeof ThaiAddress !== 'undefined') {
                            await ThaiAddress.loadData();
                            if (data.org_province) data.org_province_name = ThaiAddress.getProvinceName(parseInt(data.org_province));
                            if (data.org_district) data.org_district_name = ThaiAddress.getDistrictName(parseInt(data.org_district));
                        }
                        localStorage.setItem('waste_settings', JSON.stringify(data));
                    }
                } catch (e) {
                    console.warn('Could not fetch settings from Supabase', e);
                }
            }
            
            Swal.close();

            var barcodeQueue = [];
            var allPages = '';
            debtors.forEach(function(d) {
                allPages += buildDebtLetterPages(d, year, barcodeQueue);
            });
            openDebtLetterPrintWindow(allPages, barcodeQueue);
        }
    });
}

