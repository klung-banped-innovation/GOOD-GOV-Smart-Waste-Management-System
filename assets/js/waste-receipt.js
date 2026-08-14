// ============================================
// Waste Receipt — บันทึก & เรียกดูใบเสร็จ
// ============================================

// === CONFIG ===
var RECEIPT_DRIVE_FOLDER = 'https://drive.google.com/drive/folders/1Gqxt-1GiC5cxUcbeyV8CoXASKV20lyOs';

// >>> หลัง Deploy Apps Script แล้ว ให้วาง URL ที่นี่ <<<
var GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby_bjxYrtQnhoEzPvIFqG11CjOhkwEFC_AC5OsxJKE-A08FZ6mBxY_0AHGy_R-ii1sOqQ/exec';

// We will dynamically fetch these from waste_settings in buildReceiptHTML
var RECEIPT_ORG = null;

function getGarudaAbsUrl() {
    var b = window.location.href;
    return b.substring(0, b.lastIndexOf('/') + 1) + 'assets/img/garuda.png';
}

// === สร้าง HTML ใบเสร็จ ===
async function buildReceiptHTML(payment) {
    var settings = JSON.parse(localStorage.getItem('waste_settings') || '{}');
    var orgName = settings.org_name || 'เทศบาลตำบล GOOD GOV';
    var orgAddress = settings.org_address || '';
    var orgPhone = settings.org_phone || '';
    var logo = settings.org_logo || getGarudaAbsUrl();

    let staffSignatureHTML = '<div style="height:30px;"></div>';
    if (payment.staff && typeof supabaseClient !== 'undefined') {
        try {
            const { data } = await supabaseClient.from('waste_staff')
                .select('signature_image_url')
                .ilike('name', `%${payment.staff.trim()}%`)
                .limit(1);
            if (data && data.length > 0 && data[0].signature_image_url) {
                staffSignatureHTML = `<img src="${data[0].signature_image_url}" style="height:30px;display:block;margin:0 auto 2px;">`;
            }
        } catch (e) {
            console.error('Failed to load staff signature', e);
        }
    }

    const formatThaiDateFull = (dateStr) => {
        if (!dateStr) return '-';
        const parts = dateStr.split('-');
        if (parts.length !== 3) {
            // Fallback to JS date parsing if it's ISO string
            var d = new Date(dateStr);
            if(isNaN(d.getTime())) return dateStr;
            const thMonths = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
            return `${d.getDate()} ${thMonths[d.getMonth()+1]} ${d.getFullYear() + 543}`;
        }
        const year = parseInt(parts[0], 10) + 543;
        const monthNum = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        const thaiMonths = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
        return `${day} ${thaiMonths[monthNum]} ${year}`;
    };

    var monthsText = '-';
    if (typeof formatMonthsGroupedByYear === 'function') {
        monthsText = formatMonthsGroupedByYear(payment.months_paid);
    } else if (payment.months_paid) {
        monthsText = Array.isArray(payment.months_paid) ? payment.months_paid.join(', ') : payment.months_paid;
    }

    var htmlString = `
    <!DOCTYPE html><html><head><meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
    body{font-family:'Prompt',sans-serif;margin:0;padding:0;color:#333;background:#fff;line-height:1.3;}
    .receipt-half { display: flex; flex-direction: column; justify-content: center; padding: 20px; max-width: 754px; margin: 0 auto; box-sizing: border-box; }
    .header{text-align:center;margin-bottom:4px;border-bottom:1px solid #1a56db;padding-bottom:6px}
    .header img{height:45px;margin-bottom:2px}
    h2{margin:0 0 2px 0;color:#1a56db;font-size:16px;line-height:1.2;} 
    .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:6px 0}
    .info-item{padding:4px 10px;background:#fff;border-radius:6px}
    .info-label{font-size:11px;color:#6b7280;font-weight:500;margin-bottom:1px;} 
    .info-value{font-size:14px;font-weight:600}
    .total{text-align:right;font-size:18px;font-weight:700;color:#057a55;margin:6px 0;padding:6px 12px;background:#fff;border-radius:6px}
    .footer{text-align:center;margin-top:20px;font-size:11px;color:#9ca3af;border-top:1px dashed #d1d5db;padding-top:6px}
    .no-print { display: flex; gap: 10px; justify-content: center; padding: 15px; background: #f3f4f6; margin-bottom: 20px; }
    .btn { border: none; padding: 10px 20px; border-radius: 6px; font-family: 'Prompt', sans-serif; font-size: 16px; cursor: pointer; color: #fff; font-weight: 600; }
    .btn-primary { background: #1a56db; } .btn-danger { background: #dc2626; }
    @media print{ .no-print { display: none !important; } body { background: none; } }
    </style></head><body>
    <div class="no-print" data-html2canvas-ignore="true">
        <button class="btn btn-danger" onclick="window.close()">ปิดหน้านี้</button>
        <button class="btn btn-primary" onclick="window.print()">พิมพ์อีกครั้ง</button>
    </div>
    <div class="receipt-half">
        <div class="header">
            <img src="${logo}" alt="Logo">
            <h2>สำเนาใบเสร็จรับเงินค่าธรรมเนียมขยะมูลฝอย</h2>
            <p style="margin:0;font-size:12px;color:#6b7280">${orgName}</p>
            <p style="margin:0;font-size:11px;color:#9ca3af">${orgAddress} ${orgPhone}</p>
        </div>
        <div class="info-grid">
            <div class="info-item"><div class="info-label">เลขที่ใบเสร็จ</div><div class="info-value">${payment.receipt_no || '-'}</div></div>
            <div class="info-item"><div class="info-label">วันที่</div><div class="info-value">${formatThaiDateFull(payment.date)}</div></div>
            <div class="info-item"><div class="info-label">ชื่อผู้ชำระ</div><div class="info-value">${payment.customer_name || '-'}</div></div>
            <div class="info-item"><div class="info-label">บ้านเลขที่</div><div class="info-value">${payment.house_no || '-'}</div></div>
            <div class="info-item"><div class="info-label">เดือนที่ชำระ</div><div class="info-value" style="font-size:12px;">${monthsText}</div></div>
            <div class="info-item"><div class="info-label">ช่องทางชำระ</div><div class="info-value">${payment.method || '-'}</div></div>
        </div>
        <div class="total">ยอดชำระ: ฿${typeof formatMoneyDecimal === 'function' ? formatMoneyDecimal(payment.amount) : payment.amount}</div>
        <div class="info-grid" style="grid-template-columns: 1fr 1fr;">
            <div class="info-item" style="text-align:center;">
                <div class="info-label" style="text-align:left;">เจ้าหน้าที่รับเงิน</div>
                ${staffSignatureHTML}
                <div class="info-value" style="font-size:11px;">( ${payment.staff || '-'} )<br><span style="font-weight:400;font-size:10px;">เจ้าหน้าที่ผู้รับเงิน</span></div>
            </div>
            <div></div>
        </div>
        <div class="footer"><p>เอกสารนี้ออกโดยระบบ GOOD GOV &mdash; ${orgName}</p></div>
    </div>
    </body></html>`;
    return htmlString;
}

// === สร้าง HTML ของ Slip ===
async function buildSlipHTML(payment) {
    var settings = JSON.parse(localStorage.getItem('waste_settings') || '{}');
    var orgName = settings.org_name || 'เทศบาลตำบล GOOD GOV';
    var orgLogo = settings.org_logo ? '<img src="' + settings.org_logo + '" class="org-logo-img" style="max-width:80px; margin-bottom:15px;">' : '';
    
    var staffSignatureHTML = '<div style="height:25px;"></div><div>(ลายมือชื่อ) ..........................................</div>';
    if (payment.staff && typeof supabaseClient !== 'undefined') {
        try {
            var { data, error } = await supabaseClient.from('waste_staff')
                .select('signature_image_url')
                .ilike('name', '%' + payment.staff.trim() + '%')
                .limit(1);
            
            if (data && data.length > 0 && data[0].signature_image_url) {
                staffSignatureHTML = '<img src="' + data[0].signature_image_url + '" class="staff-sign" style="height:80px; display:block; margin:15px auto;">';
            }
        } catch (e) {
            console.error('Failed to load staff signature', e);
        }
    }

    var thMonths = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    var dObj = new Date(payment.date || new Date());
    var dateFormatted = dObj.getDate() + ' ' + thMonths[dObj.getMonth()] + ' ' + (dObj.getFullYear() + 543);
    
    // Fallback if formatMonthsGroupedByYear doesn't exist
    var monthsText = '-';
    if (typeof formatMonthsGroupedByYear === 'function') {
        monthsText = formatMonthsGroupedByYear(payment.months_paid, true);
    } else if (payment.months_paid) {
        monthsText = Array.isArray(payment.months_paid) ? payment.months_paid.join(', ') : payment.months_paid;
    }

    return '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<style>@import url("https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;600&display=swap");' +
    'body{font-family:"Prompt",sans-serif;padding:20px 40px;font-size:18px;max-width:800px;margin:0 auto; line-height: 1.4;}' +
    '.center{text-align:center} h3{margin:10px 0;font-size:26px} hr{border:none;border-top:2px dashed #ccc;margin:10px 0}' +
    '.row{display:flex;justify-content:space-between;margin:5px 0;font-size:18px;} ' +
    '.total{font-size:32px;font-weight:700;color:#057a55;text-align:center;margin:20px 0}' +
    '.no-print { display: none !important; }' +
    '@media print { @page { size: A4 portrait; margin: 15mm; } body { padding: 0; } }' +
    '</style></head><body>' +
    '<div class="center">' + orgLogo + '<h3>ใบเสร็จค่าขยะมูลฝอย</h3><p style="margin:5px 0;font-size:16px">' + orgName + '</p></div><hr>' +
    '<div class="row"><span>เลขที่:</span><span>' + (payment.receipt_no || '-') + '</span></div>' +
    '<div class="row"><span>วันที่:</span><span>' + dateFormatted + '</span></div><hr>' +
    '<div class="row"><span>ชื่อ:</span><span>' + (payment.customer_name || '-') + '</span></div>' +
    '<div class="row"><span>บ้านเลขที่:</span><span>' + (payment.house_no || '-') + '</span></div>' +
    '<div class="row" style="align-items:flex-start;"><span>เดือน:</span><span style="text-align:right;">' + monthsText + '</span></div>' +
    '<div class="row"><span>ช่องทาง:</span><span>' + (payment.method || '-') + '</span></div><hr>' +
    '<div class="total">฿' + (typeof formatMoneyDecimal === 'function' ? formatMoneyDecimal(payment.amount) : payment.amount) + '</div><hr>' +
    '<div style="margin-top:20px;text-align:center;">' +
        staffSignatureHTML +
        '<div style="margin-top:5px; font-size: 16px;">(' + (payment.staff || '..........................................') + ')</div>' +
        '<div style="font-size:14px;margin-top:0px;">ผู้รับเงิน</div>' +
    '</div>' +
    '<div class="center" style="margin-top:10px;font-size:12px;color:#999">GOOD GOV System</div>' +
    '</body></html>';
}

// === อัปโหลดใบเสร็จไป Google Drive อัตโนมัติ ===
async function autoSaveReceiptToDrive(payment) {
    if (!GOOGLE_APPS_SCRIPT_URL) {
        console.warn('GOOGLE_APPS_SCRIPT_URL ยังไม่ได้ตั้งค่า — ข้ามการอัปโหลด');
        return null;
    }

    async function htmlToImageBase64(htmlString, width, height) {
        return new Promise((resolve, reject) => {
            if (typeof html2canvas === 'undefined') {
                reject(new Error("html2canvas is not loaded. Cannot convert to image."));
                return;
            }
            var iframe = document.createElement('iframe');
            iframe.style.position = 'absolute';
            iframe.style.top = '-9999px';
            iframe.style.left = '-9999px';
            iframe.style.width = width + 'px';
            iframe.style.height = (height || 10) + 'px'; 
            document.body.appendChild(iframe);
            
            iframe.contentWindow.document.open();
            iframe.contentWindow.document.write(htmlString);
            iframe.contentWindow.document.close();
            
            if (height) {
                iframe.contentWindow.document.body.style.minHeight = height + 'px';
                iframe.contentWindow.document.body.style.backgroundColor = '#ffffff';
            }
            
            // Wait a bit for external images (logo, signature) to load
            setTimeout(() => {
                var contentHeight = height || iframe.contentWindow.document.documentElement.scrollHeight;
                iframe.style.height = contentHeight + 'px'; // Resize iframe to exact content height
                var options = {
                    useCORS: true,
                    scale: 2,
                    windowWidth: width,
                    windowHeight: contentHeight,
                    height: contentHeight
                };
                html2canvas(iframe.contentWindow.document.body, options).then(canvas => {
                    var base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
                    document.body.removeChild(iframe);
                    resolve(base64);
                }).catch(e => {
                    document.body.removeChild(iframe);
                    reject(e);
                });
            }, 1000);
        });
    }

    var a4Html = await buildReceiptHTML(payment);
    var slipHtml = await buildSlipHTML(payment);
    
    var baseName = (payment.receipt_no || payment.id).replace(/[\/\\]/g, '-');
    var settings = JSON.parse(localStorage.getItem('waste_settings') || '{}');
    var orgPrefix = settings.org_name ? settings.org_name.replace(/\s+/g, '_') : 'Org';

    try {
        var a4Base64 = await htmlToImageBase64(a4Html, 794); // A4 width at 96 DPI, height auto-crops to content
        var slipBase64 = await htmlToImageBase64(slipHtml, 794); // Slip width (A4 width)

        var response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                files: [
                    {
                        key: 'receipt',
                        name: orgPrefix + '_Receipt_' + baseName + '.jpg',
                        mimeType: 'image/jpeg',
                        base64: a4Base64
                    },
                    {
                        key: 'slip',
                        name: orgPrefix + '_slip_' + baseName + '.jpg',
                        mimeType: 'image/jpeg',
                        base64: slipBase64
                    }
                ]
            })
        });

        var result = await response.json();

        if (result.success && result.urls) {
            const receiptUrl = result.urls.receipt;
            const slipUrl = result.urls.slip;
            
            console.log('✅ อัปโหลดไป Drive สำเร็จ:', result.urls);

            // บันทึก URL ลง Supabase
            if (typeof supabaseClient !== 'undefined' && supabaseClient) {
                var updateData = { receipt_url: receiptUrl };
                if (slipUrl) {
                    updateData.slip_url = slipUrl;
                }
                await supabaseClient.from('waste_payments').update(updateData).eq('id', payment.id);
            }

            // บันทึก URL ลง localStorage ด้วย
            var payments = JSON.parse(localStorage.getItem('waste_payments') || '[]');
            var idx = payments.findIndex(function (x) { return x.id === payment.id; });
            if (idx >= 0) {
                payments[idx].receipt_url = receiptUrl;
                if (slipUrl) payments[idx].slip_url = slipUrl;
                localStorage.setItem('waste_payments', JSON.stringify(payments));
            }

            return { receiptUrl, slipUrl };
        } else {
            var errMsg1 = result.error || 'Apps Script returned success: false';
            console.warn('❌ อัปโหลด Drive ล้มเหลว:', errMsg1);
            if (typeof Swal !== 'undefined') Swal.fire('อัปโหลด Drive ล้มเหลว', String(errMsg1), 'error');
            return { error: errMsg1 };
        }
    } catch (err) {
        console.warn('❌ อัปโหลด Drive error:', err.message);
        if (typeof Swal !== 'undefined') Swal.fire('เกิดข้อผิดพลาดในการอัปโหลด Drive', err.message, 'error');
        return { error: err.message };
    }
}

// === ดาวน์โหลดใบเสร็จ + เปิด Drive folder (manual) ===
async function saveReceiptToDrive(paymentId) {
    var payments = getWastePayments();
    var p = payments.find(function (x) { return x.id === paymentId; });
    if (!p) { showToast('ไม่พบข้อมูลใบเสร็จ', 'error'); return; }

    // ถ้ามี Apps Script URL → อัปโหลดอัตโนมัติ
    if (GOOGLE_APPS_SCRIPT_URL) {
        Swal.fire({ title: 'กำลังอัปโหลดไป Drive...', allowOutsideClick: false, didOpen: function () { Swal.showLoading(); } });
        autoSaveReceiptToDrive(p).then(function (res) {
            if (res && res.receiptUrl) {
                var html = '<p>ใบเสร็จ <b>' + p.receipt_no + '</b> ถูกบันทึกลง Google Drive แล้ว</p>';
                if (res.receiptUrl) html += '<a href="' + res.receiptUrl + '" target="_blank" class="btn btn-sm btn-primary mt-2 me-2"><i class="fa-brands fa-google-drive me-1"></i> A4</a>';
                if (res.slipUrl) html += '<a href="' + res.slipUrl + '" target="_blank" class="btn btn-sm btn-success mt-2"><i class="fa-brands fa-google-drive me-1"></i> Slip</a>';
                
                Swal.fire({
                    title: 'อัปโหลดสำเร็จ!',
                    html: html,
                    icon: 'success'
                });
            } else {
                var errInfo = res && res.error ? String(res.error) : 'ไม่มีการส่ง URL กลับมา หรือเกิดข้อผิดพลาดในการเชื่อมต่อ (อาจจะติด Block 3rd party cookie/CORS)';
                Swal.fire({
                    title: 'อัปโหลดล้มเหลว',
                    html: '<p>ไม่สามารถอัปโหลดได้ กรุณาลองใหม่</p><p style="color:red; font-size:14px; margin-top:10px;">' + errInfo + '</p>',
                    icon: 'error'
                });
            }
        });
        return;
    }

    // Fallback: ดาวน์โหลดไฟล์ + เปิด Drive folder
    var html = await buildReceiptHTML(p);
    var blob = new Blob([html], { type: 'text/html' });
    var fileName = 'receipt_' + (p.receipt_no || p.id).replace(/[\/\\]/g, '-') + '.html';

    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);

    Swal.fire({
        title: 'ดาวน์โหลดใบเสร็จสำเร็จ!',
        html: '<p><i class="fa-solid fa-check-circle text-success me-1"></i> ไฟล์ <b>' + fileName + '</b></p>' +
            '<p class="text-muted" style="font-size:13px;">คลิกเพื่อเปิดโฟลเดอร์ Drive แล้วลากไฟล์วาง</p>',
        icon: 'success',
        showCancelButton: true,
        confirmButtonText: '<i class="fa-brands fa-google-drive me-1"></i> เปิด Drive',
        cancelButtonText: 'ปิด',
        confirmButtonColor: '#1a56db'
    }).then(function (r) {
        if (r.isConfirmed) window.open(RECEIPT_DRIVE_FOLDER, '_blank');
    });
}

// === ดูใบเสร็จย้อนหลัง ===
async function viewReceipt(paymentId) {
    var payments = getWastePayments();
    var p = payments.find(function (x) { return x.id === paymentId; });
    if (!p) { showToast('ไม่พบข้อมูลใบเสร็จ', 'error'); return; }

    // ถ้ามี receipt_url (จาก Drive) ให้เปิด URL นั้น
    if (p.receipt_url && p.receipt_url.startsWith('http')) {
        window.open(p.receipt_url, '_blank');
        return;
    }

    // สร้างใหม่แล้วแสดง
    var html = await buildReceiptHTML(p);
    var w = window.open('', '_blank', 'width=800,height=700');
    w.document.write(html);
    w.document.close();
    
    // Auto-print after a short delay
    setTimeout(function() {
        w.print();
    }, 500);
}
