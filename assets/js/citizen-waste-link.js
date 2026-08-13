// citizen-waste-link.js
// Handles linking waste customers to LINE users

let selectedCustomersToLink = [];
let searchTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
    loadLinkedCustomers();
    populateSearchMooDropdown();
});

function populateSearchMooDropdown() {
    const mooSelect = document.getElementById('searchMoo');
    if (mooSelect) {
        for (let i = 1; i <= 23; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.text = `หมู่ ${i}`;
            mooSelect.appendChild(option);
        }
    }
}

async function loadLinkedCustomers() {
    const listContainer = document.getElementById('linkedCustomersList');
    if (!listContainer) return;

    const session = LineAuth.getSession();
    if (!session || !session.lineUserId) {
        listContainer.innerHTML = '<div class="text-center text-danger">กรุณาเข้าสู่ระบบใหม่</div>';
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('waste_customer_line_links')
            .select(`
                id, status,
                waste_customers ( id, name, house_no, moo, subdistrict )
            `)
            .eq('line_user_id', session.lineUserId)
            .eq('status', 'active');

        if (error) throw error;

        if (!data || data.length === 0) {
            listContainer.innerHTML = `
                <div class="text-center text-muted py-3">
                    <i class="fa-solid fa-link-slash mb-2" style="font-size: 2rem; opacity: 0.5;"></i>
                    <p class="mb-0 text-sm">ยังไม่มีข้อมูลที่เชื่อมโยง</p>
                </div>
            `;
            
            // Force link modal
            forceLinkModalOpen();
            return;
        }

        // Enable closing if they have links
        allowLinkModalClose();

        let html = '';
        data.forEach(link => {
            const c = link.waste_customers;
            if (!c) return;
            html += `
                <div class="d-flex justify-content-between align-items-center mb-2 p-2 border rounded bg-white shadow-sm">
                    <div>
                        <div class="fw-bold text-dark" style="font-size: 0.95rem;">${c.name}</div>
                        <div class="text-muted" style="font-size: 0.85rem;"><i class="fa-solid fa-location-dot me-1"></i>บ้านเลขที่ ${c.house_no} ม.${c.moo || '-'} ${c.subdistrict || ''}</div>
                    </div>
                    <button class="btn btn-sm btn-outline-danger rounded-pill" onclick="unlinkCustomer('${link.id}', '${c.name}')" title="ยกเลิกเชื่อมโยง">
                        <i class="fa-solid fa-unlink"></i>
                    </button>
                </div>
            `;
        });
        
        if (html === '') {
            listContainer.innerHTML = '<div class="text-center text-muted py-3">ไม่มีข้อมูล</div>';
            forceLinkModalOpen();
        } else {
            listContainer.innerHTML = html;
        }

    } catch (err) {
        console.error("Error loading linked customers", err);
        listContainer.innerHTML = '<div class="text-center text-danger">โหลดข้อมูลล้มเหลว</div>';
    }
}

function forceLinkModalOpen() {
    const modalEl = document.getElementById('linkCustomerModal');
    if (modalEl) {
        // Prevent closing
        modalEl.setAttribute('data-bs-backdrop', 'static');
        modalEl.setAttribute('data-bs-keyboard', 'false');
        const closeBtn = document.getElementById('linkModalCloseBtn');
        if (closeBtn) closeBtn.style.display = 'none';

        // Show modal if not open
        const modalInstance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl, {
            backdrop: 'static',
            keyboard: false
        });
        modalInstance.show();
    }
}

function allowLinkModalClose() {
    const modalEl = document.getElementById('linkCustomerModal');
    if (modalEl) {
        modalEl.setAttribute('data-bs-backdrop', 'true');
        modalEl.setAttribute('data-bs-keyboard', 'true');
        const closeBtn = document.getElementById('linkModalCloseBtn');
        if (closeBtn) closeBtn.style.display = 'block';
    }
}

async function searchCustomersForLinking(mode) {
    const resultDiv = document.getElementById('linkCustomerSearchResults');
    let query = supabaseClient.from('waste_customers').select('id, name, house_no, moo, subdistrict, status').eq('status', 'active');
    
    if (mode === 'house') {
        const houseNo = document.getElementById('searchHouseNo').value.trim();
        const moo = document.getElementById('searchMoo').value;
        if (!houseNo && !moo) {
            resultDiv.innerHTML = '<div class="text-center text-warning py-3">กรุณาระบุบ้านเลขที่หรือหมู่</div>';
            return;
        }
        if (houseNo) query = query.ilike('house_no', `%${houseNo}%`);
        if (moo) query = query.eq('moo', moo);
    } else if (mode === 'name') {
        const input = document.getElementById('searchCustomerToLink').value.trim();
        if (!input) {
            resultDiv.innerHTML = '<div class="text-center text-muted py-3">กรุณาพิมพ์เพื่อค้นหา</div>';
            return;
        }
        query = query.or(`id.ilike.%${input}%,name.ilike.%${input}%`);
    }

    resultDiv.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-success spinner-border-sm"></div> ค้นหา...</div>';

    try {
        const { data, error } = await query.limit(10);
            
        if (error) throw error;

        if (!data || data.length === 0) {
            resultDiv.innerHTML = '<div class="text-center text-muted py-3">ไม่พบข้อมูล หรือบัญชีไม่ทำงาน</div>';
            return;
        }

        renderSearchResults(data);
    } catch (err) {
        console.error("Search error", err);
        resultDiv.innerHTML = '<div class="text-center text-danger py-3">เกิดข้อผิดพลาดในการค้นหา</div>';
    }
}

function searchByNameInstant() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        searchCustomersForLinking('name');
    }, 400); // Debounce 400ms
}

function renderSearchResults(data) {
    const resultDiv = document.getElementById('linkCustomerSearchResults');
    let html = '<div class="list-group list-group-flush">';
    
    data.forEach(c => {
        const isSelected = selectedCustomersToLink.some(sel => sel.id === c.id);
        const btnClass = isSelected ? 'btn-secondary' : 'btn-outline-success';
        const btnText = isSelected ? '<i class="fa-solid fa-check"></i> เลือกแล้ว' : 'เลือก';
        const cJson = JSON.stringify(c).replace(/"/g, '&quot;');
        
        html += `
            <div class="list-group-item d-flex justify-content-between align-items-center px-2 py-3">
                <div>
                    <div class="fw-bold text-dark">${c.name} <span class="badge bg-light text-dark ms-1 border">${c.id}</span></div>
                    <div class="text-muted text-sm"><i class="fa-solid fa-house-chimney me-1"></i>บ้านเลขที่ ${c.house_no} ม.${c.moo || '-'} ${c.subdistrict || ''}</div>
                </div>
                <button class="btn btn-sm ${btnClass} rounded-pill px-3" id="btn-select-${c.id}" onclick="toggleSelection(${cJson})">${btnText}</button>
            </div>
        `;
    });
    html += '</div>';
    resultDiv.innerHTML = html;
}

function toggleSelection(customer) {
    const index = selectedCustomersToLink.findIndex(sel => sel.id === customer.id);
    if (index === -1) {
        selectedCustomersToLink.push(customer);
    } else {
        selectedCustomersToLink.splice(index, 1);
    }
    
    // Update button in search results if visible
    const btn = document.getElementById(`btn-select-${customer.id}`);
    if (btn) {
        if (index === -1) {
            btn.className = 'btn btn-sm btn-secondary rounded-pill px-3';
            btn.innerHTML = '<i class="fa-solid fa-check"></i> เลือกแล้ว';
        } else {
            btn.className = 'btn btn-sm btn-outline-success rounded-pill px-3';
            btn.innerHTML = 'เลือก';
        }
    }
    
    renderSelectedBasket();
}

function renderSelectedBasket() {
    const basket = document.getElementById('selectedCustomersBasket');
    const badge = document.getElementById('selectedCountBadge');
    const confirmBtn = document.getElementById('confirmLinkBtn');
    
    badge.innerText = selectedCustomersToLink.length;
    confirmBtn.disabled = selectedCustomersToLink.length === 0;
    
    if (selectedCustomersToLink.length === 0) {
        basket.innerHTML = '<div class="text-center text-muted py-3 text-sm">ยังไม่ได้เลือกผู้ชำระ</div>';
        return;
    }
    
    let html = '';
    selectedCustomersToLink.forEach(c => {
        html += `
            <div class="d-flex justify-content-between align-items-center mb-2 bg-white p-2 rounded border">
                <div>
                    <div class="fw-bold text-success text-sm">${c.name}</div>
                    <div class="text-muted" style="font-size:0.75rem;">บ้านเลขที่ ${c.house_no} ม.${c.moo || '-'}</div>
                </div>
                <button class="btn btn-sm text-danger p-1" onclick='toggleSelection(${JSON.stringify(c).replace(/"/g, '&quot;')})'><i class="fa-solid fa-times"></i></button>
            </div>
        `;
    });
    basket.innerHTML = html;
}

async function confirmMultiLinking() {
    if (selectedCustomersToLink.length === 0) return;
    
    const session = LineAuth.getSession();
    if (!session || !session.lineUserId) {
        Swal.fire('ข้อผิดพลาด', 'กรุณาเข้าสู่ระบบใหม่', 'error');
        return;
    }

    try {
        Swal.fire({
            title: 'กำลังเชื่อมโยง...',
            text: `จำนวน ${selectedCustomersToLink.length} รายการ`,
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        // Use upsert to handle multiple links efficiently
        // Actually, we must check existing to update status if needed, but supabase upsert on (line_user_id, customer_id) requires unique constraint.
        // The waste_customer_line_links table doesn't have a unique constraint on (line_user_id, customer_id).
        // Let's do it loop-based since it's just a few usually.
        
        for (const c of selectedCustomersToLink) {
            const { data: existing, error: chkErr } = await supabaseClient
                .from('waste_customer_line_links')
                .select('id, status')
                .eq('line_user_id', session.lineUserId)
                .eq('customer_id', c.id)
                .maybeSingle();

            if (chkErr) throw chkErr;

            if (existing) {
                if (existing.status !== 'active') {
                    const { error: updErr } = await supabaseClient
                        .from('waste_customer_line_links')
                        .update({ status: 'active', linked_at: new Date().toISOString() })
                        .eq('id', existing.id);
                    if (updErr) throw updErr;
                }
            } else {
                const { error: insErr } = await supabaseClient
                    .from('waste_customer_line_links')
                    .insert([{
                        line_user_id: session.lineUserId,
                        customer_id: c.id,
                        status: 'active'
                    }]);
                if (insErr) throw insErr;
            }
        }

        Swal.fire('สำเร็จ', `เชื่อมโยงบัญชีสำเร็จแล้ว`, 'success');
        
        // Allow modal to close
        allowLinkModalClose();
        
        // Reset selections
        selectedCustomersToLink = [];
        renderSelectedBasket();
        document.getElementById('linkCustomerSearchResults').innerHTML = '<div class="text-center text-muted py-4"><span class="text-sm">กรอกข้อมูลเพื่อค้นหา</span></div>';
        
        // Hide modal
        const modalEl = document.getElementById('linkCustomerModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if(modal) modal.hide();

        // Refresh list
        loadLinkedCustomers();

    } catch (err) {
        console.error("Link error", err);
        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเชื่อมโยงบัญชีได้', 'error');
    }
}

async function unlinkCustomer(linkId, customerName) {
    Swal.fire({
        title: 'ยืนยันการยกเลิก?',
        text: `คุณต้องการยกเลิกการเชื่อมโยงข้อมูลของ ${customerName} หรือไม่?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'ใช่, ยกเลิกเลย',
        cancelButtonText: 'ปิด'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                Swal.fire({ title: 'กำลังดำเนินการ...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
                
                const { error } = await supabaseClient
                    .from('waste_customer_line_links')
                    .update({ status: 'inactive' })
                    .eq('id', linkId);
                    
                if (error) throw error;
                
                Swal.fire('สำเร็จ!', 'ยกเลิกการเชื่อมโยงเรียบร้อยแล้ว', 'success');
                loadLinkedCustomers();
            } catch (err) {
                console.error("Unlink error", err);
                Swal.fire('ข้อผิดพลาด', 'ไม่สามารถยกเลิกได้', 'error');
            }
        }
    });
}
