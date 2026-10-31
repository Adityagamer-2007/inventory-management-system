// Small helpers. No inline scripts are used anywhere (the Content-Security-Policy blocks them).
(function () {
  // Confirm before running any form that has a data-confirm message.
  document.addEventListener('submit', function (e) {
    var form = e.target;
    var message = form.getAttribute && form.getAttribute('data-confirm');
    if (message && !window.confirm(message)) e.preventDefault();
  });

  // Mobile sidebar
  var sidebar = document.getElementById('sidebar');
  var toggle = document.getElementById('sidebarToggle');
  var backdrop = document.getElementById('sidebarBackdrop');
  function setOpen(open) {
    if (!sidebar) return;
    sidebar.classList.toggle('open', open);
    if (backdrop) backdrop.classList.toggle('show', open);
  }
  if (toggle) toggle.addEventListener('click', function () { setOpen(!sidebar.classList.contains('open')); });
  if (backdrop) backdrop.addEventListener('click', function () { setOpen(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });

  // Prevent double submits
  document.addEventListener('submit', function (e) {
    if (e.defaultPrevented) return;
    var btn = e.target.querySelector && e.target.querySelector('button[type="submit"]');
    if (btn) setTimeout(function () { btn.disabled = true; }, 0);
  });

  // Dashboard charts
  var dataEl = document.getElementById('chart-data');
  if (dataEl && window.Chart) {
    var data = JSON.parse(dataEl.textContent);
    var palette = ['#1f6f5c', '#b9770e', '#4a6fa5', '#8a5a83', '#b23a2e', '#6b8e4e', '#7d8a93'];

    var catCanvas = document.getElementById('categoryChart');
    if (catCanvas && data.stockByCategory.values.length) {
      new Chart(catCanvas, {
        type: 'doughnut',
        data: { labels: data.stockByCategory.labels, datasets: [{ data: data.stockByCategory.values, backgroundColor: palette, borderWidth: 1 }] },
        options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
      });
    }
    var moveCanvas = document.getElementById('movementChart');
    if (moveCanvas) {
      new Chart(moveCanvas, {
        type: 'bar',
        data: {
          labels: data.movements.labels,
          datasets: [
            { label: 'Stock In', data: data.movements.stockIn, backgroundColor: '#1f6f5c' },
            { label: 'Stock Out', data: data.movements.stockOut, backgroundColor: '#b9770e' }
          ]
        },
        options: { maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { position: 'bottom' } } }
      });
    }
  }
})();
