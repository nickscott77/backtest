/* global Chart */

(() => {
  const API_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
  const RANGE_DAYS = {
    '1w': 7,
    '1m': 30,
    '1y': 365,
    '5y': 365 * 5,
  };
  const PERIOD_LABELS = {
    '1w': '1 Woche',
    '1m': '1 Monat',
    '1y': '1 Jahr',
    '5y': '5 Jahre',
  };

  const els = {};
  let chart;
  let allPoints = [];
  let activeRange = '5y';
  let activeSymbol = 'AAPL';
  let currentSource = 'Yahoo Finance';
  let currentMode = 'live';

  document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    bindEvents();
    initChart();

    const params = new URLSearchParams(window.location.search);
    const symbolFromUrl = params.get('symbol');
    const rangeFromUrl = params.get('range');
    if (rangeFromUrl && RANGE_DAYS[rangeFromUrl]) {
      activeRange = rangeFromUrl;
    }
    if (symbolFromUrl) {
      els.symbolInput.value = normalizeSymbol(symbolFromUrl);
    }

    setActivePeriod(activeRange);
    loadSymbol(els.symbolInput.value, { preferCurrentRange: true });
  });

  function cacheElements() {
    els.form = document.getElementById('symbol-form');
    els.symbolInput = document.getElementById('symbol-input');
    els.runButton = document.getElementById('run-button');
    els.periodButtons = Array.from(document.querySelectorAll('.period-button'));
    els.dataSource = document.getElementById('data-source');
    els.statusText = document.getElementById('status-text');
    els.chartMeta = document.getElementById('chart-meta');
    els.canvas = document.getElementById('price-chart');
    els.metricStart = document.getElementById('metric-start');
    els.metricEnd = document.getElementById('metric-end');
    els.metricReturn = document.getElementById('metric-return');
    els.metricDrawdown = document.getElementById('metric-drawdown');
    els.metricVolatility = document.getElementById('metric-volatility');
  }

  function bindEvents() {
    els.form.addEventListener('submit', (event) => {
      event.preventDefault();
      loadSymbol(els.symbolInput.value);
    });

    els.periodButtons.forEach((button) => {
      button.addEventListener('click', () => {
        activeRange = button.dataset.range;
        setActivePeriod(activeRange);
        renderFromCache();
      });
    });
  }

  function initChart() {
    const ctx = els.canvas.getContext('2d');
    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Kurs',
            data: [],
            borderColor: '#1d4ed8',
            backgroundColor: 'rgba(29, 78, 216, 0.08)',
            borderWidth: 2.5,
            pointRadius: 0,
            tension: 0.25,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 160 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(context) {
                return ` ${formatCurrency(context.parsed.y)}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              maxRotation: 0,
              autoSkip: true,
              color: '#667085',
            },
          },
          y: {
            grid: { color: 'rgba(15, 23, 42, 0.08)' },
            ticks: {
              color: '#667085',
              callback(value) {
                return formatCurrency(value);
              },
            },
          },
        },
      },
    });
  }

  function setActivePeriod(range) {
    els.periodButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.range === range);
    });
    els.chartMeta.textContent = `${PERIOD_LABELS[range]} · ${activeSymbol}`;
  }

  async function loadSymbol(inputSymbol, options = {}) {
    const symbol = normalizeSymbol(inputSymbol);
    if (!symbol) return;

    activeSymbol = symbol;
    els.symbolInput.value = symbol;
    els.runButton.disabled = true;
    els.statusText.textContent = 'Lade Kursdaten …';
    currentMode = 'live';
    updateDataSource('Yahoo Finance');

    try {
      allPoints = await fetchYahooData(symbol);
      currentSource = 'Yahoo Finance';
      currentMode = 'live';
      els.statusText.textContent = `Daten geladen für ${symbol}.`;
    } catch (error) {
      allPoints = generateDemoData(symbol);
      currentSource = 'Demo-Daten';
      currentMode = 'demo';
      els.statusText.textContent = `Live-Fetch fehlgeschlagen – Demo-Daten für ${symbol}.`;
      console.warn('Yahoo Finance fetch failed, using demo data.', error);
    } finally {
      els.runButton.disabled = false;
      updateDataSource(currentSource);
      renderFromCache(options.preferCurrentRange ? activeRange : '5y');
    }
  }

  async function fetchYahooData(symbol) {
    const url = `${API_URL}/${encodeURIComponent(symbol)}?interval=1d&range=5y`;
    const response = await fetch(url, {
      mode: 'cors',
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Yahoo response ${response.status}`);
    }

    const payload = await response.json();
    const result = payload?.chart?.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const closes = result?.indicators?.quote?.[0]?.close ?? [];

    const points = [];
    timestamps.forEach((timestamp, index) => {
      const close = closes[index];
      if (Number.isFinite(close)) {
        points.push({ date: new Date(timestamp * 1000), value: Number(close) });
      }
    });

    if (points.length < 20) {
      throw new Error('Not enough market data returned');
    }

    return points;
  }

  function generateDemoData(symbol) {
    const seed = symbolSeed(symbol);
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 5);
    startDate.setHours(0, 0, 0, 0);

    const rand = mulberry32(seed);
    const points = [];
    let price = 60 + (seed % 240);
    let day = new Date(startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    while (day <= today) {
      const weekday = day.getDay();
      if (weekday !== 0 && weekday !== 6) {
        const cycle = Math.sin(points.length / 45) * 0.0035;
        const drift = 0.00035 + cycle;
        const shock = (rand() - 0.5) * 0.028;
        const volatilityCluster = Math.sin(points.length / 120) * 0.006;
        price = Math.max(5, price * (1 + drift + shock + volatilityCluster * 0.4));
        points.push({ date: new Date(day), value: Number(price.toFixed(2)) });
      }
      day.setDate(day.getDate() + 1);
    }

    return points;
  }

  function renderFromCache(rangeOverride) {
    if (!allPoints.length) return;

    const range = rangeOverride ?? activeRange;
    const days = RANGE_DAYS[range] ?? RANGE_DAYS['5y'];
    const filtered = filterPoints(allPoints, days);
    const metrics = calculateMetrics(filtered);

    chart.data.labels = filtered.map((point) => formatDate(point.date));
    chart.data.datasets[0].data = filtered.map((point) => point.value);
    chart.data.datasets[0].label = `${activeSymbol} · ${currentMode === 'demo' ? 'Demo-Daten' : 'Yahoo Finance'}`;
    chart.update('none');

    updateMetrics(metrics);
    updateDataSource(currentSource);
    els.chartMeta.textContent = `${PERIOD_LABELS[range]} · ${activeSymbol} · ${filtered.length.toLocaleString('de-DE')} Punkte`;
  }

  function filterPoints(points, days) {
    const lastDate = points[points.length - 1].date;
    const cutoff = new Date(lastDate);
    cutoff.setDate(cutoff.getDate() - days);
    return points.filter((point) => point.date >= cutoff);
  }

  function calculateMetrics(points) {
    if (points.length < 2) {
      return null;
    }

    const start = points[0].value;
    const end = points[points.length - 1].value;
    const returnPct = ((end / start) - 1) * 100;
    const drawdownPct = calculateMaxDrawdown(points);
    const volatilityPct = calculateAnnualizedVolatility(points);

    return { start, end, returnPct, drawdownPct, volatilityPct };
  }

  function calculateMaxDrawdown(points) {
    let peak = points[0].value;
    let maxDrawdown = 0;

    for (const point of points) {
      peak = Math.max(peak, point.value);
      const drawdown = (point.value / peak) - 1;
      maxDrawdown = Math.min(maxDrawdown, drawdown);
    }

    return maxDrawdown * 100;
  }

  function calculateAnnualizedVolatility(points) {
    const returns = [];
    for (let index = 1; index < points.length; index += 1) {
      const prev = points[index - 1].value;
      const current = points[index].value;
      if (prev > 0) {
        returns.push((current / prev) - 1);
      }
    }

    if (!returns.length) return 0;

    const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
    const variance = returns.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / returns.length;
    return Math.sqrt(variance) * Math.sqrt(252) * 100;
  }

  function updateMetrics(metrics) {
    if (!metrics) {
      els.metricStart.textContent = '—';
      els.metricEnd.textContent = '—';
      els.metricReturn.textContent = '—';
      els.metricDrawdown.textContent = '—';
      els.metricVolatility.textContent = '—';
      return;
    }

    els.metricStart.textContent = formatCurrency(metrics.start);
    els.metricEnd.textContent = formatCurrency(metrics.end);
    els.metricReturn.textContent = formatPercent(metrics.returnPct);
    els.metricDrawdown.textContent = formatPercent(metrics.drawdownPct);
    els.metricVolatility.textContent = formatPercent(metrics.volatilityPct);
  }

  function updateDataSource(label) {
    els.dataSource.textContent = label;
    els.dataSource.dataset.mode = label === 'Demo-Daten' ? 'demo' : 'live';
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(value);
  }

  function formatPercent(value) {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2).replace('.', ',')} %`;
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    }).format(date);
  }

  function normalizeSymbol(value) {
    return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, '').slice(0, 12);
  }

  function symbolSeed(symbol) {
    return symbol.split('').reduce((seed, char) => (seed * 31 + char.charCodeAt(0)) >>> 0, 0) || 7;
  }

  function mulberry32(seed) {
    return function random() {
      let t = (seed += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
})();
