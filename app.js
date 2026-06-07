// Initialize variables
let currentUser = null;

// Firebase Auth Observer
auth.onAuthStateChanged((user) => {
    if (!user) {
        window.location.href = 'login.html';
    } else {
        const userStr = localStorage.getItem('kpi_user');
        if (userStr) {
            currentUser = JSON.parse(userStr);
            initApp();
        } else {
            // Fallback
            db.ref('users/' + user.uid).once('value').then(snap => {
                const data = snap.val();
                if(data) {
                    currentUser = { email: user.email, role: data.role, warehouses: data.warehouses };
                    initApp();
                } else if(user.email === 'nhan.phamtien@shopee.com') {
                    currentUser = { email: user.email, role: 'owner', warehouses: ['ALL'] };
                    initApp();
                } else {
                    window.location.href = 'login.html';
                }
            });
        }
    }
});

function initApp() {
    // Cập nhật Header UI với User Info
    const userProfileName = document.querySelector('.user-profile span');
    if (userProfileName) {
        userProfileName.innerHTML = `${currentUser.email}<br><small style="font-size: 11px; opacity: 0.8; text-transform: uppercase;">${currentUser.role}</small>`;
    }
    const avatar = document.querySelector('.user-profile .avatar');
    if (avatar) {
        avatar.textContent = currentUser.email.charAt(0).toUpperCase();
    }
    
    // Nút Config -> Setting
    const configBtn = document.querySelector('.btn-secondary');
    if (configBtn) {
        if (currentUser.role === 'user') {
            configBtn.style.display = 'none'; // User không được thấy Setting
        } else {
            configBtn.innerHTML = '<i class="fa-solid fa-gear"></i> Setting';
            configBtn.addEventListener('click', () => {
                window.location.href = 'settings.html';
            });
        }
    }

    // Nút Logout
    const logoutBtn = document.querySelector('.btn-danger');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('kpi_user');
            auth.signOut();
        });
    }
    // 1. Data cho dropdown Task theo Team
    const tasksByTeam = {
        'all': [],
        'Inbound': ['QC', 'Receive', 'Boxing', 'Putaway'],
        'Inventory': ['Cycle count', 'Transfer', 'Replenishment', 'TBS'],
        'Return Inbound': {
            'item': ['Check', 'Putaway'],
            'order': ['FD', 'Damage']
        }
    };

    const DOM = {
        warehouseFilter: document.getElementById('warehouse-filter'),
        teamFilter: document.getElementById('team-filter'),
        taskFilter: document.getElementById('task-filter'),
        emailFilter: document.getElementById('email-filter'),
        viewingBadges: {
            item: document.getElementById('view-item'),
            order: document.getElementById('view-order')
        },
        refreshBtn: document.querySelector('.btn-primary'),
        tableHead: document.querySelector('#kpi-table thead'),
        tableBody: document.querySelector('#kpi-table tbody'),
        totalOrdersBadge: document.querySelectorAll('.stat-value')[1],
        totalItemsBadge: document.querySelectorAll('.stat-value')[2],
        totalActiveUsersBadge: document.querySelectorAll('.stat-value')[0],
        avgPerHourBadge: document.querySelectorAll('.stat-value')[3],
        currentViewingBadge: document.getElementById('current-viewing-badge'),
        targetContainer: document.getElementById('target-badges-container'),
        datePicker: document.getElementById('date-picker'),
        searchInput: document.querySelector('.search-box input'),
        exportBtn: document.querySelector('.btn-outline-success')
    };

    // Target dictionary
    const TARGETS = {
        'VNDB': {
            'Inbound': {
                'Receive': [ { label: 'IB/MTI', value: 413 }, { label: 'Receive', value: 300 } ],
                'Putaway': [ { label: 'IB/MTI', value: 413 }, { label: 'Putaway', value: 1000 } ]
            },
            'Inventory': {
                'Cycle count': [ { label: 'Cycle count', value: 1000 } ],
                'Replenishment': [ { label: 'Replenishment', value: 450 } ]
            },
            'Return Inbound': {
                'item': [ { label: 'Check', value: 100 }, { label: 'Putaway', value: 30 } ],
                'order': [ { label: 'FD', value: 14.5 }, { label: 'Damage', value: 5 } ]
            }
        },
        'VNDL': {
            'Inbound': {
                'Receive': [ { label: 'IB/MTI', value: 252 }, { label: 'Receive', value: 300 } ],
                'Putaway': [ { label: 'IB/MTI', value: 252 }, { label: 'Putaway', value: 500 } ]
            },
            'Inventory': {
                'Cycle count': [ { label: 'Cycle count', value: 850 } ],
                'Replenishment': [ { label: 'Replenishment', value: 450 } ]
            },
            'Return Inbound': {
                'item': [ { label: 'Check', value: 100 }, { label: 'Putaway', value: 30 } ],
                'order': [ { label: 'FD', value: 12.1 }, { label: 'Damage', value: 5 } ]
            }
        }
    };

    let IS_LIVE = true;
    let GLOBAL_DATA = [];
    let CURRENT_SORT_METRIC = 'productivity';
    let CURRENT_SORT_ORDER = 'desc'; // 'desc' hoặc 'asc'
    let currentView = 'item'; // 'item' or 'order'

    // Set datepicker to today
    const today = new Date().toISOString().split('T')[0];
    DOM.datePicker.value = today;

    // Listeners
    DOM.teamFilter.addEventListener('change', () => {
        try {
            updateTaskOptions();
            updateTargetsUI();
            // Reset view options logic
            const selectedTeam = DOM.teamFilter.value;
            if (selectedTeam !== 'Return Inbound' && selectedTeam !== 'all') {
                setView('item');
                DOM.viewingBadges.order.style.opacity = '0.3';
                DOM.viewingBadges.order.style.pointerEvents = 'none';
            } else {
                DOM.viewingBadges.order.style.opacity = '1';
                DOM.viewingBadges.order.style.pointerEvents = 'auto';
            }
        } catch (e) {
            alert("LỖI CHI TIẾT ĐÂY RỒI: " + e.stack);
        }
    });

    // Update warehouse filter based on user access
    const whFilter = DOM.warehouseFilter;
    if (currentUser.warehouses && !currentUser.warehouses.includes("ALL")) {
        // Remove existing options
        whFilter.innerHTML = '';
        currentUser.warehouses.forEach(wh => {
            const opt = document.createElement('option');
            opt.value = wh;
            opt.textContent = wh;
            whFilter.appendChild(opt);
        });
    }

    DOM.warehouseFilter.addEventListener('change', updateTargetsUI);
    DOM.taskFilter.addEventListener('change', updateTargetsUI);
    DOM.datePicker.addEventListener('change', fetchData);
    DOM.refreshBtn.addEventListener('click', fetchData);
    DOM.viewingBadges.item.addEventListener('click', () => setView('item'));
    DOM.viewingBadges.order.addEventListener('click', () => setView('order'));
    DOM.emailFilter.addEventListener('change', renderTable);
    DOM.searchInput.addEventListener('input', renderTable);
    DOM.exportBtn.addEventListener('click', exportCSV);

    function exportCSV() {
        if (!GLOBAL_DATA || GLOBAL_DATA.length === 0) return alert('Không có dữ liệu để xuất!');
        
        const searchInput = DOM.searchInput.value.toLowerCase();
        const selectedEmail = DOM.emailFilter.value;
        const filteredData = GLOBAL_DATA.filter(row => {
            const matchesSearch = row.email.toLowerCase().includes(searchInput) || (row.name && row.name.toLowerCase().includes(searchInput));
            const matchesEmail = selectedEmail === 'all' || row.email === selectedEmail;
            return matchesSearch && matchesEmail;
        });

        const columns = window.DYNAMIC_HOURS || [];
        let csvContent = '\uFEFF'; // BOM for UTF-8 in Excel
        csvContent += '#,EMAIL,STAFF NAME,TOTAL,' + columns.join(',') + '\n';
        
        filteredData.forEach((row, idx) => {
            let rowCsv = `${idx + 1},${row.email},${row.name || ''},${row.total}`;
            columns.forEach(col => {
                rowCsv += `,${row.hourly[col] || 0}`;
            });
            csvContent += rowCsv + '\n';
        });
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `KPI_Report_${DOM.datePicker.value}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function updateTaskOptions() {
        const selectedTeam = DOM.teamFilter.value;
        let tasks = [];
        if (selectedTeam === 'Return Inbound') {
            tasks = tasksByTeam['Return Inbound'][currentView] || [];
        } else {
            tasks = tasksByTeam[selectedTeam] || [];
        }
        DOM.taskFilter.innerHTML = '<option value="all">Tất cả Task</option>';
        tasks.forEach(task => {
            const option = document.createElement('option');
            option.value = task;
            option.textContent = task;
            DOM.taskFilter.appendChild(option);
        });
    }

    function updateTargetsUI() {
        const wh = DOM.warehouseFilter.value;
        const team = DOM.teamFilter.value;
        const task = DOM.taskFilter.value;
        
        DOM.targetContainer.innerHTML = '';
        if (wh === 'all' || team === 'all') return;
        
        const teamTargets = TARGETS[wh]?.[team];
        if (!teamTargets) return;
        
        let targetList = [];
        if (team === 'Inbound') {
            if (task === 'Receive' || task === 'Putaway') {
                targetList = teamTargets[task];
            }
        } else if (team === 'Return Inbound') {
            targetList = teamTargets[currentView]; // 'item' or 'order'
        } else if (team === 'Inventory') {
            if (task === 'Cycle count' || task === 'Replenishment') {
                targetList = teamTargets[task];
            }
        }
        
        if (targetList && targetList.length > 0) {
            let html = '';
            targetList.forEach(t => {
                html += `<span class="target-badge">${t.label} <span>Target: ${t.value}</span></span> `;
            });
            DOM.targetContainer.innerHTML = html;
        }
    }

    window.setView = function(v) {
        currentView = v;
        DOM.viewingBadges.item.classList.remove('active');
        DOM.viewingBadges.order.classList.remove('active');
        DOM.viewingBadges[v].classList.add('active');
        
        if (v === 'item') {
            DOM.currentViewingBadge.textContent = "Viewing: Item";
        } else {
            DOM.currentViewingBadge.textContent = "Viewing: Order";
        }
        
        if (DOM.teamFilter.value === 'Return Inbound') {
            updateTaskOptions();
            fetchData();
        } else {
            updateTargetsUI();
            renderTable();
        }
    };

    async function fetchData() {
        const warehouse = DOM.warehouseFilter.value;
        const team = DOM.teamFilter.value;
        const task = DOM.taskFilter.value;
        const dateStr = DOM.datePicker.value;
        
        DOM.tableBody.innerHTML = '<tr><td colspan="15" style="text-align: center; padding: 40px;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><p style="margin-top:10px; color:var(--text-secondary)">Đang tải dữ liệu từ Cloud...</p></td></tr>';

        try {
            const dbRef = db.ref(`dashboard/${dateStr}/${warehouse}/${team}/${task}`);
            dbRef.once('value', (snapshot) => {
                const data = snapshot.val();
                if (data && data.data && data.data.length > 0) {
                    GLOBAL_DATA = data.data;
                    window.DYNAMIC_HOURS = data.columns || [];
                    
                    // Populate Email Filter
                    const uniqueEmails = [...new Set(GLOBAL_DATA.map(r => r.email))].sort();
                    DOM.emailFilter.innerHTML = '<option value="all">Tất cả Email</option>';
                    uniqueEmails.forEach(email => {
                        const opt = document.createElement('option');
                        opt.value = email;
                        opt.textContent = email;
                        DOM.emailFilter.appendChild(opt);
                    });
                    
                    renderTable();
                    
                    if (data.updated_at) {
                        DOM.currentViewingBadge.innerHTML = `Viewing: ${currentView.charAt(0).toUpperCase() + currentView.slice(1)} <span style="margin-left: 10px; opacity: 0.7; font-size: 11px;">Cập nhật cuối: ${data.updated_at}</span>`;
                    }
                } else {
                    DOM.tableBody.innerHTML = '<tr><td colspan="15" style="text-align:center; color: #ef4444; padding: 20px;">Không có dữ liệu cho Ngày/Kho/Team/Task này.</td></tr>';
                    GLOBAL_DATA = [];
                    window.DYNAMIC_HOURS = [];
                    updateStatsUI();
                }
            }, (error) => {
                DOM.tableBody.innerHTML = `<tr><td colspan="15" style="text-align:center; color: #ef4444; padding: 20px;">Lỗi đọc Firebase: ${error.message}</td></tr>`;
            });
        } catch (error) {
            console.error('Lỗi khi lấy dữ liệu từ Firebase:', error);
            DOM.tableBody.innerHTML = '<tr><td colspan="15" style="text-align:center; color: #ef4444; padding: 20px;">Không thể kết nối đến Cloud Database.</td></tr>';
        }
    }

    function renderTable() {
        DOM.tableHead.innerHTML = '';
        DOM.tableBody.innerHTML = '';

        if (!GLOBAL_DATA || GLOBAL_DATA.length === 0) {
            DOM.tableBody.innerHTML = '<tr><td colspan="15" style="text-align: center; padding: 40px;">Không có dữ liệu cho ngày này / Chưa có báo cáo.</td></tr>';
            DOM.totalActiveUsersBadge.textContent = "0";
            DOM.totalOrdersBadge.textContent = "0";
            DOM.totalItemsBadge.textContent = "0";
            DOM.avgPerHourBadge.textContent = "0";
            return;
        }

        const columns = window.DYNAMIC_HOURS || [];
        
        // Render Header
        let theadRow = document.createElement('tr');
        theadRow.innerHTML = `
            <th>#</th>
            <th>EMAIL</th>
            <th>STAFF NAME</th>
            <th class="col-total sort-header-cell" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                <select id="sort-metric" class="sort-select" style="background: transparent; color: var(--primary); border: none; font-weight: 600; font-size: 12px; text-transform: uppercase; cursor: pointer; outline: none; appearance: none; padding-right: 0;">
                    <option value="productivity" ${CURRENT_SORT_METRIC === 'productivity' ? 'selected' : ''}>Productivity</option>
                    <option value="items" ${CURRENT_SORT_METRIC === 'items' ? 'selected' : ''}>Total items</option>
                    <option value="manhour" ${CURRENT_SORT_METRIC === 'manhour' ? 'selected' : ''}>Total manhour</option>
                </select>
                <i class="fa-solid fa-arrow-${CURRENT_SORT_ORDER === 'desc' ? 'down' : 'up'} sort-icon" id="sort-order-icon" style="cursor: pointer; color: var(--primary);"></i>
            </th>
        `;
        columns.forEach(col => {
            const th = document.createElement('th');
            th.textContent = col;
            theadRow.appendChild(th);
        });
        DOM.tableHead.appendChild(theadRow);

        // Đăng ký event cho sort
        document.getElementById('sort-metric').addEventListener('change', (e) => {
            CURRENT_SORT_METRIC = e.target.value;
            renderTable(GLOBAL_DATA);
        });
        document.getElementById('sort-order-icon').addEventListener('click', () => {
            CURRENT_SORT_ORDER = CURRENT_SORT_ORDER === 'desc' ? 'asc' : 'desc';
            renderTable(GLOBAL_DATA);
        });

        const team = DOM.teamFilter.value;
        let totalOrders = 0;
        let totalItems = 0;
        let hoursCount = columns.length;

        // Filter Data
        const searchInput = DOM.searchInput.value.toLowerCase();
        const selectedEmail = DOM.emailFilter.value;
        let filteredData = GLOBAL_DATA.filter(row => {
            const matchesSearch = row.email.toLowerCase().includes(searchInput) || (row.name && row.name.toLowerCase().includes(searchInput));
            const matchesEmail = selectedEmail === 'all' || row.email === selectedEmail;
            return matchesSearch && matchesEmail;
        });

        // Tính các giá trị phụ trợ cho từng dòng để phục vụ sort
        filteredData.forEach(row => {
            const activeHours = columns.filter(col => row.hourly[col] && row.hourly[col] > 0).length || 1;
            const manhour = (row.manhour && row.manhour > 0) ? row.manhour : activeHours;

            row._productivity = manhour > 0 ? (row.total / manhour) : 0;
            row._items = row.total;
            row._manhour = manhour;
        });

        // Sắp xếp
        filteredData.sort((a, b) => {
            let valA = a['_' + CURRENT_SORT_METRIC];
            let valB = b['_' + CURRENT_SORT_METRIC];
            if (CURRENT_SORT_ORDER === 'desc') {
                return valB - valA;
            } else {
                return valA - valB;
            }
        });

        // Render Data Body
        filteredData.forEach((row, index) => {
            if (team === 'Return Inbound') {
                totalOrders += (row.order_total || 0); // Tương lai backend sẽ tách riêng order_total
                totalItems += (row.item_total || row.total || 0);
            } else {
                totalOrders += 0; // Inventory và Inbound chỉ tính items
                totalItems += row.total;
            }
            
            const tr = document.createElement('tr');
            
            const renderHour = (val) => {
                if (!val || val === 0) return `<span class="hour-zero">—</span>`;
                if (val < 100) return `<span class="hour-val hour-low">${val}</span>`;
                if (val < 300) return `<span class="hour-val hour-med">${val}</span>`;
                return `<span class="hour-val hour-high">${val}</span>`;
            };

            // Lấy giá trị metric hiện tại để hiển thị thay cho avgPerDay
            let displayValue = row['_' + CURRENT_SORT_METRIC];
            if (CURRENT_SORT_METRIC === 'productivity' || CURRENT_SORT_METRIC === 'manhour') {
                displayValue = Number(displayValue).toFixed(2);
            }

            let rowHtml = `
                <td>${index + 1}</td>
                <td class="email-col">${row.email}</td>
                <td class="name-col">${row.name || ''}</td>
                <td><span class="total-badge">${displayValue}</span></td>
            `;

            columns.forEach(col => {
                const hourValue = row.hourly[col] || 0;
                rowHtml += `<td>${renderHour(hourValue)}</td>`;
            });

            tr.innerHTML = rowHtml;
            DOM.tableBody.appendChild(tr);
        });

        // Update Thống kê
        DOM.totalActiveUsersBadge.textContent = filteredData.length;
        DOM.totalOrdersBadge.textContent = Math.round(totalOrders);
        DOM.totalItemsBadge.textContent = Math.round(totalItems);
        
        if (filteredData.length > 0 && hoursCount > 0) {
            let displayTotal = currentView === 'order' ? totalOrders : totalItems;
            DOM.avgPerHourBadge.textContent = Math.round(displayTotal / filteredData.length / hoursCount);
        } else {
            DOM.avgPerHourBadge.textContent = "0";
        }
    }

    window.renderTable = renderTable;
    
    // Tự động fetch data khi load trang xong
    fetchData();
} // end initApp()
