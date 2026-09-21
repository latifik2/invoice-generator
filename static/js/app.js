document.addEventListener('DOMContentLoaded', () => {
    
    // Set default date
    const dateInput = document.getElementById('document_date');
    if (dateInput && !dateInput.value) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
    }

    // Default sample item rows
    const sampleItems = [
        { name: 'Разработка веб-приложения генератора документов', unit: 'услуга', quantity: 1, price: 85000 },
        { name: 'Настройка шаблонов MS Word, MS Excel и PDF', unit: 'усл.', quantity: 1, price: 25000 }
    ];

    const tbody = document.getElementById('items-tbody');
    const btnAddItem = document.getElementById('btn-add-item');
    const taxSelect = document.getElementById('tax_rate');

    // Populate initial items
    sampleItems.forEach(item => addItemRow(item));
    recalculateTotals();

    // Event Listeners
    btnAddItem.addEventListener('click', () => addItemRow());
    taxSelect.addEventListener('change', recalculateTotals);

    document.getElementById('btn-demo').addEventListener('click', loadDemoData);
    document.getElementById('btn-clear').addEventListener('click', clearForm);

    document.getElementById('btn-export-docx').addEventListener('click', () => generateDocument('docx'));
    document.getElementById('btn-export-acceptance').addEventListener('click', () => generateDocument('acceptance'));
    document.getElementById('btn-export-pdf').addEventListener('click', () => generateDocument('pdf'));

    // Functions
    function addItemRow(data = { name: '', unit: 'шт.', quantity: 1, price: 0 }) {
        const rowCount = tbody.children.length + 1;
        const tr = document.createElement('tr');
        tr.className = 'item-row';
        
        tr.innerHTML = `
            <td class="row-index text-center" style="color: var(--text-dim); font-weight: 500;">${rowCount}</td>
            <td>
                <input type="text" class="item-name" placeholder="Название товара или услуги" value="${data.name}" required>
            </td>
            <td>
                <input type="text" class="item-unit text-center" value="${data.unit}">
            </td>
            <td>
                <input type="number" class="item-qty text-center" min="0.01" step="any" value="${data.quantity}" required>
            </td>
            <td>
                <input type="number" class="item-price text-right" min="0" step="any" value="${data.price}" required>
            </td>
            <td>
                <input type="text" class="item-total text-right" value="0.00" readonly style="background: rgba(255,255,255,0.03); color: var(--text-main); font-weight: 600;">
            </td>
            <td class="text-center">
                <button type="button" class="btn btn-danger btn-remove-row" title="Удалить позицию">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        `;

        // Add event listeners to input fields for auto calculation
        const qtyInput = tr.querySelector('.item-qty');
        const priceInput = tr.querySelector('.item-price');
        const removeBtn = tr.querySelector('.btn-remove-row');

        qtyInput.addEventListener('input', () => {
            updateRowTotal(tr);
            recalculateTotals();
        });

        priceInput.addEventListener('input', () => {
            updateRowTotal(tr);
            recalculateTotals();
        });

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
        Array.from(tbody.children).forEach((tr, index) => {
            tr.querySelector('.row-index').textContent = index + 1;
        });
    }

    function recalculateTotals() {
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

    function getFormData() {
        const items = [];
        const rows = tbody.querySelectorAll('.item-row');
        
        rows.forEach(tr => {
            const name = tr.querySelector('.item-name').value.trim();
            const unit = tr.querySelector('.item-unit').value.trim() || 'шт.';
            const quantity = parseFloat(tr.querySelector('.item-qty').value) || 0;
            const price = parseFloat(tr.querySelector('.item-price').value) || 0;
            
            if (name) {
                items.push({ name, unit, quantity, price });
            }
        });

        return {
            document_number: document.getElementById('document_number').value.trim() || 'СЧ-0001',
            document_date: document.getElementById('document_date').value || new Date().toISOString().split('T')[0],
            tax_rate: parseFloat(document.getElementById('tax_rate').value) || 0,
            company: {
                name: document.getElementById('company_name').value.trim(),
                inn: document.getElementById('company_inn').value.trim(),
                kpp: document.getElementById('company_kpp').value.trim(),
                ogrn: document.getElementById('company_ogrn').value.trim(),
                address: document.getElementById('company_address').value.trim(),
                phone: document.getElementById('company_phone').value.trim(),
                email: document.getElementById('company_email').value.trim(),
                bank_name: document.getElementById('company_bank_name').value.trim(),
                bik: document.getElementById('company_bik').value.trim(),
                account: document.getElementById('company_account').value.trim(),
                ceo_name: document.getElementById('company_ceo_name').value.trim()
            },
            client: {
                name: document.getElementById('client_name').value.trim(),
                inn: document.getElementById('client_inn').value.trim(),
                kpp: document.getElementById('client_kpp').value.trim(),
                ogrn: document.getElementById('client_ogrn').value.trim(),
                address: document.getElementById('client_address').value.trim(),
                phone: document.getElementById('client_phone').value.trim(),
                email: document.getElementById('client_email').value.trim(),
                bank_name: document.getElementById('client_bank_name').value.trim(),
                bik: document.getElementById('client_bik').value.trim(),
                account: document.getElementById('client_account').value.trim(),
                corr_account: document.getElementById('client_corr_account').value.trim(),
                contact_person: document.getElementById('client_contact_person').value.trim()
            },
            items: items,
            notes: document.getElementById('notes').value.trim()
        };
    }

    async function generateDocument(format) {
        const payload = getFormData();
        
        if (payload.items.length === 0) {
            showToast('Пожалуйста, добавьте хотя бы один товар или услугу', 'error');
            return;
        }

        const formatNames = { docx: 'Счет (.docx)', acceptance: 'Акт (.docx)', pdf: 'PDF (.pdf)' };
        showToast(`Формирование документа ${formatNames[format]}...`, 'info');

        try {
            const response = await fetch(`/api/generate/${format}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Ошибка при генерации документа');
            }

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            
            const cleanDocNum = payload.document_number.replace(/[^a-zA-Z0-9а-яА-Я_-]/g, '_');
            const prefix = format === 'acceptance' ? 'Акт' : 'Счет';
            const ext = format === 'pdf' ? 'pdf' : 'docx';
            a.download = `${prefix}_${cleanDocNum}_${payload.document_date}.${ext}`;
            
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);

            showToast(`Файл ${formatNames[format]} успешно сгенерирован и скачан!`, 'success');
        } catch (err) {
            console.error(err);
            showToast(`Ошибка: ${err.message}`, 'error');
        }
    }

    function loadDemoData() {
        document.getElementById('document_number').value = 'СЧ-' + Math.floor(1000 + Math.random() * 9000);
        document.getElementById('document_date').value = new Date().toISOString().split('T')[0];
        document.getElementById('tax_rate').value = '20';

        document.getElementById('company_name').value = 'ООO «Инновационные Спецсистемы»';
        document.getElementById('company_inn').value = '7704123456';
        document.getElementById('company_kpp').value = '770401001';
        document.getElementById('company_ogrn').value = '1117746123456';
        document.getElementById('company_address').value = 'г. Москва, Лужнецкая наб., д. 2/4, стр. 3';
        document.getElementById('company_phone').value = '+7 (495) 777-88-99';
        document.getElementById('company_email').value = 'sales@innospec.ru';
        document.getElementById('company_bank_name').value = 'ПАО Сбербанк г. Москва';
        document.getElementById('company_bik').value = '044525225';
        document.getElementById('company_account').value = '40702810438000012345';
        document.getElementById('company_ceo_name').value = 'Сергеев С.С.';

        document.getElementById('client_name').value = 'ООО «ТехноЛогистика»';
        document.getElementById('client_inn').value = '7810987654';
        document.getElementById('client_kpp').value = '781001001';
        document.getElementById('client_ogrn').value = '1157847987654';
        document.getElementById('client_address').value = 'г. Санкт-Петербург, Московский пр., д. 102';
        document.getElementById('client_phone').value = '+7 (812) 444-55-66';
        document.getElementById('client_email').value = 'info@technologistics.ru';
        document.getElementById('client_bank_name').value = 'ПАО ВТБ';
        document.getElementById('client_bik').value = '044030704';
        document.getElementById('client_account').value = '40702810000000009876';
        document.getElementById('client_corr_account').value = '30101810200000000704';
        document.getElementById('client_contact_person').value = 'Алексеева А.В.';

        tbody.innerHTML = '';
        addItemRow({ name: 'Поставка серверного оборудования и лицензий', unit: 'компл.', quantity: 2, price: 145000 });
        addItemRow({ name: 'Работы по интеграции и пуско-наладке', unit: 'час', quantity: 24, price: 3500 });
        addItemRow({ name: 'Техническая поддержка (12 месяцев)', unit: 'усл.', quantity: 1, price: 48000 });

        showToast('Форма заполнена демо-данными!', 'success');
    }

    function clearForm() {
        document.getElementById('invoice-form').reset();
        document.getElementById('document_date').value = new Date().toISOString().split('T')[0];
        tbody.innerHTML = '';
        addItemRow();
        recalculateTotals();
        showToast('Форма очищена', 'info');
    }

    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icon = type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info');
        toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
        
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }
});
