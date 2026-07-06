/* global Chart */

const SYMBOL_INPUT = document.getElementById('symbol-input');
const RUN_BUTTON = document.getElementById('run-backtest');
const RANGE_BUTTONS = Array.from(document.querySelectorAll('.range-btn'));
const DATA_SOURCE = document.getElementById('data-source');
const LOAD_STATUS = document.getElementById('load-status');
const START_PRICE = document.getElementById('start-price');
const END_PRICE = document.getElementById('end-price');
const RETURN_PERCENT = document.getElementById('return-percent');
const MAX_DRAWDOWN = document.getElementById('max-drawdown');
const VOLATILITY = document.getElementById('volatility');
const CHART_EL = document.getElementById('price-chart');

if (CHART_EL && typeof Chart !== 'undefined') {
  const state = {
    symbol: normalizeSymbol(SYMBOL_INPUT?.value || 'AAPL'),
    range: '1w',
    source: 'live',
    rawSeries: [],
    chart: null,
  };

  const RANGE_TO_DAYS = {
    '1w': 7,
    '1m': 31,
    '1y': 365,
    '5y': Infinity,
  };

  const formatPrice = new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formatPercent = new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: 'exceptZero',
  });

  init().catch((error) => {
    console.error(error);
    useDemoData('AAPL', 'Initialisierung fehlgeschlagen; Demo-Daten geladen.');
  });

  RUN_BUTTON?.addEventListener('click', () => {
    void loadSymbol(SYMBOL_INPUT.value);
  });

  SYMBOL_INPUT?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void loadSymbol(SYMBOL_INPUT.value);
    }
  });

  RANGE_BUTTONS.forEach((button) => {
    button.addEventListener('click', () => {
      state.range = button.dataset.range || '1w';
      updateActiveRange();
      render();
    });
  });

  async function init() {
    updateActiveRange();
    await loadSymbol(state.symbol);
  }

  async function loadSymbol(rawSymbol) {
    const symbol = normalizeSymbol(rawSymbol);
    if (!symbol) {
      LOAD_STATUS.textContent = 'Bitte ein gültiges Symbol eingeben.';
      return;
    }

    state.symbol = symbol;
    if (SYMBOL_INPUT.value !== symbol) {
      SYMBOL_INPUT.value = symbol;
    }

    setLoading(true, `Lade ${symbol} …`);

    try {
      const series = await fetchYahooSeries(symbol);
      state.rawSeries = series;
      state.source = 'live';
      DATA_SOURCE.textContent = 'Live-Daten';
      DATA_SOURCE.classList.remove('demo');
      LOAD_STATUS.textContent = `${symbol} geladen.`;
      render();
    } catch (error) {
      console.warn('Live-Daten fehlgeschlagen, verwende Demo-Daten.', error);
      useDemoData(symbol, 'Live-Daten nicht verfügbar; Demo-Daten geladen.');
    } finally {
      setLoading(false);
    }
  }

  function useDemoData(symbol, message) {
    state.symbol = symbol;
    state.source = 'demo';
    state.rawSeries = buildDemoSeries(symbol, 5 * 252);
    DATA_SOURCE.textContent = 'Demo-Daten';
    DATA_SOURCE.classList.add('demo');
    LOAD_STATUS.textContent = message;
    if (SYMBOL_INPUT.value !== symbol) {
      SYMBOL_INPUT.value = symbol;
    }
    render();
  }

  function setLoading(isLoading, message) {
    RUN_BUTTON.disabled = isLoading;
    SYMBOL_INPUT.disabled = isLoading;

    if (message) {
      LOAD_STATUS.textContent = message;
    }

    if (isLoading) {
      DATA_SOURCE.textContent = 'Lädt …';
    }
  }

  function updateActiveRange() {
    RANGE_BUTTONS.forEach((button) => {
      const active = button.dataset.range === state.range;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function render() {
    if (!state.rawSeries.length) {
      return;
    }

    const visibleSeries = sliceByRange(state.rawSeries, state.range);
    const labels = visibleSeries.map((point) => formatLabel(point.date));
    const prices = visibleSeries.map((point) => point.close);
    const metrics = calculateMetrics(visibleSeries);

    updateMetrics(metrics);
    updateChart(labels, prices);

    const suffix = state.source === 'demo' ? ' · Demo-Daten' : '';
    document.title = `Backtest – ${state.symbol}${suffix}`;
  }

  function updateMetrics(metrics) {
    START_PRICE.textContent = `${formatPrice.format(metrics.start)} €`;
    END_PRICE.textContent = `${formatPrice.format(metrics.end)} €`;
    RETURN_PERCENT.textContent = `${formatPercent.format(metrics.returnPct)} %`;
    MAX_DRAWDOWN.textContent = `${formatPercent.format(metrics.maxDrawdown)} %`;
    VOLATILITY.textContent = `${formatPercent.format(metrics.volatility)} %`;
  }

  function updateChart(labels, prices) {
    const data = {
      labels,
      datasets: [
        {
          label: `${state.symbol} Kurs`,
          data: prices,
          borderColor: '#2962ff',
          backgroundColor: 'rgba(41, 98, 255, 0.12)',
          pointRadius: 0,
          pointHitRadius: 10,
          tension: 0.28,
          borderWidth: 2.5,
          fill: true,
        },
      ],
    };

    if (!state.chart) {
      state.chart = new Chart(CHART_EL, {
        type: 'line',
        data,
        options: chartOptions(),
      });
      return;
    }

    state.chart.data = data;
    state.chart.options = chartOptions();
    state.chart.update();
  }

  function chartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.96)',
          borderColor: 'rgba(255, 255, 255, 0.08)',
          borderWidth: 1,
          padding: 12,
          titleColor: '#ffffff',
          bodyColor: '#e2e8f0',
          displayColors: false,
          callbacks: {
            label(context) {
              return ` ${formatPrice.format(context.parsed.y)} €`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            color: '#667085',
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
          },
          border: {
            color: 'rgba(228, 233, 242, 0.9)',
          },
        },
        y: {
          grid: {
            color: 'rgba(228, 233, 242, 0.85)',
          },
          ticks: {
            color: '#667085',
            callback(value) {
              return `${Number(value).toFixed(0)} €`;
            },
          },
          border: {
            color: 'rgba(228, 233, 242, 0.9)',
          },
        },
      },
    };
  }

  function normalizeSymbol(value) {
    return String(value || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9.^-]/g, '')
      .slice(0, 12);
  }

  async function fetchYahooSeries(symbol) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5y`;
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Yahoo API antwortete mit ${response.status}`);
    }

    const payload = await response.json();
    const result = payload?.chart?.result?.[0];
    const timestamps = result?.timestamp || [];
    const closes = result?.indicators?.quote?.[0]?.close || [];

    const series = timestamps
      .map((timestamp, index) => ({
        date: new Date(timestamp * 1000),
        close: closes[index],
      }))
      .filter((point) => Number.isFinite(point.close));

    if (series.length < 20) {
      throw new Error('Zu wenige Datenpunkte aus der API.');
    }

    return series;
  }

  function sliceByRange(series, range) {
    const cutoff = new Date(series[series.length - 1].date);
    const days = RANGE_TO_DAYS[range] ?? RANGE_TO_DAYS['1w'];

    if (Number.isFinite(days)) {
      cutoff.setDate(cutoff.getDate() - days);
      return series.filter((point) => point.date >= cutoff);
    }

    return series;
  }

  function calculateMetrics(series) {
    const start = series[0].close;
    const end = series[series.length - 1].close;
    const returnPct = ((end - start) / start) * 100;

    let runningMax = series[0].close;
    let worstDrawdown = 0;
    const dailyReturns = [];

    for (let index = 1; index < series.length; index += 1) {
      const current = series[index].close;
      const previous = series[index - 1].close;
      const dailyReturn = (current / previous) - 1;
      dailyReturns.push(dailyReturn);

      if (current > runningMax) {
        runningMax = current;
      }

      const drawdown = (current / runningMax) - 1;
      if (drawdown < worstDrawdown) {
        worstDrawdown = drawdown;
      }
    }

    const mean = dailyReturns.reduce((sum, value) => sum + value, 0) / Math.max(dailyReturns.length, 1);
    const variance = dailyReturns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(dailyReturns.length - 1, 1);
    const volatility = Math.sqrt(variance) * Math.sqrt(252) * 100;

    return {
      start,
      end,
      returnPct,
      maxDrawdown: worstDrawdown * 100,
      volatility,
    };
  }

  function formatLabel(date) {
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    }).format(date);
  }

  function buildDemoSeries(symbol, points) {
    const seed = Array.from(symbol).reduce((total, char) => total + char.charCodeAt(0), 0) || 1;
    const rand = seededRandom(seed);
    const today = new Date();
    const startDate = new Date(today);
    startDate.setFullYear(startDate.getFullYear() - 5);

    const totalBusinessDays = Math.max(points, 900);
    const series = [];
    let price = 80 + (seed % 180);

    for (let dayOffset = 0; series.length < totalBusinessDays; dayOffset += 1) {
      const current = new Date(startDate);
      current.setDate(startDate.getDate() + dayOffset);

      if (isWeekend(current)) {
        continue;
      }

      const drift = 0.00025;
      const shock = (rand() - 0.5) * 0.028;
      price = Math.max(10, price * (1 + drift + shock));
      series.push({
        date: current,
        close: Number(price.toFixed(2)),
      });
    }

    return series;
  }

  function seededRandom(seed) {
    let value = seed % 2147483647;
    if (value <= 0) {
      value += 2147483646;
    }

    return () => {
      value = (value * 16807) % 2147483647;
      return (value - 1) / 2147483646;
    };
  }

  function isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6;
  }
}
