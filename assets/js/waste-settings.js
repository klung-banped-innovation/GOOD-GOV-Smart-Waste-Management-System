/**
 * waste-settings.js — Logic for Waste System Settings
 */

let orgLogoBase64 = null;
let mayorSignatureBase64 = null;
let qrCodePromptPayBase64 = null;
let qrCodeBase64 = null;
let currentSettingsId = null;

// Google Apps Script URL สำหรับอัปโหลด QR Code ระบบบริการประชาชนลง Google Drive
// โฟลเดอร์ปลายทาง: https://drive.google.com/drive/folders/1Y_EJDGUXa1ENJlJ103dFfQR96g6dB_80
// ดูโค้ด Apps Script ได้ที่ไฟล์ google-apps-script/qrcode-upload.gs
const CITIZEN_QR_UPLOAD_GAS_URL = 'https://script.google.com/macros/s/AKfycbwrWz5tEj20ng1n23qedsrr9RArj-5W60r9Z7MCWndnIZB2o6NqxEphSW4LGshLf-91/exec';

function extractSettingsDriveFileId(url) {
    if (!url || typeof url !== 'string') return '';
    if (url.startsWith('data:')) return '';
    const m1 = url.match(/\/d\/([a-zA-Z0-9_-]{15,})/);
    if (m1) return m1[1];
    const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]{15,})/);
    if (m2) return m2[1];
    const m3 = url.match(/[-\w]{25,}/);
    if (m3 && (url.includes('drive.google.com') || url.includes('googleusercontent.com'))) return m3[0];
    return '';
}

function formatDriveImageDisplayUrl(url) {
    if (!url || typeof url !== 'string') return '';
    if (url.startsWith('data:')) return url;
    const fileId = extractSettingsDriveFileId(url);
    if (fileId) {
        return `https://lh3.googleusercontent.com/d/${fileId}=w800`;
    }
    return url;
}

function formatDriveViewUrl(url) {
    const fileId = extractSettingsDriveFileId(url);
    if (fileId) {
        return `https://drive.google.com/file/d/${fileId}/view`;
    }
    return url;
}

function handleSettingsDriveImgError(imgEl) {
    if (!imgEl || !imgEl.src || imgEl.src.startsWith('data:')) return;
    const fileId = imgEl.getAttribute('data-drive-id') || extractSettingsDriveFileId(imgEl.src);
    if (!fileId) return;

    const step = parseInt(imgEl.getAttribute('data-fallback-step') || '0', 10);
    if (step === 0) {
        imgEl.setAttribute('data-fallback-step', '1');
        imgEl.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
        return;
    }
    if (step === 1) {
        imgEl.setAttribute('data-fallback-step', '2');
        imgEl.src = `https://drive.google.com/uc?export=view&id=${fileId}`;
        return;
    }
    // Fallback Step 3: Render Google Drive Embedded Preview iframe (works in Incognito mode even when 3rd-party image cookies are blocked)
    if (imgEl.id === 'qrCodePreview') {
        const wrapper = document.getElementById('qrCodePreviewWrapper') || imgEl.parentElement;
        if (wrapper && !wrapper.querySelector('iframe')) {
            imgEl.style.display = 'none';
            const iframe = document.createElement('iframe');
            iframe.id = 'qrCodePreviewIframe';
            iframe.src = `https://drive.google.com/file/d/${fileId}/preview`;
            iframe.style.cssText = 'width:190px; height:190px; border:1px dashed #cbd5e1; border-radius:8px; background:#f8fafc; margin-top:8px;';
            wrapper.appendChild(iframe);
        }
    }
}

function renderCitizenQrPreview(qrUrl) {
    const preview = document.getElementById('qrCodePreview');
    const wrapper = document.getElementById('qrCodePreviewWrapper');
    const actions = document.getElementById('qrCodeActions');
    const driveBtn = document.getElementById('qrCodeDriveLinkBtn');
    const statusEl = document.getElementById('qrCodeDriveStatus');

    if (!qrUrl) return;

    // Remove fallback iframe if present
    const oldIframe = document.getElementById('qrCodePreviewIframe');
    if (oldIframe) oldIframe.remove();

    const fileId = extractSettingsDriveFileId(qrUrl);
    const displayUrl = formatDriveImageDisplayUrl(qrUrl);

    if (preview) {
        preview.removeAttribute('data-fallback-step');
        if (fileId) preview.setAttribute('data-drive-id', fileId);
        else preview.removeAttribute('data-drive-id');
        preview.src = displayUrl;
        preview.style.display = 'block';
    }

    if (actions) actions.style.display = 'block';

    if (driveBtn) {
        if (fileId || (qrUrl.startsWith('http') && qrUrl.includes('drive.google.com'))) {
            driveBtn.href = formatDriveViewUrl(qrUrl);
            driveBtn.style.display = 'inline-block';
            if (statusEl) {
                statusEl.innerHTML = `<i class="fa-solid fa-circle-check me-1"></i>บันทึกใน Google Drive และตารางตั้งค่าแล้ว`;
            }
        } else {
            driveBtn.style.display = 'none';
            if (statusEl) statusEl.innerHTML = '';
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Show loading
    Swal.fire({ title: 'กำลังโหลดข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        await loadSettings();
        Swal.close();
    } catch (err) {
        console.error(err);
        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลการตั้งค่าได้', 'error');
    }
});

async function loadSettings() {
    let settings = null;

    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        try {
            const { data, error } = await supabaseClient
                .from('waste_settings')
                .select('*')
                .limit(1)
                .single();
            
            if (data) {
                settings = data;
            } else if (error && error.code !== 'PGRST116') {
                // Ignore "Row not found" error
                console.warn('Supabase fetch error:', error);
            }
        } catch (e) {
            console.warn('Supabase exception in loadSettings:', e);
        }
    }

    if (!settings) {
        try {
            const local = localStorage.getItem('waste_settings');
            if (local) {
                try {
                    settings = JSON.parse(local);
                } catch (e) {
                    console.warn('Failed to parse local waste_settings:', e);
                    settings = null;
                }
            }
        } catch (e) {
            console.warn('localStorage access failed:', e);
        }
    }

    try {
        if (settings) {
            currentSettingsId = settings.id;
            document.getElementById('orgName').value = settings.org_name || '';
            document.getElementById('orgAddress').value = settings.org_address || '';
            document.getElementById('orgPhone').value = settings.org_phone || '';
            document.getElementById('docInvoiceNo').value = settings.doc_invoice_no || '';
            document.getElementById('mayorName').value = settings.mayor_name || '';
            document.getElementById('mayorTitle').value = settings.mayor_title || '';
            document.getElementById('envLicenseNo').value = settings.env_license_no || '';
            document.getElementById('envPostOffice').value = settings.env_post_office || '';
            document.getElementById('gasUrl').value = settings.gas_url || CITIZEN_QR_UPLOAD_GAS_URL;
            
            if (settings.bank_account) document.getElementById('bankAccount').value = settings.bank_account;
            if (settings.bank_account_name) document.getElementById('bankAccountName').value = settings.bank_account_name;
            if (settings.bank_name) document.getElementById('bankName').value = settings.bank_name;
            if (settings.bank_branch) document.getElementById('bankBranch').value = settings.bank_branch;
            if (settings.tax_id && document.getElementById('taxId')) document.getElementById('taxId').value = settings.tax_id;
            if (settings.branch_suffix && document.getElementById('branchSuffix')) document.getElementById('branchSuffix').value = settings.branch_suffix;
            if (settings.company_code && document.getElementById('companyCode')) document.getElementById('companyCode').value = settings.company_code;
            
            // Load Backup URL from localStorage safely
            try {
                const gasBackupUrlLocal = localStorage.getItem('waste_gasBackupUrl');
                if (gasBackupUrlLocal && document.getElementById('gasBackupUrl')) {
                    document.getElementById('gasBackupUrl').value = gasBackupUrlLocal;
                }
            } catch (e) {
                console.warn('localStorage access for backup URL failed:', e);
            }

            if (settings.org_logo) {
                const displayLogo = formatDriveImageDisplayUrl(settings.org_logo);
                const preview = document.getElementById('orgLogoPreview');
                if (preview) {
                    preview.src = displayLogo;
                    preview.style.display = 'block';
                }
                
                const headerLogo = document.getElementById('page-header-logo');
                const headerIcon = document.getElementById('page-header-icon');
                if (headerLogo && headerIcon) {
                    headerLogo.src = displayLogo;
                    headerLogo.style.display = 'block';
                    headerIcon.style.display = 'none';
                }

                const cardLogo = document.getElementById('card-header-logo');
                const cardIcon = document.getElementById('card-header-icon');
                if (cardLogo && cardIcon) {
                    cardLogo.src = displayLogo;
                    cardLogo.style.display = 'block';
                    cardIcon.style.display = 'none';
                }
            }

            if (settings.mayor_signature) {
                const preview = document.getElementById('mayorSignaturePreview');
                if (preview) {
                    preview.src = formatDriveImageDisplayUrl(settings.mayor_signature);
                    preview.style.display = 'block';
                }
            }

            if (settings.qr_code_payment) {
                const preview = document.getElementById('qrCodePromptPayPreview');
                if (preview) {
                    preview.src = formatDriveImageDisplayUrl(settings.qr_code_payment);
                    preview.style.display = 'block';
                }
            }

            if (settings.qr_code) {
                renderCitizenQrPreview(settings.qr_code);
            }

            const portalUrlInput = document.getElementById('citizenPortalUrl');
            if (portalUrlInput) {
                const savedUrl = settings.citizen_portal_url || localStorage.getItem('waste_citizen_portal_url') || '';
                if (savedUrl) {
                    portalUrlInput.value = savedUrl;
                } else {
                    const baseHref = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
                    portalUrlInput.value = baseHref + 'citizen-waste.html';
                }
            }
        } else {
            const gasUrlEl = document.getElementById('gasUrl');
            if (gasUrlEl && !gasUrlEl.value) gasUrlEl.value = CITIZEN_QR_UPLOAD_GAS_URL;
        }
    } catch (e) {
        console.error('Error applying settings to UI:', e);
    }

    try {
        // Initialize ThaiAddress
        if (typeof ThaiAddress !== 'undefined') {
            await ThaiAddress.loadData();
            const provSelect = document.getElementById('orgProvince');
            const distSelect = document.getElementById('orgDistrict');
            const subSelect = document.getElementById('orgSubdistrict');
            
            if (provSelect && distSelect && subSelect) {
                ThaiAddress.populateProvinces(provSelect);

                provSelect.addEventListener('change', (e) => {
                    if (e.target.value) {
                        distSelect.disabled = false;
                        ThaiAddress.populateDistricts(distSelect, e.target.value);
                        subSelect.innerHTML = '<option value="">-- เลือกตำบล --</option>';
                        subSelect.disabled = true;
                    } else {
                        distSelect.innerHTML = '<option value="">-- เลือกอำเภอ --</option>';
                        distSelect.disabled = true;
                        subSelect.innerHTML = '<option value="">-- เลือกตำบล --</option>';
                        subSelect.disabled = true;
                    }
                });

                distSelect.addEventListener('change', (e) => {
                    if (e.target.value) {
                        subSelect.disabled = false;
                        ThaiAddress.populateSubdistricts(subSelect, e.target.value);
                    } else {
                        subSelect.innerHTML = '<option value="">-- เลือกตำบล --</option>';
                        subSelect.disabled = true;
                    }
                });

                // Load saved address
                if (settings && settings.org_province) {
                    provSelect.value = settings.org_province;
                    provSelect.dispatchEvent(new Event('change'));
                    
                    if (settings.org_district) {
                        distSelect.value = settings.org_district;
                        distSelect.dispatchEvent(new Event('change'));
                        
                        if (settings.org_subdistrict) {
                            subSelect.value = settings.org_subdistrict;
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.error('Error initializing ThaiAddress:', e);
    }
}

function previewImage(input, previewId) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];

    // Validate type
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
        Swal.fire('ข้อผิดพลาด', 'รองรับเฉพาะไฟล์ JPG หรือ PNG เท่านั้น', 'warning');
        input.value = '';
        return;
    }
    // Validate size (2MB)
    if (file.size > 2 * 1024 * 1024) {
        Swal.fire('ข้อผิดพลาด', 'ขนาดไฟล์ต้องไม่เกิน 2MB', 'warning');
        input.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = e => {
        const base64 = e.target.result;
        const preview = document.getElementById(previewId);

        if (previewId === 'qrCodePreview') {
            const oldIframe = document.getElementById('qrCodePreviewIframe');
            if (oldIframe) oldIframe.remove();
            const statusEl = document.getElementById('qrCodeDriveStatus');
            if (statusEl) {
                statusEl.innerHTML = `<span class="text-warning"><i class="fa-solid fa-clock me-1"></i>รอกดปุ่ม "อัปโหลดลง Drive & บันทึก" หรือ "บันทึกการตั้งค่า"</span>`;
            }
        }

        preview.src = base64;
        preview.style.display = 'block';

        if (previewId === 'orgLogoPreview') {
            orgLogoBase64 = base64;
        } else if (previewId === 'mayorSignaturePreview') {
            mayorSignatureBase64 = base64;
        } else if (previewId === 'qrCodePromptPayPreview') {
            qrCodePromptPayBase64 = base64;
        } else if (previewId === 'qrCodePreview') {
            qrCodeBase64 = base64;
            const actions = document.getElementById('qrCodeActions');
            if (actions) actions.style.display = 'block';
        }
    };
    reader.readAsDataURL(file);
}

function fillDefaultCitizenPortalUrl() {
    const baseHref = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
    const defaultUrl = baseHref + 'citizen-waste.html';
    const input = document.getElementById('citizenPortalUrl');
    if (input) {
        input.value = defaultUrl;
    }
    generateCitizenPortalQR();
}

function generateCitizenPortalQR() {
    const input = document.getElementById('citizenPortalUrl');
    const url = input ? input.value.trim() : '';
    if (!url) {
        Swal.fire('กรุณาระบุลิงก์', 'กรุณาใส่ลิงก์ระบบบริการประชาชนก่อนกด Generate QR Code', 'warning');
        return;
    }

    try {
        let dataUrl = '';
        if (typeof qrcode === 'function') {
            const qr = qrcode(0, 'M');
            qr.addData(url);
            qr.make();
            dataUrl = qr.createDataURL(8, 4);
        } else {
            dataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;
        }

        const oldIframe = document.getElementById('qrCodePreviewIframe');
        if (oldIframe) oldIframe.remove();

        const preview = document.getElementById('qrCodePreview');
        if (preview) {
            preview.src = dataUrl;
            preview.style.display = 'block';
        }
        const actions = document.getElementById('qrCodeActions');
        if (actions) {
            actions.style.display = 'block';
        }
        const statusEl = document.getElementById('qrCodeDriveStatus');
        if (statusEl) {
            statusEl.innerHTML = `<span class="text-warning"><i class="fa-solid fa-clock me-1"></i>รอกดปุ่ม "อัปโหลดลง Drive & บันทึก" หรือ "บันทึกการตั้งค่า"</span>`;
        }

        qrCodeBase64 = dataUrl;
        localStorage.setItem('waste_citizen_portal_url', url);

        Swal.fire({
            icon: 'success',
            title: 'สร้าง QR Code สำเร็จ',
            text: 'กดปุ่ม "อัปโหลดลง Drive & บันทึก" เพื่อเก็บไฟล์ลง Google Drive และบันทึกในฐานข้อมูล',
            timer: 2000,
            showConfirmButton: false
        });
    } catch (err) {
        console.error('QR Generate error:', err);
        Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถสร้าง QR Code จากลิงก์นี้ได้', 'error');
    }
}

function downloadCitizenPortalQR() {
    const preview = document.getElementById('qrCodePreview');
    if (!preview || !preview.src) return;
    if (preview.src.startsWith('http') && !preview.src.startsWith(window.location.origin)) {
        window.open(formatDriveViewUrl(preview.src), '_blank');
        return;
    }
    const a = document.createElement('a');
    a.href = preview.src;
    a.download = 'QRCode_ระบบบริการประชาชน.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

async function uploadToGas(base64, filename, gasUrl) {
    const targetGasUrl = (gasUrl && gasUrl.trim()) ? gasUrl.trim() : CITIZEN_QR_UPLOAD_GAS_URL;
    if (!targetGasUrl || !base64) return base64;

    try {
        let cleanBase64 = base64;
        let mimeType = 'image/png';
        if (base64.includes(',')) {
            const parts = base64.split(',');
            const header = parts[0];
            cleanBase64 = parts[1];
            const m = header.match(/data:([^;]+);base64/);
            if (m && m[1]) mimeType = m[1];
        }

        const response = await fetch(targetGasUrl, {
            method: 'POST',
            body: JSON.stringify({
                base64: cleanBase64,
                data: cleanBase64,
                filename: filename,
                mimeType: mimeType
            })
        });
        const result = await response.json();

        // รองรับทั้งรูปแบบ { status: "success", file_id, url } และ { success: true, imageUrl }
        if (result.status === 'success' || result.success === true) {
            const rawUrl = result.imageUrl || result.url || result.thumbnail_url || '';
            const fileId = result.file_id || extractSettingsDriveFileId(rawUrl);
            if (fileId) {
                return `https://lh3.googleusercontent.com/d/${fileId}=w800`;
            }
            if (rawUrl) return rawUrl;
        }
        console.warn('Google Drive Upload Failed:', result.error || result.message);
        return base64;
    } catch (e) {
        console.error('Upload Error:', e);
        return base64;
    }
}

async function uploadAndSaveCitizenQR() {
    if (!qrCodeBase64) {
        const preview = document.getElementById('qrCodePreview');
        if (preview && preview.src && preview.src.startsWith('data:')) {
            qrCodeBase64 = preview.src;
        } else {
            Swal.fire('กรุณาเลือกรูปภาพ QR Code', 'โปรดเลือกไฟล์รูปภาพ QR Code หรือกดปุ่ม Generate QR Code ก่อนกดอัปโหลด', 'warning');
            return;
        }
    }

    const btn = document.getElementById('btnUploadCitizenQrNow');
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>กำลังอัปโหลดลง Drive...';
    }

    Swal.fire({
        title: 'กำลังอัปโหลด QR Code ลง Google Drive...',
        text: 'กำลังบันทึกไฟล์ลงโฟลเดอร์ Google Drive และบันทึกลงตารางฐานข้อมูล',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        // 1. อัปโหลดไปยัง Google Drive โฟลเดอร์ 1Y_EJDGUXa1ENJlJ103dFfQR96g6dB_80
        const uploadedDriveUrl = await uploadToGas(
            qrCodeBase64,
            `Citizen_Service_QRCode_${Date.now()}.png`,
            CITIZEN_QR_UPLOAD_GAS_URL
        );

        const citizenPortalUrlVal = document.getElementById('citizenPortalUrl')?.value.trim() || '';
        if (citizenPortalUrlVal) {
            localStorage.setItem('waste_citizen_portal_url', citizenPortalUrlVal);
        }

        // 2. บันทึก URL ลงในตาราง waste_settings ใน Supabase
        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            const updatePayload = {
                id: 1,
                qr_code: uploadedDriveUrl,
                updated_at: new Date().toISOString()
            };
            const { error } = await supabaseClient.from('waste_settings').upsert([updatePayload]);
            if (error) throw error;
        }

        // 3. อัปเดตใน localStorage ด้วย
        try {
            const currentLocal = JSON.parse(localStorage.getItem('waste_settings') || '{}');
            currentLocal.id = 1;
            currentLocal.qr_code = uploadedDriveUrl;
            if (citizenPortalUrlVal) currentLocal.citizen_portal_url = citizenPortalUrlVal;
            localStorage.setItem('waste_settings', JSON.stringify(currentLocal));
        } catch (e) {}

        // 4. แสดงผลรูปภาพที่บันทึกแล้วในเมนูการตั้งค่าทันที
        qrCodeBase64 = null;
        renderCitizenQrPreview(uploadedDriveUrl);

        if (typeof logWasteActivity === 'function') {
            logWasteActivity({
                category: 'setting',
                action_type: 'UPDATE',
                action_label: 'อัปเดต QR Code ระบบบริการประชาชน',
                module: 'ตั้งค่าระบบขยะ',
                module_key: 'waste-settings',
                target_id: 'waste_settings.qr_code',
                target_name: 'QRCODE ระบบบริการประชาชน',
                detail: `อัปโหลดรูปภาพ QRCODE ระบบบริการประชาชนลง Google Drive และบันทึกในตาราง waste_settings`
            });
        }

        Swal.fire({
            icon: 'success',
            title: 'อัปโหลดและบันทึก QR Code สำเร็จ!',
            text: 'บันทึกภาพ QR Code ลง Google Drive และบันทึกในตาราง waste_settings เรียบร้อยแล้ว',
            confirmButtonColor: '#057a55'
        });
    } catch (err) {
        console.error('Error uploading/saving citizen QR:', err);
        Swal.fire('เกิดข้อผิดพลาด', err.message || 'ไม่สามารถบันทึก QR Code ได้', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    }
}

async function saveSettings() {
    const btn = document.querySelector('button[onclick="saveSettings()"]');
    const originalBtnHtml = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>กำลังบันทึก...';

        const gasUrl = document.getElementById('gasUrl').value.trim() || CITIZEN_QR_UPLOAD_GAS_URL;
        
        // Save Backup URL to localStorage
        const gasBackupUrl = document.getElementById('gasBackupUrl') ? document.getElementById('gasBackupUrl').value.trim() : '';
        if (gasBackupUrl !== undefined) {
            localStorage.setItem('waste_gasBackupUrl', gasBackupUrl);
        }

        const citizenPortalUrlVal = document.getElementById('citizenPortalUrl') ? document.getElementById('citizenPortalUrl').value.trim() : '';
        if (citizenPortalUrlVal) {
            localStorage.setItem('waste_citizen_portal_url', citizenPortalUrlVal);
        }

        // 1. Upload new images if any
        let finalLogo = document.getElementById('orgLogoPreview').src;
        if (orgLogoBase64) {
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>อัปโหลด Logo...';
            finalLogo = await uploadToGas(orgLogoBase64, `logo_${Date.now()}.png`, gasUrl);
        }

        let finalSignature = document.getElementById('mayorSignaturePreview').src;
        if (mayorSignatureBase64) {
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>อัปโหลดลายเซ็น...';
            finalSignature = await uploadToGas(mayorSignatureBase64, `signature_${Date.now()}.png`, gasUrl);
        }
        
        let finalQrCodePromptPay = document.getElementById('qrCodePromptPayPreview').src;
        if (qrCodePromptPayBase64) {
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>อัปโหลด PromptPay QR...';
            finalQrCodePromptPay = await uploadToGas(qrCodePromptPayBase64, `qrcode_pp_${Date.now()}.png`, gasUrl);
        }

        let finalQrCode = document.getElementById('qrCodePreview').src;
        if (qrCodeBase64) {
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>อัปโหลด QR Code ระบบบริการประชาชนลง Drive...';
            // อัปโหลดลงโฟลเดอร์ Google Drive 1Y_EJDGUXa1ENJlJ103dFfQR96g6dB_80 โดยตรง
            finalQrCode = await uploadToGas(qrCodeBase64, `Citizen_Service_QRCode_${Date.now()}.png`, CITIZEN_QR_UPLOAD_GAS_URL);
        }

        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>กำลังบันทึกลงฐานข้อมูล...';

        // Fix to avoid saving the placeholder default base64 if no image was ever selected/loaded
        if(finalLogo.includes(window.location.origin) || finalLogo === '') finalLogo = null;
        if(finalSignature.includes(window.location.origin) || finalSignature === '') finalSignature = null;
        if(finalQrCodePromptPay.includes(window.location.origin) || finalQrCodePromptPay === '') finalQrCodePromptPay = null;
        if(finalQrCode.includes(window.location.origin) || finalQrCode === '') finalQrCode = null;

        const provSelect = document.getElementById('orgProvince');
        const distSelect = document.getElementById('orgDistrict');
        const subSelect = document.getElementById('orgSubdistrict');
        
        const provName = provSelect.options[provSelect.selectedIndex]?.text;
        const distName = distSelect.options[distSelect.selectedIndex]?.text;
        const subName = subSelect.options[subSelect.selectedIndex]?.text;

        const payload = {
            org_name: document.getElementById('orgName').value.trim(),
            org_address: document.getElementById('orgAddress').value.trim(),
            org_phone: document.getElementById('orgPhone').value.trim(),
            org_province: provSelect?.value || null,
            org_district: distSelect?.value || null,
            org_subdistrict: subSelect?.value || null,
            org_subdistrict_name: subName && subName !== '-- เลือกตำบล --' ? subName : null,
            doc_invoice_no: document.getElementById('docInvoiceNo').value.trim(),
            mayor_name: document.getElementById('mayorName').value.trim(),
            mayor_title: document.getElementById('mayorTitle').value.trim(),
            env_license_no: document.getElementById('envLicenseNo').value.trim(),
            env_post_office: document.getElementById('envPostOffice').value.trim(),
            gas_url: gasUrl,
            bank_account: document.getElementById('bankAccount').value.trim(),
            bank_account_name: document.getElementById('bankAccountName').value.trim(),
            bank_name: document.getElementById('bankName').value.trim(),
            bank_branch: document.getElementById('bankBranch').value.trim(),
            tax_id: document.getElementById('taxId') ? document.getElementById('taxId').value.trim() : null,
            branch_suffix: document.getElementById('branchSuffix') ? document.getElementById('branchSuffix').value.trim() : null,
            company_code: document.getElementById('companyCode') ? document.getElementById('companyCode').value.trim() : null,
            org_logo: finalLogo,
            mayor_signature: finalSignature,
            qr_code: finalQrCode,
            qr_code_payment: finalQrCodePromptPay,
            updated_at: new Date().toISOString()
        };

        // 2. Save to Supabase
        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            let error;
            // Use Upsert to prevent duplicate key errors and simplify logic
            payload.id = 1; // Always use ID 1 for single settings row
            const res = await supabaseClient.from('waste_settings').upsert([payload]);
            error = res.error;
            currentSettingsId = 1;

            if (error) {
                // It might fail if table doesn't exist
                throw error;
            }
        }

        // 3. Save to localStorage with names included
        const localPayload = { ...payload };
        localPayload.org_province_name = provName && provName !== '-- เลือกจังหวัด --' ? provName : null;
        localPayload.org_district_name = distName && distName !== '-- เลือกอำเภอ --' ? distName : null;
        localPayload.citizen_portal_url = citizenPortalUrlVal || null;
        
        localStorage.setItem('waste_settings', JSON.stringify({id: currentSettingsId, ...localPayload}));

        if (finalQrCode) {
            renderCitizenQrPreview(finalQrCode);
        }

        // Reset the tracking vars
        orgLogoBase64 = null;
        mayorSignatureBase64 = null;
        qrCodeBase64 = null;
        qrCodePromptPayBase64 = null;

        if (typeof logWasteActivity === 'function') {
            logWasteActivity({
                category: 'setting',
                action_type: 'UPDATE',
                action_label: 'บันทึกการตั้งค่าระบบค่าธรรมเนียมขยะ',
                module: 'ตั้งค่าระบบขยะ',
                module_key: 'waste-settings',
                target_id: 'waste_settings',
                target_name: payload.org_name || 'การตั้งค่าระบบขยะ',
                detail: `บันทึกการตั้งค่าระบบขยะ (${payload.org_name || '-'}, บัญชีธนาคาร: ${payload.bank_name || '-'} ${payload.bank_account || '-'}, Comcode: ${payload.company_code || '-'})`
            });
        }

        Swal.fire({
            icon: 'success',
            title: 'บันทึกสำเร็จ',
            text: 'ข้อมูลการตั้งค่าถูกบันทึกเรียบร้อยแล้ว',
            timer: 2000,
            showConfirmButton: false
        });

    } catch (err) {
        console.error("Save error:", err);
        Swal.fire('เกิดข้อผิดพลาด', err.message || 'ไม่สามารถบันทึกข้อมูลได้ กรุณาตรวจสอบฐานข้อมูล', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalBtnHtml;
    }
}
