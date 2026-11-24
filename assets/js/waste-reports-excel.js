// ============================================
// EXCEL REPORTS GENERATOR using SheetJS
// ============================================

function formatPaymentMethodExcel(method) {
    if (!method) return '-';
    var m = String(method).trim();
    if (m === 'โอน') return 'เงินโอน';
    return m;
}

function exportDailyExcel() {
    var filterDate = document.getElementById('filterDate').value;
    if (!filterDate) { Swal.fire('กรุณาเลือกวันที่', '', 'warning'); return; }

    var payments = typeof getWastePayments === 'function' ? getWastePayments() : [];
    var customers = typeof getWasteCustomers === 'function' ? getWasteCustomers() : [];
    var todayPayments = payments.filter(function(p) { return p.date === filterDate && p.status === 'completed'; });

    if (todayPayments.length === 0) {
        Swal.fire('ไม่มีข้อมูล', 'ไม่มีรายการชำระสำหรับวันที่เลือก', 'warning');
        return;
    }

    var rows = [];
    todayPayments.forEach(function(p, idx) {
        var cust = customers.find(function(c){ return c.id === p.customer_id; });
        var houseNo = p.house_no || (cust ? cust.house_no : '-');
        var moo = cust ? cust.moo : '-';
        var monthsPaid = Array.isArray(p.months_paid) ? p.months_paid : [p.months_paid || '-'];
        var feePerMonth = cust ? cust.fee : (monthsPaid.length > 0 ? Math.round(p.amount / monthsPaid.length) : p.amount);

        var rowTotal = p.amount;
        var cats = typeof calculatePaymentCategories === 'function'
            ? calculatePaymentCategories(p.date, monthsPaid, feePerMonth, rowTotal)
            : { debt: 0, regular: rowTotal, advance: 0 };

        rows.push({
            'ลำดับ': idx + 1,
            'เลขที่ใบเสร็จ': p.receipt_no || '-',
            'ชื่อลูกค้า': p.customer_name || '-',
            'บ้านเลขที่': houseNo,
            'หมู่ที่': moo,
            'รับชำระลูกหนี้': cats.debt,
            'รับปกติ': cats.regular,
            'รับล่วงหน้า': cats.advance,
            'วิธีชำระ': formatPaymentMethodExcel(p.method),
            'รวม': rowTotal
        });
    });

    var ws = XLSX.utils.json_to_sheet(rows);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "รายงานรายวัน");
    XLSX.writeFile(wb, "รายงานรายวัน_" + filterDate + ".xlsx");
}

function exportMonthlyExcel() {
    var filterYear = document.getElementById('filterYear').value;
    if (!filterYear) { Swal.fire('กรุณาเลือกปีงบประมาณ', '', 'warning'); return; }

    var msData = typeof getMonthlyStatus === 'function' ? getMonthlyStatus() : {};
    var customers = typeof getWasteCustomers === 'function' ? getWasteCustomers() : [];

    var rows = [];
    var WASTE_MONTHS_EXT = ['ตุลาคม','พฤศจิกายน','ธันวาคม','มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน'];
    var WASTE_MONTH_KEYS_EXT = ['oct','nov','dec','jan','feb','mar','apr','may','jun','jul','aug','sep'];
    
    WASTE_MONTHS_EXT.forEach(function(m, i) {
        var mk = WASTE_MONTH_KEYS_EXT[i];
        var monthTotal = 0;
        var monthPayers = 0;

        Object.keys(msData).forEach(function(cid) {
            if (msData[cid][filterYear] && msData[cid][filterYear][mk] === 'paid') {
                var cust = customers.find(function(c){ return c.id === cid; });
                monthTotal += cust ? (Number(cust.fee) || 0) : 0;
                monthPayers++;
            }
        });

        var fyNum = parseInt(filterYear);
        var calYear = i < 3 ? fyNum - 1 : fyNum;
        
        var thaiMonthsList = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
        var fullMonthName = thaiMonthsList[i < 3 ? i + 9 : i - 3] + ' ' + calYear;

        rows.push({
            'ลำดับ': i + 1,
            'เดือน': fullMonthName,
            'จำนวนผู้ชำระ': monthPayers,
            'ยอดรวม (บาท)': monthTotal
        });
    });

    var ws = XLSX.utils.json_to_sheet(rows);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "รายงานรายเดือน");
    XLSX.writeFile(wb, "รายงานรายเดือน_ปี" + filterYear + ".xlsx");
}

function exportAllExcel() {
    var payments = typeof getWastePayments === 'function' ? getWastePayments() : [];
    var customers = typeof getWasteCustomers === 'function' ? getWasteCustomers() : [];
    var allPayments = window.currentFilteredAllPayments || payments.filter(function(p) { return p.status === 'completed'; });

    var rows = [];
    if (allPayments.length === 0) {
        Swal.fire('ไม่มีข้อมูล', 'ไม่มีรายการชำระในระบบ', 'warning');
        return;
    }

    allPayments.forEach(function(p, idx) {
        var cust = customers.find(function(c){ return c.id === p.customer_id; });
        var houseNo = p.house_no || (cust ? cust.house_no : '-');
        var moo = cust ? cust.moo : '-';
        var monthsPaid = Array.isArray(p.months_paid) ? p.months_paid : [p.months_paid || '-'];
        var feePerMonth = cust ? cust.fee : (monthsPaid.length > 0 ? Math.round(p.amount / monthsPaid.length) : p.amount);

        var rowTotal = p.amount;
        var cats = typeof calculatePaymentCategories === 'function'
            ? calculatePaymentCategories(p.date, monthsPaid, feePerMonth, rowTotal)
            : { debt: 0, regular: rowTotal, advance: 0 };

        rows.push({
            'ลำดับ': idx + 1,
            'วันที่': p.date,
            'เลขที่ใบเสร็จ': p.receipt_no || '-',
            'ชื่อลูกค้า': p.customer_name || '-',
            'บ้านเลขที่': houseNo,
            'หมู่ที่': moo,
            'รับชำระลูกหนี้': cats.debt,
            'รับปกติ': cats.regular,
            'รับล่วงหน้า': cats.advance,
            'วิธีชำระ': formatPaymentMethodExcel(p.method),
            'รวม': rowTotal
        });
    });

    var ws = XLSX.utils.json_to_sheet(rows);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "รายงานรายรับทั้งหมด");
    XLSX.writeFile(wb, "รายงานรายรับทั้งหมด.xlsx");
}

function exportCurrentTabExcel() {
    var allTab = document.querySelector('#tabAll');
    var dailyTab = document.querySelector('#tabDaily');
    var monthlyTab = document.querySelector('#tabMonthly');

    if (allTab && allTab.classList.contains('active')) {
        exportAllExcel();
    } else if (dailyTab && dailyTab.classList.contains('active')) {
        exportDailyExcel();
    } else if (monthlyTab && monthlyTab.classList.contains('active')) {
        exportMonthlyExcel();
    } else {
        Swal.fire({
            title: 'เลือกรายงานที่ต้องการ',
            icon: 'question',
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: 'รายงานทั้งหมด',
            denyButtonText: 'รายงานรายเดือน',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#1a56db',
            denyButtonColor: '#059669'
        }).then(function(result) {
            if (result.isConfirmed) {
                exportAllExcel();
            } else if (result.isDenied) {
                exportMonthlyExcel();
            }
        });
    }
}
