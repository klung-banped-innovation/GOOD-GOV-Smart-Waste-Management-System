/**
 * waste-backup.js — Backup and Restore functionality for Waste System
 */

async function backupDatabaseToDrive() {
    const backupUrl = document.getElementById('gasBackupUrl').value.trim();
    if (!backupUrl) {
        Swal.fire('ข้อผิดพลาด', 'กรุณาระบุ URL ของ Google Apps Script (สำหรับการสำรองข้อมูล) ก่อนทำรายการ', 'warning');
        return;
    }

    // Confirm
    const confirm = await Swal.fire({
        title: 'ยืนยันการสำรองข้อมูล',
        text: "ระบบจะดึงข้อมูลลูกหนี้และการชำระเงินทั้งหมดไปเก็บไว้ที่ Google Drive เป็นไฟล์ .json",
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'สำรองข้อมูล',
        cancelButtonText: 'ยกเลิก'
    });

    if (!confirm.isConfirmed) return;

    Swal.fire({ title: 'กำลังรวบรวมข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        // Fetch all data from Supabase tables
        const backupData = {
            timestamp: new Date().toISOString(),
            tables: {}
        };

        const tablesToBackup = [
            'waste_settings', 
            'waste_customers',
            'waste_customer_line_links',
            'waste_monthly_status',
            'waste_payments', 
            'waste_exemptions',
            'waste_fee_history',
            'waste_fee_types',
            'waste_staff',
            'waste_register_requests',
            'waste_cancel_requests'
        ];
        
        for (const table of tablesToBackup) {
            Swal.update({ text: `กำลังโหลด ${table}...` });
            // ดึงข้อมูลทั้งหมดในแต่ละตาราง (limit 50000 เพื่อความแน่ใจว่าดึงมาหมด)
            const { data, error } = await supabaseClient.from(table).select('*').limit(50000);
            if (error) {
                if (error.message && error.message.includes("Could not find the table")) {
                    console.warn(`Table ${table} not found, skipping.`);
                    backupData.tables[table] = [];
                } else {
                    throw error;
                }
            } else {
                backupData.tables[table] = data || [];
            }
        }

        Swal.fire({ title: 'กำลังอัปโหลด...', text: 'กำลังส่งไฟล์ไปยัง Google Drive โปรดรอสักครู่...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        // Post to GAS
        const response = await fetch(backupUrl, {
            method: 'POST',
            body: JSON.stringify(backupData),
            mode: 'no-cors',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8' // Use text/plain for no-cors to avoid preflight
            }
        });

        // Since we use no-cors, we assume success if fetch resolves without throwing network error
        Swal.fire({
            icon: 'success',
            title: 'สำรองข้อมูลสำเร็จ',
            text: 'ข้อมูลทั้งหมดถูกบันทึกไปยัง Google Drive ของคุณเรียบร้อยแล้ว'
        });

    } catch (error) {
        console.error(error);
        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถสำรองข้อมูลได้: ' + error.message, 'error');
    }
}

async function restoreDatabase() {
    const fileInput = document.getElementById('restoreFile');
    if (!fileInput.files || fileInput.files.length === 0) {
        Swal.fire('ข้อผิดพลาด', 'กรุณาเลือกไฟล์ Backup (.json) ก่อน', 'warning');
        return;
    }

    const file = fileInput.files[0];
    
    // Confirm
    const confirm = await Swal.fire({
        title: 'ยืนยันการกู้คืนข้อมูล?',
        text: "คำเตือน: ข้อมูลในระบบจะถูกแทนที่ด้วยข้อมูลจากไฟล์นี้ทั้งหมด และไม่สามารถย้อนกลับได้!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'ใช่, กู้คืนเลย!',
        cancelButtonText: 'ยกเลิก'
    });

    if (!confirm.isConfirmed) return;

    Swal.fire({ title: 'กำลังอ่านไฟล์...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const text = await file.text();
        const backupData = JSON.parse(text);

        if (!backupData || !backupData.tables) {
            throw new Error("รูปแบบไฟล์ไม่ถูกต้อง หรือไม่ใช่ไฟล์ Backup ของระบบนี้");
        }

        Swal.fire({ title: 'กำลังกู้คืนข้อมูล...', text: 'โปรดอย่าปิดหน้าต่างนี้ การกู้คืนอาจใช้เวลาสักครู่', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        // Restore order matters for foreign keys: settings -> customers -> status -> receipts -> payments
        const tablesToRestore = [
            'waste_settings', 
            'waste_fee_types',
            'waste_staff',
            'waste_customers',
            'waste_customer_line_links',
            'waste_fee_history',
            'waste_exemptions',
            'waste_payments', 
            'waste_monthly_status',
            'waste_register_requests',
            'waste_cancel_requests'
        ];
        
        // Step 1: Clear existing data in reverse order to respect foreign key constraints
        const deleteOrder = [...tablesToRestore].reverse();
        for (const table of deleteOrder) {
            if (backupData.tables[table] && backupData.tables[table].length > 0) {
                Swal.update({ text: `กำลังล้างข้อมูลเก่าในตาราง ${table}...` });
                // We delete all rows that have an id not null (which is practically all rows)
                const { error: delError } = await supabaseClient.from(table).delete().not('id', 'is', null);
                if (delError) {
                    console.warn(`Could not clear table ${table} before restore:`, delError);
                }
            }
        }

        // Step 2: Insert backup data
        for (const table of tablesToRestore) {
            if (backupData.tables[table] && backupData.tables[table].length > 0) {
                Swal.update({ text: `กำลังกู้คืนตาราง ${table}...` });
                
                // Supabase upsert automatically matches on Primary Key (e.g. id)
                const { error } = await supabaseClient.from(table).upsert(backupData.tables[table]);
                if (error) {
                    if (error.message && error.message.includes("Could not find the table")) {
                        console.warn(`Table ${table} not found, skipping restore.`);
                    } else {
                        console.error(`Error restoring table ${table}:`, error);
                        throw error;
                    }
                }
            }
        }

        Swal.fire({
            icon: 'success',
            title: 'กู้คืนข้อมูลสำเร็จ',
            text: 'ข้อมูลของคุณถูกกู้คืนกลับมาเรียบร้อยแล้ว'
        }).then(() => {
            window.location.reload();
        });

    } catch (error) {
        console.error(error);
        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถกู้คืนข้อมูลได้: ' + error.message, 'error');
    }
}
