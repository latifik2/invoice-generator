let currentCompany = null;
let clientsList = [];
let currentClient = null;
let currentDocumentId = null; // null means we are creating a new one

document.addEventListener('DOMContentLoaded', () => {
    
    // Theme logic
    initTheme();

    // Init data
    loadCompany();
    loadClients();

    // Event Listeners
    document.getElementById('btn-add-item').addEventListener('click', () => addItemRow());
    document.getElementById('tax_rate').addEventListener('change', recalculateTotals);

    document.getElementById('btn-clear').addEventListener('click', clearForm);

    // Save and Copy buttons
    document.getElementById('btn-save-new').addEventListener('click', () => saveDocument(true));
    document.getElementById('btn-update-doc').addEventListener('click', () => saveDocument(false));
    document.getElementById('btn-copy-doc').addEventListener('click', copyOrder);
    
    document.getElementById('btn-enable-edit').addEventListener('click', () => {
        document.getElementById('document-fieldset').disabled = false;
        document.getElementById('btn-enable-edit').style.display = 'none';
        document.getElementById('btn-update-doc').style.display = 'inline-flex';
    });

    // Export buttons
    document.getElementById('btn-export-docx').addEventListener('click', () => generateDocument('docx'));
    document.getElementById('btn-export-acceptance').addEventListener('click', () => generateDocument('acceptance'));
    document.getElementById('btn-export-pdf').addEventListener('click', () => generateDocument('pdf'));

    // Theme listener
    const btnTheme = document.getElementById('btn-theme-toggle');
    if (btnTheme) btnTheme.addEventListener('click', toggleTheme);

    // Modal listeners
    document.getElementById('btn-edit-company').addEventListener('click', openCompanyModal);
    document.getElementById('btn-create-client').addEventListener('click', openClientModalForCreate);
    document.getElementById('btn-edit-client').addEventListener('click', openClientModalForEdit);
    document.getElementById('btn-delete-client').addEventListener('click', confirmDeleteClient);
    document.getElementById('btn-confirm-delete').addEventListener('click', executeDeleteClient);

    document.getElementById('client_select').addEventListener('change', (e) => {
        const id = e.target.value;
        if (id) {
            const client = clientsList.find(c => c.id == id);
            renderClientReadOnly(client);
        } else {
            renderClientReadOnly(null);
        }
    });

    // Form logic bindings are now global

    // Initialize default view after all functions are defined
    showView('form');
});

// ==================== FORM LOGIC ====================
window.addItemRow = function(data = { name: '', unit: 'шт.', quantity: 1, price: 0 }) {
    const tbody = document.getElementById('items-tbody');
    const rowCount = tbody.children.length + 1;
    const tr = document.createElement('tr');
    tr.className = 'item-row';
    
    tr.innerHTML = `
        <td class="row-index text-center" style="color: var(--text-dim); font-weight: 500;">${rowCount}</td>
        <td><input type="text" class="item-name" placeholder="Название товара или услуги" value="${data.name}" required></td>
        <td><input type="text" class="item-unit text-center" value="${data.unit}"></td>
        <td><input type="number" class="item-qty text-center" min="0.01" step="any" value="${data.quantity}" required></td>
        <td><input type="number" class="item-price text-right" min="0" step="any" value="${data.price}" required></td>
        <td><input type="text" class="item-total text-right" value="0.00" readonly style="background: rgba(128,128,128,0.05); color: var(--text-main); font-weight: 600;"></td>
        <td class="text-center">
            <button type="button" class="btn btn-danger btn-remove-row" title="Удалить позицию"><i class="fa-solid fa-trash-can"></i></button>
        </td>
    `;

    const qtyInput = tr.querySelector('.item-qty');
    const priceInput = tr.querySelector('.item-price');
    const removeBtn = tr.querySelector('.btn-remove-row');

    qtyInput.addEventListener('input', () => { updateRowTotal(tr); recalculateTotals(); });
    priceInput.addEventListener('input', () => { updateRowTotal(tr); recalculateTotals(); });

    removeBtn.addEventListener('click', () => {
        if (tbody.children.length > 1) {
            tr.remove();
            updateRowIndices();
            recalculateTotals();
        } else {
            showToast('Документ должен содержать хотя бы одну позицию', 'error');
        }
    });

    tbody.appendChild(tr);
    updateRowTotal(tr);
    recalculateTotals();
}

function updateRowTotal(tr) {
    const qty = parseFloat(tr.querySelector('.item-qty').value) || 0;
    const price = parseFloat(tr.querySelector('.item-price').value) || 0;
    const total = qty * price;
    tr.querySelector('.item-total').value = total.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function updateRowIndices() {
    const tbody = document.getElementById('items-tbody');
    Array.from(tbody.children).forEach((tr, index) => {
        tr.querySelector('.row-index').textContent = index + 1;
    });
}

window.recalculateTotals = function() {
    const tbody = document.getElementById('items-tbody');
    const taxSelect = document.getElementById('tax_rate');
    let subtotal = 0;
    const rows = tbody.querySelectorAll('.item-row');
    rows.forEach(tr => {
        const qty = parseFloat(tr.querySelector('.item-qty').value) || 0;
        const price = parseFloat(tr.querySelector('.item-price').value) || 0;
        subtotal += (qty * price);
    });

    const taxRate = parseFloat(taxSelect.value) || 0;
    const vatAmount = subtotal * (taxRate / 100.0);
    const totalAmount = subtotal + vatAmount;

    document.getElementById('summary-subtotal').textContent = `${subtotal.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} руб.`;
    document.getElementById('summary-vat-rate').textContent = taxRate;
    document.getElementById('summary-vat').textContent = `${vatAmount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} руб.`;
    document.getElementById('summary-total').textContent = `${totalAmount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} руб.`;
}

function clearForm() {
    currentDocumentId = null;
    document.getElementById('invoice-form').reset();
    document.getElementById('client_select').value = '';
    renderClientReadOnly(null);
    loadNextDocumentNumber();
    const tbody = document.getElementById('items-tbody');
    tbody.innerHTML = '';
    addItemRow();
    recalculateTotals();
    
    document.getElementById('document-fieldset').disabled = false;
    updateActionBarState();
    showToast('Форма очищена', 'info');
}

// ==================== ROUTING & SPA VIEWS ====================
window.createNewOrder = function() {
    clearForm();
    showView('form');
}

window.showView = function(viewName) {
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    document.getElementById('view-document-form').style.display = 'none';
    document.getElementById('view-orders-list').style.display = 'none';
    
    if (viewName === 'form') {
        document.getElementById('view-document-form').style.display = 'block';
        if (currentDocumentId === null) {
            // New document mode
            if (!document.getElementById('document_number').value || document.getElementById('items-tbody').children.length === 0) {
                loadNextDocumentNumber();
                document.getElementById('items-tbody').innerHTML = '';
                addItemRow({ name: 'Разработка веб-приложения', unit: 'услуга', quantity: 1, price: 85000 });
                recalculateTotals();
            }
        }
        updateActionBarState();
    } else if (viewName === 'orders') {
        document.getElementById('view-orders-list').style.display = 'block';
        updateActionBarState();
        loadOrders();
    }
}

function updateActionBarState() {
    const menuOrder = document.getElementById('menu-view-order');
    const menuOrdersList = document.getElementById('menu-orders');
    
    if (currentDocumentId) {
        document.getElementById('action-bar-create').style.display = 'none';
        document.getElementById('action-bar-edit').style.display = 'flex';
        
        menuOrder.style.display = 'flex';
        menuOrder.querySelector('span').textContent = `Заказ #${currentDocumentId}`;
        
        // Ensure visual active state
        document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
        if (document.getElementById('view-document-form').style.display !== 'none') {
            menuOrder.classList.add('active');
        } else {
            menuOrdersList.classList.add('active');
        }
    } else {
        document.getElementById('action-bar-create').style.display = 'flex';
        document.getElementById('action-bar-edit').style.display = 'none';
        
        menuOrder.style.display = 'flex';
        menuOrder.querySelector('span').textContent = `Новый заказ`;
        
        // Ensure visual active state
        document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
        if (document.getElementById('view-document-form').style.display !== 'none') {
            menuOrder.classList.add('active');
        } else {
            menuOrdersList.classList.add('active');
        }
    }
}

// ==================== DOCUMENTS & ORDERS LOGIC ====================
async function loadOrders() {
    try {
        const res = await fetch('/api/documents');
        if (res.ok) {
            const data = await res.json();
            const tbody = document.getElementById('orders-tbody');
            tbody.innerHTML = '';
            
            if (data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding: 30px; color: var(--text-dim);">Нет созданных заказов</td></tr>`;
                return;
            }

            data.forEach(order => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="color: var(--text-dim);">#${order.id}</td>
                    <td style="font-weight: 500;">${order.document_number}</td>
                    <td>${order.document_date}</td>
                    <td>${order.client_name}</td>
                    <td>
                        <button type="button" class="btn btn-sm btn-outline" onclick="editOrder(${order.id})">Открыть</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (e) {
        console.error('Ошибка загрузки списка заказов', e);
        showToast('Не удалось загрузить заказы', 'error');
    }
}

window.editOrder = async function(id) {
    try {
        const res = await fetch(`/api/documents/${id}`);
        if (res.ok) {
            const doc = await res.json();
            
            currentDocumentId = doc.id;
            document.getElementById('document_number').value = doc.document_number;
            document.getElementById('document_date').value = doc.document_date;
            document.getElementById('tax_rate').value = doc.tax_rate;
            document.getElementById('notes').value = doc.notes;
            
            // Set client
            document.getElementById('client_select').value = doc.client_id;
            const client = clientsList.find(c => c.id == doc.client_id);
            renderClientReadOnly(client);

            // Set items
            const tbody = document.getElementById('items-tbody');
            tbody.innerHTML = '';
            doc.items.forEach(item => {
                addItemRow(item);
            });
            recalculateTotals();

            // Set RO mode
            document.getElementById('document-fieldset').disabled = true;
            document.getElementById('btn-enable-edit').style.display = 'inline-flex';
            document.getElementById('btn-update-doc').style.display = 'none';

            // Show Form View
            showView('form');
        } else {
            showToast('Не удалось загрузить заказ', 'error');
        }
    } catch (e) {
        showToast('Ошибка сети', 'error');
    }
}

window.copyOrder = function() {
    currentDocumentId = null;
    loadNextDocumentNumber();
    document.getElementById('document-fieldset').disabled = false;
    updateActionBarState();
    showToast('Заказ скопирован как новый. Сохраните его!', 'info');
}

window.saveDocument = async function(isNew) {
    if (!currentCompany || !currentCompany.id) { showToast('Заполните данные вашей компании', 'error'); return; }
    if (!currentClient || !currentClient.id) { showToast('Выберите заказчика', 'error'); return; }

    const items = [];
    const rows = document.querySelectorAll('.item-row');
    rows.forEach(tr => {
        const name = tr.querySelector('.item-name').value.trim();
        const unit = tr.querySelector('.item-unit').value.trim() || 'шт.';
        const quantity = parseFloat(tr.querySelector('.item-qty').value) || 0;
        const price = parseFloat(tr.querySelector('.item-price').value) || 0;
        if (name) items.push({ name, unit, quantity, price });
    });

    if (items.length === 0) {
        showToast('Добавьте хотя бы одну позицию', 'error');
        return;
    }

    const payload = {
        document_number: document.getElementById('document_number').value.trim() || 'СЧ-0001',
        document_date: document.getElementById('document_date').value || new Date().toISOString().split('T')[0],
        tax_rate: parseFloat(document.getElementById('tax_rate').value) || 0,
        notes: document.getElementById('notes').value.trim(),
        company_id: currentCompany.id,
        client_id: currentClient.id,
        items: items
    };

    const method = isNew || currentDocumentId === null ? 'POST' : 'PUT';
    const url = isNew || currentDocumentId === null ? '/api/documents' : `/api/documents/${currentDocumentId}`;

    try {
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            const data = await res.json();
            currentDocumentId = data.id;
            updateActionBarState();
            showToast(data.message || 'Заказ успешно сохранен', 'success');
        } else {
            const err = await res.json();
            showToast(err.detail || 'Ошибка при сохранении', 'error');
        }
    } catch (e) {
        showToast('Ошибка сети', 'error');
    }
}

// ==================== DOCUMENT GENERATION ====================
window.generateDocument = async function(format) {
    if (!currentDocumentId) {
        showToast('Сначала сохраните заказ', 'error');
        return;
    }

    const formatNames = { docx: 'Счет (.docx)', acceptance: 'Акт (.docx)', pdf: 'PDF (.pdf)' };
    showToast(`Формирование документа ${formatNames[format]}...`, 'info');

    try {
        // GET request with currentDocumentId
        const response = await fetch(`/api/generate/${format}/${currentDocumentId}`);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Ошибка при генерации документа');
        }

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        
        // Extract filename from Content-Disposition if possible
        let filename = `${formatNames[format]}_${currentDocumentId}.${format === 'pdf' ? 'pdf' : 'docx'}`;
        const disposition = response.headers.get('Content-Disposition');
        if (disposition && disposition.includes('filename*=UTF-8\'\'')) {
            filename = decodeURIComponent(disposition.split('filename*=UTF-8\'\'')[1]);
        }
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);

        showToast(`Файл ${formatNames[format]} успешно скачан!`, 'success');
    } catch (err) {
        console.error(err);
        showToast(`Ошибка: ${err.message}`, 'error');
    }
}

// ==================== THEME ====================
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
        // Default light, no attr needed.
    }
}

function toggleTheme() {
    const root = document.documentElement;
    const isDark = root.getAttribute('data-theme') === 'dark';
    if (isDark) {
        root.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
    } else {
        root.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    }
}

// ==================== MODALS ====================
window.openModal = function(id) {
    document.getElementById(id).classList.add('active');
}

window.closeModal = function(id) {
    document.getElementById(id).classList.remove('active');
}

// ==================== COMPANY ====================
async function loadCompany() {
    try {
        const res = await fetch('/api/company');
        if (res.ok) {
            const data = await res.json();
            if (data && data.name) {
                currentCompany = data;
                renderCompanyReadOnly();
            } else {
                currentCompany = null;
                document.getElementById('company-display').innerHTML = `
                    <div class="empty-state">
                        <i class="fa-solid fa-building-circle-exclamation"></i>
                        <p>Данные вашей компании не заполнены</p>
                        <button type="button" class="btn btn-primary btn-sm mt-2" onclick="openCompanyModal()">Заполнить</button>
                    </div>`;
            }
        }
    } catch (e) {
        console.error('Error loading company:', e);
    }
}

function renderCompanyReadOnly() {
    if (!currentCompany) return;
    const c = currentCompany;
    const html = `
        <div class="ro-row"><div class="ro-label">Название / ИП</div><div class="ro-value">${c.name || '-'}</div></div>
        <div class="ro-row"><div class="ro-label">ИНН / КПП</div><div class="ro-value">${c.inn || '-'} / ${c.kpp || '-'}</div></div>
        <div class="ro-row"><div class="ro-label">Адрес</div><div class="ro-value">${c.address || '-'}</div></div>
        <div class="ro-row"><div class="ro-label">Банк</div><div class="ro-value">${c.bank_name || '-'} (БИК: ${c.bik || '-'})</div></div>
        <div class="ro-row"><div class="ro-label">Р/с</div><div class="ro-value">${c.account || '-'}</div></div>
    `;
    document.getElementById('company-display').innerHTML = html;
}

window.openCompanyModal = function() {
    if (currentCompany) {
        document.getElementById('modal_company_name').value = currentCompany.name || '';
        document.getElementById('modal_company_inn').value = currentCompany.inn || '';
        document.getElementById('modal_company_kpp').value = currentCompany.kpp || '';
        document.getElementById('modal_company_ogrn').value = currentCompany.ogrn || '';
        document.getElementById('modal_company_address').value = currentCompany.address || '';
        document.getElementById('modal_company_phone').value = currentCompany.phone || '';
        document.getElementById('modal_company_email').value = currentCompany.email || '';
        document.getElementById('modal_company_bank_name').value = currentCompany.bank_name || '';
        document.getElementById('modal_company_bik').value = currentCompany.bik || '';
        document.getElementById('modal_company_account').value = currentCompany.account || '';
        document.getElementById('modal_company_corr_account').value = currentCompany.corr_account || '';
        document.getElementById('modal_company_ceo_name').value = currentCompany.ceo_name || '';
    }
    openModal('modal-company');
}

window.saveCompany = async function() {
    // Let HTML5 Form Validation catch errors first, this is just for manual calls
    const form = document.getElementById('form-company');
    if(!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const payload = {
        name: document.getElementById('modal_company_name').value,
        inn: document.getElementById('modal_company_inn').value,
        kpp: document.getElementById('modal_company_kpp').value,
        ogrn: document.getElementById('modal_company_ogrn').value,
        address: document.getElementById('modal_company_address').value,
        phone: document.getElementById('modal_company_phone').value,
        email: document.getElementById('modal_company_email').value,
        bank_name: document.getElementById('modal_company_bank_name').value,
        bik: document.getElementById('modal_company_bik').value,
        account: document.getElementById('modal_company_account').value,
        corr_account: document.getElementById('modal_company_corr_account').value,
        ceo_name: document.getElementById('modal_company_ceo_name').value
    };

    try {
        const res = await fetch('/api/company', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            currentCompany = await res.json();
            renderCompanyReadOnly();
            closeModal('modal-company');
            showToast('Данные компании сохранены', 'success');
        } else {
            showToast('Ошибка сохранения', 'error');
        }
    } catch (e) {
        showToast('Ошибка сети', 'error');
    }
}

// ==================== CLIENTS ====================
async function loadClients() {
    try {
        const res = await fetch('/api/clients');
        if (res.ok) {
            clientsList = await res.json();
            renderClientsDropdown();
        }
    } catch (e) {
        console.error('Error loading clients:', e);
    }
}

function renderClientsDropdown(selectedId = null) {
    const select = document.getElementById('client_select');
    select.innerHTML = '<option value="">-- Выберите заказчика --</option>';
    clientsList.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.name} (ИНН: ${c.inn})`;
        select.appendChild(opt);
    });
    
    if (selectedId) {
        select.value = selectedId;
        const client = clientsList.find(c => c.id == selectedId);
        renderClientReadOnly(client);
    } else if (currentClient) {
        select.value = currentClient.id;
    }
}

window.renderClientReadOnly = function(client) {
    const display = document.getElementById('client-display');
    const btnEdit = document.getElementById('btn-edit-client');
    const btnDel = document.getElementById('btn-delete-client');
    
    if (!client) {
        currentClient = null;
        display.style.display = 'none';
        btnEdit.style.display = 'none';
        btnDel.style.display = 'none';
        return;
    }
    
    currentClient = client;
    display.style.display = 'block';
    btnEdit.style.display = 'block';
    btnDel.style.display = 'block';
    
    display.innerHTML = `
        <div class="ro-row"><div class="ro-label">Заказчик</div><div class="ro-value">${client.name || '-'}</div></div>
        <div class="ro-row"><div class="ro-label">ИНН / КПП</div><div class="ro-value">${client.inn || '-'} / ${client.kpp || '-'}</div></div>
        <div class="ro-row"><div class="ro-label">Адрес</div><div class="ro-value">${client.address || '-'}</div></div>
        <div class="ro-row"><div class="ro-label">Р/с</div><div class="ro-value">${client.account || '-'}</div></div>
    `;
}

window.openClientModalForCreate = function() {
    document.getElementById('form-client').reset();
    document.getElementById('modal_client_id').value = '';
    document.getElementById('modal-client-title').textContent = 'Новый заказчик';
    openModal('modal-client');
}

window.openClientModalForEdit = function() {
    if (!currentClient) return;
    document.getElementById('modal-client-title').textContent = 'Редактировать заказчика';
    document.getElementById('modal_client_id').value = currentClient.id;
    
    document.getElementById('modal_client_name').value = currentClient.name || '';
    document.getElementById('modal_client_inn').value = currentClient.inn || '';
    document.getElementById('modal_client_kpp').value = currentClient.kpp || '';
    document.getElementById('modal_client_ogrn').value = currentClient.ogrn || '';
    document.getElementById('modal_client_address').value = currentClient.address || '';
    document.getElementById('modal_client_phone').value = currentClient.phone || '';
    document.getElementById('modal_client_email').value = currentClient.email || '';
    document.getElementById('modal_client_bank_name').value = currentClient.bank_name || '';
    document.getElementById('modal_client_bik').value = currentClient.bik || '';
    document.getElementById('modal_client_account').value = currentClient.account || '';
    document.getElementById('modal_client_corr_account').value = currentClient.corr_account || '';
    document.getElementById('modal_client_contact_person').value = currentClient.contact_person || '';
    
    openModal('modal-client');
}

window.saveClient = async function() {
    const form = document.getElementById('form-client');
    if(!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const id = document.getElementById('modal_client_id').value;
    const payload = {
        name: document.getElementById('modal_client_name').value,
        inn: document.getElementById('modal_client_inn').value,
        kpp: document.getElementById('modal_client_kpp').value,
        ogrn: document.getElementById('modal_client_ogrn').value,
        address: document.getElementById('modal_client_address').value,
        phone: document.getElementById('modal_client_phone').value,
        email: document.getElementById('modal_client_email').value,
        bank_name: document.getElementById('modal_client_bank_name').value,
        bik: document.getElementById('modal_client_bik').value,
        account: document.getElementById('modal_client_account').value,
        corr_account: document.getElementById('modal_client_corr_account').value,
        contact_person: document.getElementById('modal_client_contact_person').value
    };

    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/clients/${id}` : '/api/clients';

    try {
        const res = await fetch(url, {
            method: method,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            const savedClient = await res.json();
            if (id) {
                const idx = clientsList.findIndex(c => c.id == id);
                if(idx > -1) clientsList[idx] = savedClient;
            } else {
                clientsList.push(savedClient);
            }
            renderClientsDropdown(savedClient.id);
            closeModal('modal-client');
            showToast(id ? 'Заказчик обновлен' : 'Заказчик создан', 'success');
        } else {
            const err = await res.json();
            showToast(err.detail || 'Ошибка сохранения', 'error');
        }
    } catch (e) {
        showToast('Ошибка сети', 'error');
    }
}

window.confirmDeleteClient = function() {
    if (!currentClient) return;
    openModal('modal-confirm');
}

window.executeDeleteClient = async function() {
    if (!currentClient) return;
    
    try {
        const res = await fetch(`/api/clients/${currentClient.id}`, { method: 'DELETE' });
        if (res.ok) {
            clientsList = clientsList.filter(c => c.id !== currentClient.id);
            renderClientsDropdown('');
            closeModal('modal-confirm');
            showToast('Контрагент удален', 'info');
        } else {
            showToast('Ошибка при удалении', 'error');
        }
    } catch (e) {
        showToast('Ошибка сети', 'error');
    }
}

// ==================== AUTO NUMBERING ====================
async function loadNextDocumentNumber() {
    try {
        const res = await fetch('/api/documents/next_number');
        if (res.ok) {
            const data = await res.json();
            document.getElementById('document_number').value = data.next_number;
            document.getElementById('document_date').value = new Date().toISOString().split('T')[0];
        }
    } catch (e) {
        console.error('Error fetching next number:', e);
    }
}

// ==================== TOAST ====================
window.showToast = function(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info');
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
