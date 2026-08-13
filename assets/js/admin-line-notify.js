// admin-line-notify.js
// Handles manual LINE notifications from the Admin UI

async function showLineNotifyModal(customerId, notifyType, overrideAmount = null, overrideReceipt = null, overridePaymentId = null) {
    if (!customerId) return;
    
    // Find the customer from the global scope of waste-payment.js
    let customer = typeof getWasteCustomers === 'function' ? getWasteCustomers().find(c => c.id === customerId) : null;
    
    if (!customer) {
        try {
            const { data, error } = await supabaseClient.from('waste_customers').select('*').eq('id', customerId).single();
            if (data) customer = data;
        } catch (e) {
            console.error(e);
        }
    }
    
    if (!customer) {
        Swal.fire('ข้อผิดพลาด', 'ไม่พบข้อมูลลูกค้า', 'error');
        return;
    }

    // Set basic info
    document.getElementById('lineNotifyCustomerId').textContent = customer.id;
    document.getElementById('lineNotifyCustomerName').textContent = customer.name;
    document.getElementById('lineNotifyHouseNo').textContent = `${customer.house_no} ม.${customer.moo}`;
    
    document.getElementById('lineNotifyType').value = notifyType;
    document.getElementById('lineNotifyPaymentId').value = overridePaymentId || '';
    document.getElementById('lineNotifyReceiptNo').value = overrideReceipt || '';

    const titleEl = document.getElementById('lineNotifyTitle');
    const alertEl = document.getElementById('lineNotifyAlertInfo');
    const amountEl = document.getElementById('lineNotifyAmount');

    // Calculate amount based on type
    let amount = 0;
    if (notifyType === 'PAYMENT_SUCCESS') {
        titleEl.innerHTML = '<i class="fa-solid fa-file-invoice-dollar text-success me-2"></i>แจ้งชำระเงินสำเร็จ';
        alertEl.style.background = '#f0fdf4';
        
        if (overrideAmount !== null) {
            amount = parseFloat(overrideAmount);
        } else {
            // Try to find the latest payment if it exists in the UI context
            amount = typeof document !== 'undefined' ? parseFloat(document.getElementById('totalAmount')?.value || 0) : 0;
            
            // If there's an active receipt generated in the modal
            const receiptNoEl = document.getElementById('swalReceiptNo');
            if (receiptNoEl) {
                document.getElementById('lineNotifyReceiptNo').value = receiptNoEl.value;
            }
        }
    } else if (notifyType === 'OVERDUE') {
        titleEl.innerHTML = '<i class="fa-solid fa-circle-exclamation text-danger me-2"></i>แจ้งค้างชำระ';
        alertEl.style.background = '#fef2f2';
        
        // Calculate overdue amount
        if (typeof customerStatus !== 'undefined' && typeof selectedYear !== 'undefined') {
            const statusObj = customerStatus[selectedYear] || {};
            const WASTE_MONTH_KEYS = ['oct','nov','dec','jan','feb','mar','apr','may','jun','jul','aug','sep'];
            let unpaidMonths = 0;
            WASTE_MONTH_KEYS.forEach(mk => {
                if (statusObj[mk] !== 'paid' && statusObj[mk] !== 'exempted') {
                    unpaidMonths++;
                }
            });
            amount = unpaidMonths * (parseFloat(customer.fee) || 0);
        } else {
            // Fallback
            amount = parseFloat(customer.fee) || 0; 
        }
    }
    
    amountEl.textContent = formatMoneyDecimal(amount);

    // Show modal & loading state
    document.getElementById('lineNotifyCountText').textContent = 'กำลังโหลด...';
    document.getElementById('lineNotifyCountBadge').textContent = '-';
    document.getElementById('lineNotifyPreviousStatus').innerHTML = '';
    
    const modal = new bootstrap.Modal(document.getElementById('lineNotifyModal'));
    modal.show();
    
    // Fetch active LINE links
    try {
        const { data: links, error } = await supabaseClient
            .from('waste_customer_line_links')
            .select('id, line_user_id')
            .eq('customer_id', customerId)
            .eq('status', 'active');
            
        if (error) throw error;
        
        const count = links ? links.length : 0;
        document.getElementById('lineNotifyCountBadge').textContent = count;
        
        if (count === 0) {
            document.getElementById('lineNotifyCountText').innerHTML = '<span class="text-danger">ลูกค้านี้ยังไม่ได้เชื่อมโยง LINE</span>';
            document.getElementById('btnSendLineNotify').disabled = true;
        } else {
            document.getElementById('lineNotifyCountText').textContent = `พบ ${count} บัญชีที่รับแจ้งเตือนได้`;
            document.getElementById('btnSendLineNotify').disabled = false;
        }
        
        // Check previous notifications to prevent accidental double sending
        const { data: history, error: historyErr } = await supabaseClient
            .from('waste_line_notifications')
            .select('sent_at, status')
            .eq('customer_id', customerId)
            .eq('notification_type', notifyType)
            .order('created_at', { ascending: false })
            .limit(1);
            
        if (!historyErr && history && history.length > 0) {
            const last = history[0];
            let statusBadge = last.status === 'sent' ? '<span class="badge bg-success">สำเร็จ</span>' : '<span class="badge bg-danger">ล้มเหลว</span>';
            let timeStr = last.sent_at ? new Date(last.sent_at).toLocaleString('th-TH') : 'ไม่ระบุเวลา';
            
            document.getElementById('lineNotifyPreviousStatus').innerHTML = 
                `<div class="alert alert-warning py-2 mb-0 border-0"><i class="fa-solid fa-clock-rotate-left me-1"></i> ส่งล่าสุด: ${timeStr} (${statusBadge})</div>`;
        }

    } catch (err) {
        console.error("Error fetching LINE links", err);
        document.getElementById('lineNotifyCountText').innerHTML = '<span class="text-danger">เกิดข้อผิดพลาดในการตรวจสอบ</span>';
        document.getElementById('btnSendLineNotify').disabled = true;
    }
}

async function sendLineNotification() {
    const customerId = document.getElementById('lineNotifyCustomerId').textContent;
    const notifyType = document.getElementById('lineNotifyType').value;
    const amountStr = document.getElementById('lineNotifyAmount').textContent.replace(/,/g, '');
    const receiptNo = document.getElementById('lineNotifyReceiptNo').value;
    const customerName = document.getElementById('lineNotifyCustomerName').textContent;
    const houseNo = document.getElementById('lineNotifyHouseNo').textContent;
    const paymentId = document.getElementById('lineNotifyPaymentId').value;
    
    const btn = document.getElementById('btnSendLineNotify');
    const originalText = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>กำลังส่งข้อความ...';
    
    try {
        const payload = {
            customer_id: customerId,
            notification_type: notifyType,
            amount: parseFloat(amountStr) || 0,
            customer_name: customerName,
            house_no: houseNo,
            receipt_no: receiptNo,
            payment_id: paymentId || undefined
        };
        
        // Call Supabase Edge Function
        const { data, error } = await supabaseClient.functions.invoke('waste-line-notify', {
            body: payload
        });
        
        if (error) {
            throw error;
        }
        
        Swal.fire({
            title: 'ส่งแจ้งเตือนสำเร็จ',
            text: `ส่งข้อความไปยัง ${data.total_linked || 0} บัญชีแล้ว`,
            icon: 'success',
            confirmButtonText: 'ตกลง'
        }).then(() => {
            const modalEl = document.getElementById('lineNotifyModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if(modal) modal.hide();
        });
        
    } catch (err) {
        console.error("Error sending LINE notification", err);
        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถส่งแจ้งเตือนได้: ' + (err.message || ''), 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}
