/**
 * app.js - Shared Application Logic
 * Smart Governance Municipality Platform
 */

// =============================================
// SIDEBAR COMPONENT BUILDER
// Renders the sidebar from one shared config
// =============================================
const NAV_ITEMS = [
    { href: 'dashboard.html', icon: 'fa-solid fa-chart-pie', label: 'แดชบอร์ด', key: 'dashboard', depts: [] },
    { href: 'digital-data-dashboard.html', icon: 'fa-solid fa-database', label: 'Digital Data Center', key: 'digital-data-dashboard', depts: [] },
    { href: 'digital-data-map.html', icon: 'fa-solid fa-map-location-dot', label: 'GIS Map', key: 'digital-data-map', depts: [], parent: 'digital-data-dashboard' },
    { href: 'digital-data-households.html', icon: 'fa-solid fa-house-chimney', label: 'ครัวเรือน', key: 'digital-data-households', depts: [], parent: 'digital-data-dashboard' },
    { href: 'digital-data-population.html', icon: 'fa-solid fa-users', label: 'ประชากร', key: 'digital-data-population', depts: [], parent: 'digital-data-dashboard' },
    { href: 'digital-data-elderly.html', icon: 'fa-solid fa-person-cane', label: 'ผู้สูงอายุ', key: 'digital-data-elderly', depts: [], parent: 'digital-data-dashboard' },
    { href: 'digital-data-disabled.html', icon: 'fa-solid fa-wheelchair', label: 'ผู้พิการ', key: 'digital-data-disabled', depts: [], parent: 'digital-data-dashboard' },
    { href: 'digital-data-bedridden.html', icon: 'fa-solid fa-bed-pulse', label: 'ผู้ป่วยติดเตียง', key: 'digital-data-bedridden', depts: [], parent: 'digital-data-dashboard' },
    { href: 'digital-data-newborn.html', icon: 'fa-solid fa-baby', label: 'เด็กแรกเกิด', key: 'digital-data-newborn', depts: [], parent: 'digital-data-dashboard' },
    { href: 'digital-data-poor.html', icon: 'fa-solid fa-hand-holding-heart', label: 'ครัวเรือนยากจน', key: 'digital-data-poor', depts: [], parent: 'digital-data-dashboard' },
    { href: 'digital-data-scholars.html', icon: 'fa-solid fa-graduation-cap', label: 'ปราชญ์ชุมชน', key: 'digital-data-scholars', depts: [], parent: 'digital-data-dashboard' },
    { href: 'digital-data-leaders.html', icon: 'fa-solid fa-people-group', label: 'ผู้นำ/อาสาสมัคร', key: 'digital-data-leaders', depts: [], parent: 'digital-data-dashboard' },
    { href: 'secretary.html', icon: 'fa-solid fa-building-user', label: 'สำนักปลัด', key: 'secretary', depts: ['สำนักปลัด'] },
    { href: 'secretary-documents.html', icon: 'fa-solid fa-file-signature', label: 'งานสารบรรณ', key: 'secretary-documents', depts: ['สำนักปลัด'], parent: 'secretary' },
    { href: 'secretary-meetings.html', icon: 'fa-solid fa-calendar-check', label: 'งานประชุม', key: 'secretary-meetings', depts: ['สำนักปลัด'], parent: 'secretary' },
    { href: 'secretary-attendance.html', icon: 'fa-solid fa-camera', label: 'ระบบลงเวลาใบหน้า', key: 'secretary-attendance', depts: ['สำนักปลัด'], parent: 'secretary' },
    { href: 'secretary-leave.html', icon: 'fa-solid fa-envelope-open-text', label: 'ระบบลางานออนไลน์', key: 'secretary-leave', depts: ['สำนักปลัด'], parent: 'secretary' },
    { href: 'secretary-vehicle.html', icon: 'fa-solid fa-car', label: 'ระบบขอใช้รถราชการ', key: 'secretary-vehicle', depts: ['สำนักปลัด'], parent: 'secretary' },
    { href: 'secretary-calendar.html', icon: 'fa-solid fa-calendar-days', label: 'ปฏิทินงานองค์กร', key: 'secretary-calendar', depts: ['สำนักปลัด'], parent: 'secretary' },
    { href: 'secretary-cctv.html', icon: 'fa-solid fa-video', label: 'ระบบกล้อง CCTV', key: 'secretary-cctv', depts: ['สำนักปลัด'], parent: 'secretary' },
    { href: 'secretary-complaints.html', icon: 'fa-solid fa-headset', label: 'งานร้องเรียน', key: 'secretary-complaints', depts: ['สำนักปลัด'], parent: 'secretary' },
    { href: 'finance.html', icon: 'fa-solid fa-file-invoice-dollar', label: 'กองคลัง', key: 'finance', depts: ['กองคลัง'] },
    { href: 'waste-dashboard.html', icon: 'fa-solid fa-trash-can', label: 'ค่าธรรมเนียมขยะ', key: 'waste-dashboard', depts: ['กองคลัง'], parent: 'finance' },
    { href: 'waste-customers.html', icon: 'fa-solid fa-address-book', label: 'ทะเบียนลูกค้า', key: 'waste-customers', depts: ['กองคลัง'], parent: 'waste-dashboard' },
    { href: 'waste-payments.html', icon: 'fa-solid fa-hand-holding-dollar', label: 'รับชำระเงิน', key: 'waste-payments', depts: ['กองคลัง'], parent: 'waste-dashboard' },
    { href: 'waste-reports.html', icon: 'fa-solid fa-chart-bar', label: 'รายงานรายรับ', key: 'waste-reports', depts: ['กองคลัง'], parent: 'waste-dashboard' },
    { href: 'waste-kor3.html?v=1781176854926', icon: 'fa-solid fa-table-cells', label: 'กค.3 รายเดือน', key: 'waste-kor3', depts: ['กองคลัง'], parent: 'waste-dashboard' },
    { href: 'waste-invoices.html', icon: 'fa-solid fa-file-invoice', label: 'ใบแจ้งหนี้ค่าขยะ', key: 'waste-invoices', depts: ['กองคลัง'], parent: 'waste-dashboard' },
    { href: 'waste-debtors.html', icon: 'fa-solid fa-user-clock', label: 'ลูกหนี้ค้างชำระ', key: 'waste-debtors', depts: ['กองคลัง'], parent: 'waste-dashboard' },
    { href: 'waste-map.html', icon: 'fa-solid fa-map-location-dot', label: 'แผนที่ลูกค้า', key: 'waste-map', depts: ['กองคลัง'], parent: 'waste-dashboard' },
    { href: 'waste-staff.html', icon: 'fa-solid fa-users-gear', label: 'เจ้าหน้าที่รับชำระ', key: 'waste-staff', depts: ['กองคลัง'], parent: 'waste-dashboard' },
    { href: 'waste-register-request.html', icon: 'fa-solid fa-user-plus', label: 'คำขอขึ้นทะเบียน', key: 'waste-register-request', depts: ['กองคลัง'], parent: 'waste-dashboard' },
    { href: 'waste-cancel-request.html', icon: 'fa-solid fa-user-minus', label: 'คำขอยกเลิกบริการ', key: 'waste-cancel-request', depts: ['กองคลัง'], parent: 'waste-dashboard' },
    { href: 'waste-excel-import.html', icon: 'fa-solid fa-file-excel', label: 'Smart Excel Import', key: 'waste-excel-import', depts: ['กองคลัง'], parent: 'waste-dashboard' },
    { href: 'waste-logs.html', icon: 'fa-solid fa-clock-rotate-left', label: 'LOG ประวัติการใช้งาน', key: 'waste-logs', depts: ['กองคลัง'], parent: 'waste-dashboard' },
    { href: 'waste-settings.html', icon: 'fa-solid fa-gear', label: 'ตั้งค่า', key: 'waste-settings', depts: ['กองคลัง'], parent: 'waste-dashboard' },
    { href: 'publicworks.html', icon: 'fa-solid fa-hard-hat', label: 'กองช่าง', key: 'publicworks', depts: ['กองช่าง'] },
    { href: 'publicworks-electric.html', icon: 'fa-solid fa-bolt', label: 'ซ่อมบำรุงไฟฟ้า', key: 'publicworks-electric', depts: ['กองช่าง'], parent: 'publicworks' },
    { href: 'publicworks-electric-registry.html', icon: 'fa-solid fa-clipboard-list', label: 'ทะเบียนเสาไฟ', key: 'publicworks-electric-registry', depts: ['กองช่าง'], parent: 'publicworks-electric' },
    { href: 'publicworks-electric-map.html', icon: 'fa-solid fa-map-location-dot', label: 'แผนที่เสาไฟ', key: 'publicworks-electric-map', depts: ['กองช่าง'], parent: 'publicworks-electric' },
    { href: 'publicworks-electric-stock.html', icon: 'fa-solid fa-boxes-stacked', label: 'คลังอุปกรณ์', key: 'publicworks-electric-stock', depts: ['กองช่าง'], parent: 'publicworks-electric' },
    { href: 'publicworks-electric-staff.html', icon: 'fa-solid fa-users', label: 'เจ้าหน้าที่ไฟฟ้า', key: 'publicworks-electric-staff', depts: ['กองช่าง'], parent: 'publicworks-electric' },
    { href: 'digital-infrastructure-dashboard.html', icon: 'fa-solid fa-server', label: 'Digital Infrastructure', key: 'digital-infrastructure-dashboard', depts: ['กองช่าง'], parent: 'publicworks' },
    { href: 'digital-infrastructure-map.html', icon: 'fa-solid fa-map-location-dot', label: 'แผนที่โครงสร้างพื้นฐาน', key: 'digital-infrastructure-map', depts: ['กองช่าง'], parent: 'digital-infrastructure-dashboard' },
    { href: 'digital-infrastructure-roads.html', icon: 'fa-solid fa-road', label: 'ทะเบียนถนนและโครงข่าย', key: 'digital-infrastructure-roads', depts: ['กองช่าง'], parent: 'digital-infrastructure-dashboard' },
    { href: 'digital-infrastructure-water.html', icon: 'fa-solid fa-droplet', label: 'แหล่งน้ำและเส้นทางน้ำ', key: 'digital-infrastructure-water', depts: ['กองช่าง'], parent: 'digital-infrastructure-dashboard' },
    { href: 'digital-infrastructure-public-land.html', icon: 'fa-solid fa-tree', label: 'ที่สาธารณประโยชน์', key: 'digital-infrastructure-public-land', depts: ['กองช่าง'], parent: 'digital-infrastructure-dashboard' },
    { href: 'digital-infrastructure-boundary.html', icon: 'fa-solid fa-draw-polygon', label: 'แนวเขตและหลักเขต', key: 'digital-infrastructure-boundary', depts: ['กองช่าง'], parent: 'digital-infrastructure-dashboard' },
    { href: 'digital-infrastructure-repairs.html', icon: 'fa-solid fa-wrench', label: 'ประวัติการซ่อมบำรุง', key: 'digital-infrastructure-repairs', depts: ['กองช่าง'], parent: 'digital-infrastructure-dashboard' },
    { href: 'digital-infrastructure-permits.html', icon: 'fa-solid fa-file-signature', label: 'E-Permit & ขอทุน', key: 'digital-infrastructure-permits', depts: ['กองช่าง'], parent: 'digital-infrastructure-dashboard' },
    { href: 'health.html', icon: 'fa-solid fa-leaf', label: 'กองสาธารณสุขฯ', key: 'health', depts: ['กองสาธารณสุขฯ'] },
    { href: 'healthcare-dashboard.html', icon: 'fa-solid fa-hand-holding-heart', label: 'ระบบดูแลกลุ่มเปราะบางและผู้ที่มีภาวะพึ่งพิง', key: 'ph-vulnerable', depts: ['กองสาธารณสุขฯ'], parent: 'health' },
    { href: 'healthcare-dashboard.html', icon: 'fa-solid fa-chart-pie', label: 'แดชบอร์ดผู้บริหาร', key: 'healthcare-dashboard', depts: ['กองสาธารณสุขฯ'], parent: 'ph-vulnerable' },
    { href: 'ph-elderly.html', icon: 'fa-solid fa-person-cane', label: 'ข้อมูลผู้สูงอายุ', key: 'ph-elderly', depts: ['กองสาธารณสุขฯ'], parent: 'ph-vulnerable' },
    { href: 'ph-disabled.html', icon: 'fa-solid fa-wheelchair', label: 'ข้อมูลผู้พิการ', key: 'ph-disabled', depts: ['กองสาธารณสุขฯ'], parent: 'ph-vulnerable' },
    { href: 'ph-bedridden.html', icon: 'fa-solid fa-bed-pulse', label: 'ข้อมูลผู้ป่วยติดเตียง', key: 'ph-bedridden', depts: ['กองสาธารณสุขฯ'], parent: 'ph-vulnerable' },
    { href: 'ph-dependent.html', icon: 'fa-solid fa-hospital-user', label: 'ฐานข้อมูลผู้ที่มีภาวะพึ่งพิง', key: 'ph-dependent', depts: ['กองสาธารณสุขฯ'], parent: 'ph-vulnerable' },
    { href: 'cg-dashboard.html', icon: 'fa-solid fa-user-nurse', label: 'Care Giver (CG)', key: 'cg-dashboard', depts: ['กองสาธารณสุขฯ'], parent: 'ph-vulnerable' },
    { href: 'cm-dashboard.html', icon: 'fa-solid fa-user-doctor', label: 'Care Manager (CM)', key: 'cm-dashboard', depts: ['กองสาธารณสุขฯ'], parent: 'ph-vulnerable' },
    { href: 'ph-ems-dashboard.html', icon: 'fa-solid fa-ambulance', label: 'ระบบงานรถฉุกเฉิน EMS อัจฉริยะ', key: 'ph-ems', depts: ['กองสาธารณสุขฯ'], parent: 'health' },
    { href: 'ph-ems-dashboard.html', icon: 'fa-solid fa-chart-line', label: 'Dashboard', key: 'ph-ems-dashboard', depts: ['กองสาธารณสุขฯ'], parent: 'ph-ems' },
    { href: 'ph-ems-incident.html', icon: 'fa-solid fa-phone-volume', label: 'รับแจ้งเหตุฉุกเฉิน', key: 'ph-ems-incident', depts: ['กองสาธารณสุขฯ'], parent: 'ph-ems' },
    { href: 'ph-ems-dispatch.html', icon: 'fa-solid fa-satellite-dish', label: 'ศูนย์สั่งการ EMS', key: 'ph-ems-dispatch', depts: ['กองสาธารณสุขฯ'], parent: 'ph-ems' },
    { href: 'ph-ems-gps.html', icon: 'fa-solid fa-location-crosshairs', label: 'GPS ติดตามรถ', key: 'ph-ems-gps', depts: ['กองสาธารณสุขฯ'], parent: 'ph-ems' },
    { href: 'ph-ems-vehicles.html', icon: 'fa-solid fa-truck-medical', label: 'ข้อมูลรถ EMS', key: 'ph-ems-vehicles', depts: ['กองสาธารณสุขฯ'], parent: 'ph-ems' },
    { href: 'ph-ems-maintenance.html', icon: 'fa-solid fa-screwdriver-wrench', label: 'ซ่อมบำรุงรถ', key: 'ph-ems-maintenance', depts: ['กองสาธารณสุขฯ'], parent: 'ph-ems' },
    { href: 'ph-ems-personnel.html', icon: 'fa-solid fa-user-nurse', label: 'บุคลากร EMS', key: 'ph-ems-personnel', depts: ['กองสาธารณสุขฯ'], parent: 'ph-ems' },
    { href: 'ph-ems-shifts.html', icon: 'fa-solid fa-calendar-day', label: 'เวรปฏิบัติงาน', key: 'ph-ems-shifts', depts: ['กองสาธารณสุขฯ'], parent: 'ph-ems' },
    { href: 'ph-ems-pcr.html', icon: 'fa-solid fa-file-medical', label: 'Patient Care Report', key: 'ph-ems-pcr', depts: ['กองสาธารณสุขฯ'], parent: 'ph-ems' },
    { href: 'ph-ems-gis.html', icon: 'fa-solid fa-map-location-dot', label: 'GIS และแผนที่', key: 'ph-ems-gis', depts: ['กองสาธารณสุขฯ'], parent: 'ph-ems' },
    { href: 'ph-ems-reports.html', icon: 'fa-solid fa-file-contract', label: 'รายงานและ KPI', key: 'ph-ems-reports', depts: ['กองสาธารณสุขฯ'], parent: 'ph-ems' },
    { href: 'ph-ems-settings.html', icon: 'fa-solid fa-gear', label: 'ตั้งค่าระบบ', key: 'ph-ems-settings', depts: ['กองสาธารณสุขฯ'], parent: 'ph-ems' },
    { href: 'education.html', icon: 'fa-solid fa-graduation-cap', label: 'กองการศึกษา', key: 'education', depts: ['กองการศึกษา'] },
    { href: 'childdev-dashboard.html', icon: 'fa-solid fa-child-reaching', label: 'ศูนย์พัฒนาเด็กเล็ก', key: 'childdev-dashboard', depts: ['กองการศึกษา'], parent: 'education' },
    { href: 'childdev-students.html', icon: 'fa-solid fa-id-card', label: 'ข้อมูลนักเรียน', key: 'childdev-students', depts: ['กองการศึกษา'], parent: 'childdev-dashboard' },
    { href: 'childdev-attendance.html', icon: 'fa-solid fa-camera', label: 'เช็คชื่อด้วยใบหน้า', key: 'childdev-attendance', depts: ['กองการศึกษา'], parent: 'childdev-dashboard' },
    { href: 'childdev-attendance-records.html', icon: 'fa-solid fa-clipboard-list', label: 'ข้อมูลรายการเช็คชื่อ', key: 'childdev-attendance-records', depts: ['กองการศึกษา'], parent: 'childdev-dashboard' },
    { href: 'childdev-health.html', icon: 'fa-solid fa-heart-pulse', label: 'ตรวจสุขภาพประจำวัน', key: 'childdev-health', depts: ['กองการศึกษา'], parent: 'childdev-dashboard' },
    { href: 'childdev-lunch.html', icon: 'fa-solid fa-utensils', label: 'อาหารกลางวัน', key: 'childdev-lunch', depts: ['กองการศึกษา'], parent: 'childdev-dashboard' },
    { href: 'childdev-activities.html', icon: 'fa-solid fa-palette', label: 'กิจกรรมในชั้นเรียน', key: 'childdev-activities', depts: ['กองการศึกษา'], parent: 'childdev-dashboard' },
    { href: 'childdev-map.html', icon: 'fa-solid fa-map-pin', label: 'แผนที่บ้านเด็ก', key: 'childdev-map', depts: ['กองการศึกษา'], parent: 'childdev-dashboard' },
    { href: 'childdev-bmi.html', icon: 'fa-solid fa-weight-scale', label: 'คำนวณ BMI', key: 'childdev-bmi', depts: ['กองการศึกษา'], parent: 'childdev-dashboard' },
    { href: 'childdev-reports.html', icon: 'fa-solid fa-chart-column', label: 'รายงาน', key: 'childdev-reports', depts: ['กองการศึกษา'], parent: 'childdev-dashboard' },
    { href: 'childdev-classroom.html', icon: 'fa-solid fa-chalkboard-user', label: 'จัดการห้องเรียน', key: 'childdev-classroom', depts: ['กองการศึกษา'], parent: 'childdev-dashboard' },
    { href: 'welfare.html', icon: 'fa-solid fa-hands-holding-child', label: 'กองสวัสดิการฯ', key: 'welfare', depts: ['กองสวัสดิการฯ'] },
    { href: 'welfare-elderly.html', icon: 'fa-solid fa-person-cane', label: 'ข้อมูลผู้สูงอายุ', key: 'welfare-elderly', depts: ['กองสวัสดิการฯ'], parent: 'welfare' },
    { href: 'welfare-disabled.html', icon: 'fa-solid fa-wheelchair', label: 'ข้อมูลผู้พิการ', key: 'welfare-disabled', depts: ['กองสวัสดิการฯ'], parent: 'welfare' },
    { href: 'welfare-bedridden.html', icon: 'fa-solid fa-bed-pulse', label: 'ข้อมูลผู้ป่วยติดเตียง', key: 'welfare-bedridden', depts: ['กองสวัสดิการฯ'], parent: 'welfare' },
    { href: 'welfare-newborn.html', icon: 'fa-solid fa-baby', label: 'ข้อมูลเด็กแรกเกิด', key: 'welfare-newborn', depts: ['กองสวัสดิการฯ'], parent: 'welfare' },
    { href: 'planning.html', icon: 'fa-solid fa-chart-line', label: 'กองยุทธศาสตร์ฯ', key: 'planning', depts: ['กองยุทธศาสตร์ฯ'] },
];

/**
 * ตรวจสอบสิทธิ์การเข้าถึงแต่ละเมนูในระบบค่าธรรมเนียมขยะ ('edit' | 'view' | 'none')
 */
function getUserWasteMenuPermission(menuKey) {
    if (!menuKey || !String(menuKey).startsWith('waste-')) return 'edit';
    const user = getSessionUser();
    if (!user) return 'none';

    const userRole = String(user.role || '').toLowerCase();
    const wasteRole = String(user.waste_role || '').toLowerCase();
    if (userRole === 'super admin' || userRole === 'admin' || wasteRole === 'admin') {
        return 'edit';
    }

    // ตรวจสอบจากข้อมูล waste_staff ล่าสุดใน localStorage (ถ้ามี)
    try {
        const rawStaff = localStorage.getItem('waste_staff');
        if (rawStaff) {
            const list = JSON.parse(rawStaff) || [];
            const matched = list.find(s =>
                (s.username && user.username && s.username === user.username) ||
                (s.id && user.id && s.id === user.id) ||
                (s.name && user.name && s.name === user.name)
            );
            if (matched) {
                let cleanRole = String(matched.role || 'Officer');
                let meta = {};
                if (cleanRole.includes('||')) {
                    const parts = cleanRole.split('||');
                    cleanRole = parts[0] || 'Officer';
                    try { meta = JSON.parse(parts.slice(1).join('||')) || {}; } catch (e) {}
                }
                if (cleanRole.toLowerCase() === 'admin') return 'edit';
                const perms = matched.permissions || meta.permissions;
                if (perms && perms[menuKey]) return perms[menuKey];
            }
        }
    } catch (e) {}

    if (user.waste_permissions && user.waste_permissions[menuKey]) {
        return user.waste_permissions[menuKey];
    }

    return 'edit';
}

function buildSidebar(activeKey) {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    // Get current page filename to auto-detect active
    if (!activeKey) {
        const page = window.location.pathname.split('/').pop().replace('.html', '');
        activeKey = page;
    }

    // กรองเมนูตามกองและบทบาท
    const user = getSessionUser();
    if (!user) {
        console.warn("Sidebar: No user session found");
        return;
    }

    console.log("Building sidebar for user:", user);

    const userRole = (user.role || '').toLowerCase();
    const userDept = user.dept || '';

    const filteredNav = NAV_ITEMS.filter(item => {
        if (String(item.key).startsWith('waste-')) {
            const perm = getUserWasteMenuPermission(item.key);
            if (perm === 'none') return false;
        }
        if (userRole === 'super admin') return true;
        if (item.depts && item.depts.includes('ALL')) return true;
        return item.depts && item.depts.includes(userDept);
    });

    // Find if current activeKey has a parent
    const activeItem = NAV_ITEMS.find(i => i.key === activeKey);
    const activeParentKey = activeItem ? activeItem.parent : null;

    const localSettings = JSON.parse(localStorage.getItem('waste_settings') || '{}');
    const orgName = localSettings.org_name || '';
    const logoUrl = localSettings.org_logo || 'assets/img/garuda.png';

    sidebar.innerHTML = `
        <div class="sidebar-header d-flex flex-column align-items-center text-center">
            <img id="sidebar-org-logo" src="${logoUrl}"
                 alt="GOOD GOV" style="max-height:60px; border-radius: 12px; margin-bottom: 0.75rem;">
            <h6 class="fw-bold mb-1">GOOD GOV</h6>
            <small id="sidebar-org-name" class="fw-semibold mt-1 d-block" style="color: #60a5fa; font-size: 0.75rem; line-height: 1.2;">${orgName}</small>
            <small id="sidebar-role-label" class="opacity-75 mt-1">กำลังโหลด...</small>
        </div>

        <ul class="list-unstyled components" id="nav-list">
            <li class="sidebar-section-label">เมนูหลัก</li>
            ${filteredNav.map(item => {
                // Determine level based on parent
                let level = 1;
                let currentParent = item.parent;
                while (currentParent) {
                    level++;
                    const parentItem = NAV_ITEMS.find(i => i.key === currentParent);
                    currentParent = parentItem ? parentItem.parent : null;
                }
                
                // For level 3+, we only show them if they are in the active tree
                if (level >= 3) {
                    let isFamily = false;
                    let curr = activeItem;
                    while (curr) {
                        if (curr.parent === item.parent || curr.key === item.parent || curr.key === item.key) {
                            isFamily = true;
                            break;
                        }
                        curr = NAV_ITEMS.find(i => i.key === curr.parent);
                    }
                    if (!isFamily) return '';
                }

                const wastePerm = String(item.key).startsWith('waste-') ? getUserWasteMenuPermission(item.key) : 'edit';
                const viewOnlyTag = wastePerm === 'view'
                    ? `<span class="badge bg-info bg-opacity-25 text-info ms-auto" style="font-size:0.62rem;font-weight:500;">ดูอย่างเดียว</span>`
                    : '';
                
                return `
                <li class="nav-level-${Math.min(level, 3)} ${item.key === activeKey ? 'active' : ''}">
                    <a href="${item.href}" class="d-flex align-items-center">
                        <i class="${item.icon}"></i>
                        <span>${item.label}</span>
                        ${viewOnlyTag}
                    </a>
                </li>
                `;
            }).join('')}
            
            ${userRole === 'super admin' ? `
            <li class="sidebar-section-label mt-2">ระบบ</li>
            <li>
                <a href="settings.html" class="${activeKey === 'settings' ? 'active' : ''}">
                    <i class="fa-solid fa-gear"></i>
                    <span>ตั้งค่าระบบ</span>
                </a>
            </li>` : ''}
        </ul>

        <div class="p-3" style="border-top: 1px solid rgba(255,255,255,0.08);">
            <a href="javascript:void(0)" onclick="logout()" class="d-flex align-items-center gap-2 py-2 px-2 rounded text-sm"
               style="color: #f87171; transition: background 0.15s;"
               onmouseover="this.style.background='rgba(248,113,113,0.1)'"
               onmouseout="this.style.background='transparent'">
                <i class="fa-solid fa-right-from-bracket" style="width:20px; text-align:center;"></i>
                ออกจากระบบ
            </a>
        </div>
    `;

    // Set role label from session (using already declared 'user')
    const roleEl = document.getElementById('sidebar-role-label');
    if (roleEl) roleEl.textContent = user.role || 'ผู้ดูแลระบบ';

    // Asynchronously load settings to update logo and org name
    setTimeout(async () => {
        let settings = null;
        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                const { data } = await supabaseClient.from('waste_settings').select('org_name, org_logo').limit(1).single();
                if (data) settings = data;
            } catch (e) {}
        }
        if (!settings) {
            const local = localStorage.getItem('waste_settings');
            if (local) settings = JSON.parse(local);
        }
        if (settings) {
            const logoEl = document.getElementById('sidebar-org-logo');
            const nameEl = document.getElementById('sidebar-org-name');
            if (logoEl && settings.org_logo) logoEl.src = settings.org_logo;
            if (nameEl && settings.org_name) nameEl.textContent = settings.org_name;
        }
    }, 100);
}

// =============================================
// TOP NAVBAR BUILDER
// =============================================
function buildNavbar(pageTitle) {
    const navbar = document.getElementById('top-navbar');
    if (!navbar) return;
    const user = getSessionUser();
    if (!user) return;

    let notificationsHtml = '';
    const userRole = (user.role || '').toLowerCase();
    const userDept = user.dept || '';

    // Contextual Notifications
    if (userDept === 'กองคลัง' || userRole === 'super admin') {
        notificationsHtml = `
            <li class="px-3 pt-2 pb-1"><h6 class="fw-bold mb-0 text-sm">การแจ้งเตือน (กองคลัง)</h6></li>
            <li><hr class="dropdown-divider my-1"></li>
            <li><a class="dropdown-item py-2 text-sm" href="waste-payments.html"><i class="fa-solid fa-coins text-success me-2"></i>มีรายการรับชำระรอตรวจสอบ</a></li>
            <li><a class="dropdown-item py-2 text-sm" href="waste-debtors.html"><i class="fa-solid fa-user-clock text-warning me-2"></i>พบลูกหนี้ค้างชำระเกินกำหนด</a></li>
        `;
    } else {
        notificationsHtml = `
            <li class="px-3 pt-2 pb-1"><h6 class="fw-bold mb-0 text-sm">การแจ้งเตือน</h6></li>
            <li><hr class="dropdown-divider my-1"></li>
            <li><a class="dropdown-item py-2 text-sm" href="#"><i class="fa-regular fa-bell text-info me-2"></i>ไม่มีการแจ้งเตือนใหม่</a></li>
        `;
    }

    // Back button logic for Waste pages
    const isWastePage = window.location.pathname.includes('waste-') && !window.location.pathname.includes('waste-dashboard.html');
    const backBtnHtml = isWastePage ? `<button onclick="window.location.href='waste-dashboard.html'" class="btn btn-sm btn-light ms-2 d-flex align-items-center gap-1 border border-secondary border-opacity-25" title="กลับหน้าหลักค่าขยะ"><i class="fa-solid fa-arrow-left"></i> <span class="d-none d-sm-inline">ย้อนกลับ</span></button>` : '';

    navbar.innerHTML = `
        <div class="d-flex align-items-center">
            <button type="button" id="sidebarCollapse" class="btn btn-sm btn-primary d-flex align-items-center gap-1">
                <i class="fa-solid fa-bars"></i>
            </button>
            ${backBtnHtml}
            <h5 class="page-title mb-0 ms-3 d-none d-md-block" style="border-left: 2px solid #e5e7eb; padding-left: 1rem;">${pageTitle || 'ระบบบริหารจัดการเทศบาลอัจฉริยะ'}</h5>
        </div>

        <div class="ms-auto d-flex align-items-center gap-3">
            <!-- Global Search -->
            <div class="d-none d-md-flex input-group input-group-sm" style="width: 220px;">
                <span class="input-group-text bg-light border-end-0"><i class="fa-solid fa-search text-muted"></i></span>
                <input type="text" class="form-control border-start-0 bg-light" placeholder="ค้นหาทั่วระบบ...">
            </div>

            <!-- Notifications -->
            <div class="dropdown">
                <button class="btn btn-sm btn-light position-relative" data-bs-toggle="dropdown">
                    <i class="fa-solid fa-bell"></i>
                    <span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style="font-size:0.6rem;">${userDept === 'กองคลัง' ? '2' : '0'}</span>
                </button>
                <ul class="dropdown-menu dropdown-menu-end shadow" style="min-width:280px; border:none; border-radius:12px;">
                    ${notificationsHtml}
                </ul>
            </div>

            <!-- User Menu -->
            <div class="dropdown">
                <button class="btn btn-sm btn-light d-flex align-items-center gap-2 px-2 dropdown-toggle" data-bs-toggle="dropdown">
                    <img src="${getDriveThumbnail(user.avatar) || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name) + '&background=1a56db&color=fff&size=64'}"
                         class="rounded-circle shadow-sm object-fit-cover" width="28" height="28" alt="User"
                         onerror="this.src='https://ui-avatars.com/api/?name=' + encodeURIComponent('${user.name}')">
                    <span class="d-none d-md-inline text-sm fw-semibold">${user.name}</span>
                </button>
                <ul class="dropdown-menu dropdown-menu-end shadow" style="border:none; border-radius:12px; min-width:180px;">
                    <li class="px-3 pt-2 pb-1">
                        <span class="d-block fw-semibold text-sm">${user.name}</span>
                        <span class="text-xs text-muted">${user.role}</span>
                    </li>
                    <li><hr class="dropdown-divider my-1"></li>
                    <li><a class="dropdown-item text-sm py-2" href="#"><i class="fa-solid fa-user me-2 text-muted"></i>โปรไฟล์ของฉัน</a></li>
                    <li><a class="dropdown-item text-sm py-2" href="settings.html"><i class="fa-solid fa-gear me-2 text-muted"></i>ตั้งค่า</a></li>
                    <li><hr class="dropdown-divider my-1"></li>
                    <li><a class="dropdown-item text-sm py-2 text-danger" href="javascript:void(0)" onclick="logout()"><i class="fa-solid fa-right-from-bracket me-2"></i>ออกจากระบบ</a></li>
                </ul>
            </div>
        </div>
    `;
    
    // Re-init sidebar toggle after replacing HTML
    initSidebarToggle();
}

// =============================================
// SESSION / AUTH
// =============================================
function getSessionUser() {
    try {
        const stored = localStorage.getItem('sgov_user') || sessionStorage.getItem('sgov_user');
        if (stored) {
            const user = JSON.parse(stored);
            return user;
        }
    } catch (e) {
        console.error("Session Error:", e);
    }
    return null;
}

function setSessionUser(user, remember = true) {
    const data = JSON.stringify(user);
    if (remember) localStorage.setItem('sgov_user', data);
    else sessionStorage.setItem('sgov_user', data);

    if (user) {
        try {
            const logEntry = {
                id: 'LOG-AUTH-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
                created_at: new Date().toISOString(),
                category: 'auth',
                action_type: 'LOGIN',
                action_label: 'เข้าสู่ระบบ',
                module: 'ระบบยืนยันตัวตน',
                module_key: 'auth',
                target_id: user.username || user.id || '-',
                target_name: user.name || user.username || 'ผู้ใช้งาน',
                detail: `เข้าสู่ระบบสำเร็จ (${user.name || user.username || '-'} • สิทธิ์: ${user.waste_role || user.role || '-'})`,
                actor_name: user.name || user.username || 'ผู้ใช้งาน',
                actor_role: user.waste_role || user.role || 'Officer',
                actor_username: user.username || ''
            };
            const existingLogs = JSON.parse(localStorage.getItem('waste_system_logs') || '[]');
            existingLogs.unshift(logEntry);
            localStorage.setItem('waste_system_logs', JSON.stringify(existingLogs.slice(0, 1500)));
        } catch (e) {}
    }
}

function logout() {
    try {
        const user = getSessionUser();
        if (user) {
            const logEntry = {
                id: 'LOG-AUTH-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
                created_at: new Date().toISOString(),
                category: 'auth',
                action_type: 'LOGOUT',
                action_label: 'ออกจากระบบ',
                module: 'ระบบยืนยันตัวตน',
                module_key: 'auth',
                target_id: user.username || user.id || '-',
                target_name: user.name || user.username || 'ผู้ใช้งาน',
                detail: `ออกจากระบบ (${user.name || user.username || '-'})`,
                actor_name: user.name || user.username || 'ผู้ใช้งาน',
                actor_role: user.waste_role || user.role || 'Officer',
                actor_username: user.username || ''
            };
            const existingLogs = JSON.parse(localStorage.getItem('waste_system_logs') || '[]');
            existingLogs.unshift(logEntry);
            localStorage.setItem('waste_system_logs', JSON.stringify(existingLogs.slice(0, 1500)));
        }
    } catch (e) {}
    localStorage.removeItem('sgov_user');
    sessionStorage.removeItem('sgov_user');
    window.location.href = 'index.html';
}

function getDriveThumbnail(url) {
    if (!url || typeof url !== 'string') return url;
    const match = url.match(/[-\w]{25,}/); 
    if (match && (url.includes('drive.google.com') || url.includes('docs.google.com'))) {
        return `https://drive.google.com/thumbnail?id=${match[0]}&sz=w100`;
    }
    return url;
}

// =============================================
// SIDEBAR TOGGLE
// =============================================
function initSidebarToggle() {
    const btn = document.getElementById('sidebarCollapse');
    const sidebar = document.getElementById('sidebar');
    if (!btn || !sidebar) return;

    // Create overlay for mobile
    let overlay = document.getElementById('sidebar-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'sidebar-overlay';
        document.body.appendChild(overlay);
    }

    btn.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    });

    overlay.addEventListener('click', () => {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    });
}

// =============================================
// ANIMATE ELEMENTS ON SCROLL
// =============================================
function initFadeIn() {
    document.querySelectorAll('.fade-in-up').forEach((el, i) => {
        el.style.animationDelay = `${i * 0.06}s`;
    });
}

// =============================================
// FORMAT HELPERS
// =============================================
function formatThaiDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('th-TH', { style: 'decimal', minimumFractionDigits: 2 }).format(amount);
}

// =============================================
// TOAST NOTIFICATIONS
// =============================================
function showToast(message, type = 'success') {
    const colors = { success: '#057a55', danger: '#c81e1e', warning: '#c27803', info: '#0694a2' };
    const icons = { success: 'fa-circle-check', danger: 'fa-circle-xmark', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };

    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 9999;
        background: #fff; border-left: 4px solid ${colors[type]};
        border-radius: 10px; padding: 0.85rem 1.25rem;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        display: flex; align-items: center; gap: 0.75rem;
        font-family: 'Prompt', sans-serif; font-size: 0.875rem;
        animation: fadeInUp 0.3s ease;
        min-width: 260px; max-width: 360px;
    `;
    toast.innerHTML = `
        <i class="fa-solid ${icons[type]}" style="color:${colors[type]}; font-size: 1.1rem;"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 3500);
}

// =============================================
// QR CODE GENERATOR (PromptPay)
// =============================================
function generatePromptPayQR(amount, refId) {
    // In production: call actual PromptPay QR generation API or library
    // This is a placeholder that opens a QR code service
    const ppId = '0994000165938'; // Replace with municipality's PromptPay ID
    return `https://promptpay.io/${ppId}/${amount}`;
}

function enforceWasteViewOnlyMode() {
    const pageContent = document.querySelector('.page-content');
    if (pageContent && !document.getElementById('wasteViewOnlyBanner')) {
        const banner = document.createElement('div');
        banner.id = 'wasteViewOnlyBanner';
        banner.className = 'alert alert-info border-0 shadow-sm rounded-3 mb-3 py-2 px-3 d-flex align-items-center justify-content-between flex-wrap gap-2';
        banner.innerHTML = `
            <div class="text-sm">
                <i class="fa-solid fa-eye text-primary me-2"></i>
                <strong>โหมดดูข้อมูลอย่างเดียว (View Only):</strong> บัญชีของคุณได้รับสิทธิ์ให้<strong>ดูข้อมูลในเมนูนี้ได้อย่างเดียว</strong> ไม่สามารถเพิ่ม แก้ไข ลบ นำเข้า (Import) ส่งออกรายงาน (Export) หรือส่งแจ้งเตือน LINE ได้
            </div>
            <span class="badge bg-primary rounded-pill">สิทธิ์: ดูอย่างเดียว</span>
        `;
        pageContent.insertBefore(banner, pageContent.firstChild);
    }

    const disableActionEl = (el) => {
        if (!el) return;
        if (el.closest('#sidebar') || el.closest('#top-navbar')) return;
        if (el.dataset.allowSelfEdit === 'true' || el.closest('[data-allow-self-edit="true"]')) return;

        el.disabled = true;
        el.classList.add('opacity-50', 'disabled');
        el.title = 'บัญชีของคุณได้รับสิทธิ์ดูข้อมูลอย่างเดียวในเมนูนี้';
        el.removeAttribute('onclick');
        if (el.tagName === 'A') {
            el.removeAttribute('data-bs-toggle');
            el.removeAttribute('href');
            el.style.pointerEvents = 'none';
            el.style.cursor = 'not-allowed';
        }
    };

    const lockWriteControls = () => {
        const writeKeywords = [
            'เพิ่ม', 'บันทึก', 'แก้ไข', 'ลบ', 'อนุมัติ', 'ปฏิเสธ', 'ยืนยันรับชำระ',
            'นำเข้า', 'Import', 'Export', 'ส่งออก', 'Excel', 'PDF', 'CSV', 'ดาวน์โหลดเทมเพลต',
            'ล้างข้อมูล', 'ส่งแจ้งเตือน', 'แจ้งเตือนทั้งหมด', 'แจ้งชำระเงิน', 'แจ้งค้างชำระ', 'แจ้งเตือนทาง LINE',
            'Generate', 'อัปโหลด'
        ];
        const writeSelectors = [
            'button[type="submit"]',
            'button[onclick*="openAdd"]',
            'button[onclick*="edit"]',
            'button[onclick*="Edit"]',
            'button[onclick*="delete"]',
            'button[onclick*="Delete"]',
            'button[onclick*="save"]',
            'button[onclick*="Save"]',
            'button[onclick*="approve"]',
            'button[onclick*="reject"]',
            'button[onclick*="toggle"]',
            'button[onclick*="confirmWalkin"]',
            'button[onclick*="handleImport"]',
            'button[onclick*="import"]',
            'button[onclick*="Import"]',
            'button[onclick*="openKtbImportTab"]',
            'a[onclick*="import"]',
            'a[onclick*="Import"]',
            '#tabKtbImportLink',
            'a[href="#tabKtbImport"]',
            'button[onclick*="export"]',
            'button[onclick*="Export"]',
            'button[onclick*="PDF"]',
            'button[onclick*="pdf"]',
            'button[onclick*="Excel"]',
            'button[onclick*="excel"]',
            'button[onclick*="CSV"]',
            'button[onclick*="csv"]',
            'a[onclick*="export"]',
            'a[onclick*="Export"]',
            'a[onclick*="PDF"]',
            'a[onclick*="Excel"]',
            'button[onclick*="showLineNotifyModal"]',
            'button[onclick*="LineNotify"]',
            'button[onclick*="sendLine"]',
            'button[id^="btn-line-notify-"]',
            'button[onclick*="promptCancel"]',
            'button[onclick*="promptDelete"]',
            'button[onclick*="cancelWaste"]'
        ];

        document.querySelectorAll(writeSelectors.join(',')).forEach(el => {
            disableActionEl(el);
        });

        document.querySelectorAll('.page-content button, .page-content a.nav-link, .modal button').forEach(el => {
            if (el.dataset.allowSelfEdit === 'true' || el.closest('[data-allow-self-edit="true"]')) return;
            if (el.dataset.bsDismiss || el.classList.contains('btn-close') || el.classList.contains('year-btn')) return;
            const txt = (el.innerText || el.title || '').trim();
            if (el.classList.contains('nav-link')) {
                if (txt.includes('นำเข้า') || txt.includes('Import') || txt.includes('KTB-Corporate')) {
                    disableActionEl(el);
                }
                return;
            }
            if (writeKeywords.some(kw => txt.includes(kw))) {
                disableActionEl(el);
            }
        });
    };

    lockWriteControls();
    const obs = new MutationObserver(() => lockWriteControls());
    obs.observe(document.body, { childList: true, subtree: true });
}

// =============================================
// MAIN INIT
// =============================================
document.addEventListener('DOMContentLoaded', function () {
    const user = getSessionUser();
    
    // ตรวจสอบสิทธิ์การเข้าถึงหน้า (Page-level Security)
    const currentPage = window.location.pathname.split('/').pop();
    const currentPageKey = currentPage.replace('.html', '');
    const isLoginPage = currentPage === 'index.html' || currentPage === '' || currentPage === 'index';

    if (!user && !isLoginPage) {
        window.location.href = 'index.html';
        return;
    }

    if (user && !isLoginPage) {
        const currentNavItem = NAV_ITEMS.find(item => item.href.split('?')[0] === currentPage || item.key === currentPageKey);
        const userRole = (user.role || '').toLowerCase();
        const userDept = user.dept || '';

        // ถ้าเป็นหน้าที่มีการจำกัดกอง (และไม่ใช่ Super Admin)
        if (currentNavItem && userRole !== 'super admin') {
            if (!currentNavItem.depts.includes('ALL') && !currentNavItem.depts.includes(userDept)) {
                alert('ขออภัย คุณไม่มีสิทธิ์เข้าใช้งานในส่วนงานนี้');
                let fallback = 'index.html';
                if (userDept === 'กองคลัง') fallback = 'finance.html';
                else if (userDept === 'กองช่าง') fallback = 'publicworks.html';
                else if (userDept === 'กองการศึกษา') fallback = 'education.html';
                else if (userDept === 'กองสาธารณสุขฯ') fallback = 'health.html';
                else if (userDept === 'สำนักปลัด') fallback = 'secretary.html';
                else if (userDept === 'กองสวัสดิการฯ') fallback = 'welfare.html';
                else if (userDept === 'กองยุทธศาสตร์ฯ') fallback = 'planning.html';
                window.location.href = fallback;
                return;
            }
        }

        // ตรวจสอบสิทธิ์รายเมนูของระบบค่าธรรมเนียมขยะ (Waste RBAC)
        if (currentPageKey.startsWith('waste-') && currentPageKey !== 'waste-payment-portal') {
            const perm = getUserWasteMenuPermission(currentPageKey);
            if (perm === 'none') {
                alert('ขออภัย บัญชีของคุณไม่ได้รับสิทธิ์ให้เข้าถึงเมนูนี้');
                const allowedWasteItem = NAV_ITEMS.find(i => String(i.key).startsWith('waste-') && getUserWasteMenuPermission(i.key) !== 'none');
                window.location.href = allowedWasteItem ? allowedWasteItem.href : 'finance.html';
                return;
            } else if (perm === 'view') {
                setTimeout(enforceWasteViewOnlyMode, 150);
            }
        }

        // จำกัดการเข้าถึงหน้า Settings เฉพาะ Super Admin เท่านั้น
        if (currentPage === 'settings.html' && userRole !== 'super admin') {
            alert('เฉพาะผู้ดูแลระบบสูงสุด (Super Admin) เท่านั้นที่สามารถเข้าถึงการตั้งค่าได้');
            let fallback = 'index.html';
            if (userDept === 'กองคลัง') fallback = 'finance.html';
            else if (userDept === 'กองช่าง') fallback = 'publicworks.html';
            window.location.href = fallback;
            return;
        }
    }

    // Auto-build sidebar if present
    const sidebarEl = document.getElementById('sidebar');
    if (sidebarEl) {
        buildSidebar();
        
        // Restore sidebar scroll position
        const savedScroll = sessionStorage.getItem('sidebarScrollPos');
        if (savedScroll) {
            sidebarEl.scrollTop = parseInt(savedScroll, 10);
        }

        // Save sidebar scroll position on scroll
        sidebarEl.addEventListener('scroll', function() {
            sessionStorage.setItem('sidebarScrollPos', this.scrollTop);
        });
    }

    // Auto-build navbar if present
    const navbar = document.getElementById('top-navbar');
    if (navbar) {
        const title = navbar.dataset.title || document.title.split(' - ')[0];
        buildNavbar(title);
    }

    initSidebarToggle();
    initFadeIn();

    // บันทึกประวัติการเข้าใช้งานหน้าเมนูระบบขยะ (Usage Log)
    if (user && !isLoginPage && currentPageKey.startsWith('waste-')) {
        try {
            const lastLoggedPage = sessionStorage.getItem('waste_last_logged_page');
            if (lastLoggedPage !== currentPageKey) {
                sessionStorage.setItem('waste_last_logged_page', currentPageKey);
                const navObj = NAV_ITEMS.find(i => i.key === currentPageKey);
                const menuLabel = navObj ? navObj.label : currentPageKey;
                const logEntry = {
                    id: 'LOG-NAV-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
                    created_at: new Date().toISOString(),
                    category: 'usage',
                    action_type: 'VIEW_MENU',
                    action_label: 'เข้าใช้งานเมนู',
                    module: menuLabel,
                    module_key: currentPageKey,
                    target_id: currentPage,
                    target_name: menuLabel,
                    detail: `เข้าเปิดใช้งานหน้าเมนู "${menuLabel}" (${currentPage})`,
                    actor_name: user.name || user.username || 'ผู้ใช้งาน',
                    actor_role: user.waste_role || user.role || 'Officer',
                    actor_username: user.username || ''
                };
                const existingLogs = JSON.parse(localStorage.getItem('waste_system_logs') || '[]');
                existingLogs.unshift(logEntry);
                localStorage.setItem('waste_system_logs', JSON.stringify(existingLogs.slice(0, 1500)));
            }
        } catch (e) {}
    }
});
