let trendChart;
let themeChart;

async function loadContractsDashboardStats() {
  const response = await fetch('/api/contracts/stats/dashboard');
  const data = await response.json();
  if (!response.ok) return;

  document.getElementById('kpiContractsTotal').textContent = data.totalContracts || 0;
  document.getElementById('kpiContractsSigned').textContent = data.signedContracts || 0;
  document.getElementById('kpiContractsPending').textContent = data.pendingContracts || 0;
  document.getElementById('kpiAvgSignTime').textContent = `${Number(data.avgSignatureHours || 0).toFixed(1)}h`;

  const union = [...new Set([...(data.monthlyCreated || []).map((v) => v.month), ...(data.monthlySigned || []).map((v) => v.month)])].sort();
  const createdMap = Object.fromEntries((data.monthlyCreated || []).map((v) => [v.month, v.total]));
  const signedMap = Object.fromEntries((data.monthlySigned || []).map((v) => [v.month, v.total]));

  const trendCtx = document.getElementById('contractsTrendChart');
  if (trendCtx) {
    trendChart?.destroy();
    trendChart = new Chart(trendCtx, {
      type: 'line',
      data: {
        labels: union,
        datasets: [
          { label: 'Criados', data: union.map((m) => createdMap[m] || 0), borderColor: '#ff7a18', backgroundColor: 'rgba(255,122,24,.15)', fill: true, tension: .3 },
          { label: 'Assinados', data: union.map((m) => signedMap[m] || 0), borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,.15)', fill: true, tension: .3 },
        ],
      },
      options: { responsive: true },
    });
  }

  const themeCtx = document.getElementById('contractsThemeChart');
  if (themeCtx) {
    themeChart?.destroy();
    themeChart = new Chart(themeCtx, {
      type: 'doughnut',
      data: {
        labels: (data.byTheme || []).map((t) => t.theme),
        datasets: [{ data: (data.byTheme || []).map((t) => t.total), backgroundColor: ['#ff7a18','#ffb347','#16a34a','#3b82f6','#8b5cf6','#f59e0b','#ef4444'] }],
      },
      options: { responsive: true },
    });
  }
}
