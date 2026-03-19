// script.js – fully modular, localstorage, chart, toasts, dark mode
(function() {
  // ==================== STATE & REFERENCES ====================
  let transactions = [];
  let chartInstance = null;
  let deleteId = null;          // id scheduled for deletion

  // DOM elements
  const tbody = document.getElementById('transactionBody');
  const totalBalanceSpan = document.getElementById('totalBalance');
  const totalIncomeSpan = document.getElementById('totalIncome');
  const totalExpenseSpan = document.getElementById('totalExpense');
  const monthlyEarningSpan = document.getElementById('monthlyEarning');
  const monthlySpendingSpan = document.getElementById('monthlySpending');
  
  const searchInput = document.getElementById('searchInput');
  const categoryFilter = document.getElementById('categoryFilter');
  const openAddBtn = document.getElementById('openAddModal');
  const modalOverlay = document.getElementById('modalOverlay');
  const transactionModal = document.getElementById('transactionModal');
  const closeModalBtn = document.getElementById('closeModal');
  const modalTitle = document.getElementById('modalTitle');
  const transactionForm = document.getElementById('transactionForm');
  const editId = document.getElementById('editId');
  const titleInput = document.getElementById('titleInput');
  const amountInput = document.getElementById('amountInput');
  const categorySelect = document.getElementById('categorySelect');
  const typeSelect = document.getElementById('typeSelect');
  const dateInput = document.getElementById('dateInput');
  // delete modal
  const deleteModal = document.getElementById('deleteModal');
  const cancelDelete = document.getElementById('cancelDelete');
  const confirmDelete = document.getElementById('confirmDelete');
  // theme
  const themeToggle = document.getElementById('themeToggle');
  const clearAllBtn = document.getElementById('clearAllBtn');
  // toast container
  const toastContainer = document.getElementById('toastContainer');

  // ==================== LOCALSTORAGE ====================
  function loadFromStorage() {
    const stored = localStorage.getItem('expense_tracker');
    if (stored) {
      try { transactions = JSON.parse(stored); } catch { transactions = []; }
    } else {
      // seed demo data (optional but safe)
      transactions = [
        { id: '1', title: 'salary', amount: 3200, category: 'Other', date: '2025-04-01', type: 'income' },
        { id: '2', title: 'groceries', amount: 86.50, category: 'Food', date: '2025-04-03', type: 'expense' },
        { id: '3', title: 'uber', amount: 24, category: 'Travel', date: '2025-04-04', type: 'expense' },
      ];
    }
  }
  function saveToStorage() {
    localStorage.setItem('expense_tracker', JSON.stringify(transactions));
  }

  // ==================== HELPERS / FORMAT ====================
  function formatCurrency(amt) {
    return '$' + Number(amt).toFixed(2);
  }

  // ==================== TOTALS & MONTHLY ====================
  function calculateTotals() {
    const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0);
    const balance = income - expense;
    totalIncomeSpan.innerText = formatCurrency(income);
    totalExpenseSpan.innerText = formatCurrency(expense);
    totalBalanceSpan.innerText = formatCurrency(balance);
    return { income, expense, balance };
  }

  function updateMonthlySummary() {
    const now = new Date();
    const currentMonth = now.getMonth()+1;
    const currentYear = now.getFullYear();
    let monthlyIncome = 0, monthlyExpense = 0;
    transactions.forEach(t => {
      const [y,m] = t.date.split('-').map(Number);
      if (y === currentYear && m === currentMonth) {
        if (t.type === 'income') monthlyIncome += Number(t.amount);
        else monthlyExpense += Number(t.amount);
      }
    });
    monthlyEarningSpan.innerText = formatCurrency(monthlyIncome);
    monthlySpendingSpan.innerText = formatCurrency(monthlyExpense);
  }

  // ==================== RENDER TABLE & FILTER ====================
  function renderTable() {
    const searchTerm = searchInput.value.toLowerCase();
    const catFilter = categoryFilter.value;
    const filtered = transactions.filter(t => 
      t.title.toLowerCase().includes(searchTerm) &&
      (catFilter === 'all' || t.category === catFilter)
    );
    // sort by date descending (newest first)
    filtered.sort((a,b) => (a.date < b.date ? 1 : -1));

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem;">no transactions</td></tr>`;
    } else {
      tbody.innerHTML = filtered.map(t => `
        <tr>
          <td>${escapeHtml(t.title)}</td>
          <td style="color:${t.type==='income'?'#059669':'#b91c1c'}">${formatCurrency(t.amount)}</td>
          <td>${t.category}</td>
          <td>${t.date}</td>
          <td>${t.type}</td>
          <td class="actions-cell">
            <button class="icon-btn edit-btn" data-id="${t.id}">✏️</button>
            <button class="icon-btn delete-btn" data-id="${t.id}">🗑️</button>
          </td>
        </tr>
      `).join('');
    }
    // attach events after render
    document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', onEdit));
    document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', onDeleteClick));
    updateChart(filtered);
    calculateTotals();
    updateMonthlySummary();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ==================== CHART (pie) ====================
  function updateChart(filteredData) {
    const categories = ['Food','Travel','Shopping','Bills','Other'];
    const categoryTotals = categories.map(cat => 
      filteredData.filter(t => t.type==='expense' && t.category===cat).reduce((sum,t)=> sum+Number(t.amount),0)
    );
    const ctx = document.getElementById('categoryChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: categories,
        datasets: [{
          data: categoryTotals,
          backgroundColor: ['#f97316','#3b82f6','#8b5cf6','#10b981','#64748b'],
          borderWidth: 0
        }]
      },
      options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } } }
    });
  }

  // ==================== MODAL LOGIC (add / edit) ====================
  function openModal(editMode = false, transaction = null) {
    modalTitle.innerText = editMode ? 'edit transaction' : 'add transaction';
    if (editMode && transaction) {
      editId.value = transaction.id;
      titleInput.value = transaction.title;
      amountInput.value = transaction.amount;
      categorySelect.value = transaction.category;
      typeSelect.value = transaction.type;
      dateInput.value = transaction.date;
    } else {
      editId.value = '';
      transactionForm.reset();
      dateInput.value = new Date().toISOString().slice(0,10); // default today
    }
    clearErrors();
    modalOverlay.style.display = 'block';
    transactionModal.style.display = 'block';
  }

  function closeModals() {
    modalOverlay.style.display = 'none';
    transactionModal.style.display = 'none';
    deleteModal.style.display = 'none';
  }

  function clearErrors() {
    ['titleError','amountError','dateError'].forEach(id => document.getElementById(id).innerText='');
  }

  // ==================== VALIDATION ====================
  function validateForm() {
    let valid = true;
    clearErrors();
    if (!titleInput.value.trim()) {
      document.getElementById('titleError').innerText = 'title required';
      valid = false;
    }
    const amt = parseFloat(amountInput.value);
    if (!amountInput.value || isNaN(amt) || amt <= 0) {
      document.getElementById('amountError').innerText = 'positive number required';
      valid = false;
    }
    if (!dateInput.value) {
      document.getElementById('dateError').innerText = 'date required';
      valid = false;
    }
    return valid;
  }

  // ==================== CRUD actions ====================
  function onAddNew() {
    openModal(false);
  }

  function onEdit(e) {
    e.stopPropagation();
    const id = e.currentTarget.dataset.id;
    const transaction = transactions.find(t => t.id === id);
    if (transaction) openModal(true, transaction);
  }

  function onDeleteClick(e) {
    e.stopPropagation();
    deleteId = e.currentTarget.dataset.id;
    modalOverlay.style.display = 'block';
    deleteModal.style.display = 'block';
  }

  function deleteTransaction() {
    if (!deleteId) return;
    transactions = transactions.filter(t => t.id !== deleteId);
    saveToStorage();
    renderTable();
    closeModals();
    showToast('transaction deleted');
    deleteId = null;
  }

  // ==================== SAVE (add/edit) ====================
  function handleFormSubmit(e) {
    e.preventDefault();
    if (!validateForm()) return;

    const id = editId.value || Date.now().toString();  // if empty, new ID
    const transactionData = {
      id: id,
      title: titleInput.value.trim(),
      amount: parseFloat(amountInput.value),
      category: categorySelect.value,
      type: typeSelect.value,
      date: dateInput.value,
    };

    if (editId.value) {  // edit existing
      transactions = transactions.map(t => t.id === editId.value ? transactionData : t);
      showToast('transaction updated');
    } else {             // add new
      transactions.push(transactionData);
      showToast('transaction added');
    }

    saveToStorage();
    renderTable();
    closeModals();
  }

  // ==================== CLEAR ALL ====================
  function clearAllTransactions() {
    if (transactions.length === 0) return;
    if (confirm('Delete all transactions? (cannot undo)')) {  // simple confirm
      transactions = [];
      saveToStorage();
      renderTable();
      showToast('all transactions cleared');
    }
  }

  // ==================== TOAST ====================
  function showToast(text) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = text;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 2800);
  }

  // ==================== THEME ====================
  function initTheme() {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      document.body.classList.add('dark-mode');
      themeToggle.innerText = '☀️ light';
    } else {
      document.body.classList.remove('dark-mode');
      themeToggle.innerText = '🌙 dark';
    }
  }
  function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeToggle.innerText = isDark ? '☀️ light' : '🌙 dark';
  }

  // ==================== EVENT LISTENERS ====================
  function initEventListeners() {
    openAddBtn.addEventListener('click', onAddNew);
    closeModalBtn.addEventListener('click', closeModals);
    modalOverlay.addEventListener('click', closeModals);
    transactionForm.addEventListener('submit', handleFormSubmit);
    cancelDelete.addEventListener('click', closeModals);
    confirmDelete.addEventListener('click', deleteTransaction);
    searchInput.addEventListener('input', renderTable);
    categoryFilter.addEventListener('change', renderTable);
    themeToggle.addEventListener('click', toggleTheme);
    clearAllBtn.addEventListener('click', clearAllTransactions);
    window.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModals();
    });
  }

  // ==================== INIT ====================
  function init() {
    loadFromStorage();
    // ensure all transactions have id and proper structure
    transactions = transactions.filter(t => t.id && t.title && t.amount && t.date && t.type);
    if (!transactions.length) {
      // add a tiny placeholder to avoid empty chart
      transactions = [{ id:'init1', title:'sample', amount:100, category:'Other', date:new Date().toISOString().slice(0,10), type:'income' }];
    }
    saveToStorage(); // rewrite clean
    renderTable();
    initTheme();
    initEventListeners();
    // set default date in modal (if not opened)
    dateInput.value = new Date().toISOString().slice(0,10);
  }

  init();
})();