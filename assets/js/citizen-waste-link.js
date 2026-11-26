// citizen-waste-link.js
// Handles linking waste customers to LINE users

let selectedCustomersToLink = [];
let searchTimeout = null;

document.addEventListener('DOMContentLoaded', async () => {
    await ensureConfiguredSubdistrict();
    loadLinkedCustomers();
    populateSearchMooDropdown();
    loadLinkModalRegisterStatus();

    const linkModalEl = document.getElementById('linkCustomerModal');
    if (linkModalEl) {
        linkModalEl.addEventListener('shown.bs.modal', () => {
            loadLinkModalRegisterStatus();
        });
    }
});

function openRegisterFromLinkModal() {
    window.openedRegisterFromLinkModal = true;

    // Pre-fill form fields from search inputs or session if currently empty
    try {
        const session = typeof LineAuth !== 'undefined' ? LineAuth.getSession() : null;
        const regNameEl = document.getElementById('regName');
        const regHouseNoEl = document.getElementById('regHouseNo');
        const regMooEl = document.getElementById('regMoo');
        const regPhoneEl = document.getElementById('regPhone');
        const searchHouseNoVal = (document.getElementById('searchHouseNo')?.value || '').trim();
        const searchMooVal = (document.getElementById('searchMoo')?.value || '').trim();

        if (regNameEl && !regNameEl.value && session) {
            const fullName = session.firstName ? `${session.firstName} ${session.lastName}` : (session.fullName || '');
            if (fullName) regNameEl.value = fullName;
        }
        if (regHouseNoEl && !regHouseNoEl.value) {
            regHouseNoEl.value = searchHouseNoVal || (session && session.houseNo ? session.houseNo : '');
        }
        if (regMooEl && !regMooEl.value) {
            regMooEl.value = searchMooVal || (session && session.moo ? session.moo : '');
        }
        if (regPhoneEl && !regPhoneEl.value && session && session.phone) {
            regPhoneEl.value = session.phone;
        }
    } catch (e) {}

    // Hide linkCustomerModal and open registerWasteModal
    const linkModalEl = document.getElementById('linkCustomerModal');
    if (linkModalEl) {
        const linkModal = bootstrap.Modal.getInstance(linkModalEl);
        if (linkModal) linkModal.hide();
    }

    const regModalEl = document.getElementById('registerWasteModal');
    if (regModalEl) {
        const regModal = bootstrap.Modal.getInstance(regModalEl) || new bootstrap.Modal(regModalEl);
        regModal.show();
    }
}

function autoSearchApprovedHouse(houseNo, moo) {
    // Switch to House Search tab
    const houseTabBtn = document.getElementById('house-tab');
    if (houseTabBtn) {
        const tab = bootstrap.Tab.getInstance(houseTabBtn) || new bootstrap.Tab(houseTabBtn);
        tab.show();
    }
    const houseInput = document.getElementById('searchHouseNo');
    const mooSelect = document.getElementById('searchMoo');
    if (houseInput) houseInput.value = houseNo || '';
    if (mooSelect) mooSelect.value = moo || '';
    searchCustomersForLinking('house');
}

async function loadLinkModalRegisterStatus(showRefreshFeedback = false) {
    const statusArea = document.getElementById('linkModalRegStatusArea');
    if (!statusArea) return;

    const session = typeof LineAuth !== 'undefined' ? LineAuth.getSession() : null;
    const lineUserId = session ? session.lineUserId : null;
    const userName = session ? (session.firstName ? `${session.firstName} ${session.lastName}` : (session.fullName || session.lineName || '')) : '';

    if (showRefreshFeedback) {
        statusArea.style.display = 'block';
        statusArea.innerHTML = `<div class="p-3 rounded-3 bg-white border text-center text-muted text-sm"><div class="spinner-border spinner-border-sm text-primary me-2"></div>กำลังตรวจสอบสถานะการอนุมัติ...</div>`;
    }

    let regRequests = [];

    // 1. Fetch from Supabase
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        try {
            let q = supabaseClient.from('waste_register_requests').select('*').order('created_at', { ascending: false }).limit(10);
            if (lineUserId) {
                q = q.eq('line_user_id', lineUserId);
            } else if (userName) {
                q = q.ilike('name', `%${userName}%`);
            }
            const { data } = await q;
            if (data && data.length > 0) {
                regRequests = data;
            } else if (userName) {
                // Fallback query by name if line_user_id didn't match old records
                const { data: byName } = await supabaseClient
                    .from('waste_register_requests')
                    .select('*')
                    .ilike('name', `%${userName}%`)
                    .order('created_at', { ascending: false })
                    .limit(10);
                if (byName && byName.length > 0) regRequests = byName;
            }
        } catch (err) {
            console.warn('Error fetching register status in link modal:', err);
        }
    }

    // 2. Merge with localStorage cached requests
    try {
        const localMyReqs = JSON.parse(localStorage.getItem('my_waste_reg_requests') || '[]');
        const localAllReqs = JSON.parse(localStorage.getItem('waste_register_requests') || '[]');
        const combinedLocal = [...localMyReqs, ...localAllReqs].filter(r => {
            if (!r) return false;
            if (lineUserId && r.line_user_id === lineUserId) return true;
            if (userName && r.name && r.name.includes(userName)) return true;
            return localMyReqs.includes(r);
        });

        // If Supabase returned records, sync local cache status with Supabase
        if (regRequests.length > 0) {
            localStorage.setItem('my_waste_reg_requests', JSON.stringify(regRequests.slice(0, 10)));
        } else if (combinedLocal.length > 0) {
            regRequests = combinedLocal;
        }
    } catch (e) {}

    if (!regRequests || regRequests.length === 0) {
        statusArea.style.display = 'none';
        statusArea.innerHTML = '';
        return;
    }

    // Sort newest first
    regRequests.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    const latestReq = regRequests[0];
    const dateStr = latestReq.created_at
        ? new Date(latestReq.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '-';

    statusArea.style.display = 'block';

    if (latestReq.status === 'pending') {
        statusArea.innerHTML = `
            <div class="p-3 rounded-3 shadow-sm" style="background: #fffbeb; border: 1px solid #fcd34d; border-left: 5px solid #f59e0b;">
                <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                    <div class="fw-bold text-dark" style="font-size: 0.95rem;">
                        <i class="fa-solid fa-file-circle-Check text-warning me-1"></i>รายการคำขอลงทะเบียนค่าธรรมเนียมขยะ
                    </div>
                    <span class="badge bg-warning text-dark px-3 py-1 rounded-pill fw-bold">
                        <i class="fa-solid fa-clock me-1"></i>สถานะ: รออนุมัติ
                    </span>
                </div>
                <div class="text-sm text-dark mb-1">
                    <strong>ผู้ยื่นคำขอ:</strong> ${latestReq.name || '-'} &nbsp;|&nbsp;
                    <strong>บ้านเลขที่:</strong> ${latestReq.house_no || '-'} หมู่ที่ ${latestReq.moo || '-'} &nbsp;|&nbsp;
                    <strong>ประเภท:</strong> ${latestReq.type || '-'}
                </div>
                <div class="text-xs text-muted mb-2">
                    <i class="fa-regular fa-calendar me-1"></i>ยื่นคำขอเมื่อ: ${dateStr} น.
                </div>
                <div class="p-2 rounded bg-white border border-warning border-opacity-50 text-xs text-dark d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <span><i class="fa-solid fa-hourglass-half text-warning me-1"></i>อยู่ระหว่างรอเจ้าหน้าที่ตรวจสอบและอนุมัติ เมื่ออนุมัติแล้วจะสามารถค้นหาบ้านเลขที่และเชื่อมโยงข้อมูลได้ตามปกติ</span>
                    <button type="button" class="btn btn-xs btn-outline-warning text-dark fw-semibold rounded-pill px-2 py-1" onclick="loadLinkModalRegisterStatus(true)">
                        <i class="fa-solid fa-rotate-right me-1"></i>เช็คสถานะ
                    </button>
                </div>
            </div>
        `;
    } else if (latestReq.status === 'approved') {
        const hNo = (latestReq.house_no || '').replace(/'/g, "\\'");
        const moo = (latestReq.moo || '').replace(/'/g, "\\'");
        statusArea.innerHTML = `
            <div class="p-3 rounded-3 shadow-sm" style="background: #f0fdf4; border: 1px solid #86efac; border-left: 5px solid #16a34a;">
                <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                    <div class="fw-bold text-success" style="font-size: 0.95rem;">
                        <i class="fa-solid fa-circle-check me-1"></i>คำขอลงทะเบียนได้รับการอนุมัติแล้ว!
                    </div>
                    <span class="badge bg-success px-3 py-1 rounded-pill fw-bold">
                        <i class="fa-solid fa-check me-1"></i>สถานะ: อนุมัติแล้ว
                    </span>
                </div>
                <div class="text-sm text-dark mb-2">
                    <strong>ชื่อ:</strong> ${latestReq.name || '-'} &nbsp;|&nbsp;
                    <strong>บ้านเลขที่:</strong> ${latestReq.house_no || '-'} หมู่ที่ ${latestReq.moo || '-'} &nbsp;|&nbsp;
                    <strong>ประเภท:</strong> ${latestReq.type || '-'}
                </div>
                <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 bg-white p-2 rounded border border-success border-opacity-25">
                    <span class="text-xs text-success fw-semibold">
                        <i class="fa-solid fa-hand-point-up me-1"></i>เจ้าหน้าที่อนุมัติข้อมูลแล้ว กดปุ่มเพื่อค้นหาบ้านเลขที่และกดเลือกเชื่อมโยงข้อมูลได้ทันที
                    </span>
                    <button type="button" class="btn btn-sm btn-success rounded-pill fw-bold px-3 shadow-sm" onclick="autoSearchApprovedHouse('${hNo}', '${moo}')">
                        <i class="fa-solid fa-magnifying-glass me-1"></i>ค้นหาบ้านเลขที่ ${latestReq.house_no} เพื่อเชื่อมโยง
                    </button>
                </div>
            </div>
        `;

        // Auto-populate and trigger search if search box is currently empty
        const searchHouseInput = document.getElementById('searchHouseNo');
        if (searchHouseInput && !searchHouseInput.value.trim() && latestReq.house_no) {
            autoSearchApprovedHouse(latestReq.house_no, latestReq.moo || '');
        }
    } else if (latestReq.status === 'rejected') {
        statusArea.innerHTML = `
            <div class="p-3 rounded-3 shadow-sm" style="background: #fef2f2; border: 1px solid #fca5a5; border-left: 5px solid #dc2626;">
                <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-1">
                    <div class="fw-bold text-danger" style="font-size: 0.95rem;">
                        <i class="fa-solid fa-circle-xmark me-1"></i>คำขอลงทะเบียนไม่ได้รับการอนุมัติ
                    </div>
                    <span class="badge bg-danger px-3 py-1 rounded-pill fw-bold">สถานะ: ไม่อนุมัติ</span>
                </div>
                <div class="text-sm text-dark mb-1">
                    <strong>บ้านเลขที่:</strong> ${latestReq.house_no || '-'} หมู่ที่ ${latestReq.moo || '-'} (${latestReq.name || '-'})
                </div>
                ${latestReq.note ? `<div class="text-xs text-danger"><strong>เหตุผล:</strong> ${latestReq.note}</div>` : ''}
                <div class="text-xs text-muted mt-1">ท่านสามารถตรวจสอบข้อมูลและกดปุ่มลงทะเบียนด้านล่างเพื่อยื่นคำขอใหม่ได้</div>
            </div>
        `;
    }
}

async function ensureConfiguredSubdistrict() {
    if (window.orgSubdistrictName) return window.orgSubdistrictName;
    try {
        const local = localStorage.getItem('waste_settings');
        if (local) {
            const parsed = JSON.parse(local);
            if (parsed && parsed.org_subdistrict_name) {
                window.orgSubdistrictName = String(parsed.org_subdistrict_name).trim();
            }
        }
    } catch (e) {}

    if (!window.orgSubdistrictName && typeof supabaseClient !== 'undefined' && supabaseClient) {
        try {
            const { data } = await supabaseClient
                .from('waste_settings')
                .select('org_subdistrict_name')
                .limit(1)
                .single();
            if (data && data.org_subdistrict_name) {
                window.orgSubdistrictName = String(data.org_subdistrict_name).trim();
            }
        } catch (e) {}
    }
    return window.orgSubdistrictName || 'บ้านเป็ด';
}

function getConfiguredSubdistrictText() {
    let sub = (window.orgSubdistrictName || '').trim();
    if (!sub) {
        try {
            const local = localStorage.getItem('waste_settings');
            if (local) {
                const parsed = JSON.parse(local);
                if (parsed && parsed.org_subdistrict_name) {
                    sub = String(parsed.org_subdistrict_name).trim();
                }
            }
        } catch (e) {}
    }
    if (!sub) sub = 'บ้านเป็ด';
    if (sub.startsWith('ต.') || sub.startsWith('ตำบล')) return sub;
    return `ต.${sub}`;
}

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

    await ensureConfiguredSubdistrict();
    const subdistrictText = getConfiguredSubdistrictText();

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
                        <div class="text-muted" style="font-size: 0.85rem;"><i class="fa-solid fa-location-dot me-1"></i>บ้านเลขที่ ${c.house_no} ม.${c.moo || '-'} ${subdistrictText}</div>
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
        await ensureConfiguredSubdistrict();
        const { data, error } = await query.limit(10);
            
        if (error) throw error;

        if (!data || data.length === 0) {
            resultDiv.innerHTML = `
                <div class="text-center text-muted py-3 px-2">
                    <div class="fw-semibold text-danger mb-1"><i class="fa-solid fa-circle-exclamation me-1"></i>ไม่พบข้อมูลในฐานข้อมูล</div>
                    <div class="text-xs text-muted">หากยังไม่มีฐานข้อมูลการชำระค่าธรรมเนียมขยะกับเทศบาลเมืองบ้านเป็ด กรุณากดปุ่ม <strong>"ลงทะเบียนค่าธรรมเนียมขยะ"</strong> ด้านล่าง</div>
                </div>
            `;
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
    const subdistrictText = getConfiguredSubdistrictText();
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
                    <div class="text-muted text-sm"><i class="fa-solid fa-house-chimney me-1"></i>บ้านเลขที่ ${c.house_no} ม.${c.moo || '-'} ${subdistrictText}</div>
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
    const subdistrictText = getConfiguredSubdistrictText();
    
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
                    <div class="text-muted" style="font-size:0.75rem;">บ้านเลขที่ ${c.house_no} ม.${c.moo || '-'} ${subdistrictText}</div>
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
