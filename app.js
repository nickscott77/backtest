/* global Chart */

const THEME_STORAGE_KEY = 'backtest-theme';
const CUSTOM_DEFAULT = `BUY WHEN sma(close, 20) crosses_above sma(close, 50)
SELL WHEN sma(close, 20) crosses_below sma(close, 50)`;

function initTheme() {
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const theme = storedTheme === 'dark' || storedTheme === 'light'
    ? storedTheme
    : (prefersDark ? 'dark' : 'light');

  applyTheme(theme);

  const toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const nextTheme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      } catch {
        // Ignore storage failures in private or sandboxed contexts.
      }
      document.dispatchEvent(new CustomEvent('backtest-theme-change'));
    });
  }
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  const toggle = document.getElementById('theme-toggle');
  if (!toggle) return;
  const dark = theme === 'dark';
  toggle.setAttribute('aria-pressed', String(dark));
  toggle.setAttribute('aria-label', dark ? 'Light Mode aktivieren' : 'Dark Mode aktivieren');
  toggle.textContent = dark ? 'Light Mode' : 'Dark Mode';
}

try {
  initTheme();
  setupDashboard();
} catch (error) {
  document.body.dataset.appError = String(error?.stack || error?.message || error);
  console.error('[Backtest Pro] init failed', error);
}

function setupDashboard() {
  const el = {
    symbolInput: document.getElementById('symbol-input'),
    runTopButton: document.getElementById('run-backtest'),
    runStrategyButton: document.getElementById('run-strategy'),
    resetButton: document.getElementById('reset-strategy'),
    rangeButtons: Array.from(document.querySelectorAll('.range-btn')),
    watchButtons: Array.from(document.querySelectorAll('.watch-btn')),
    templateButtons: Array.from(document.querySelectorAll('.template-btn')),
    strategySelect: document.getElementById('strategy-select'),
    strategyParams: document.getElementById('strategy-params'),
    strategyDescription: document.getElementById('strategy-description'),
    strategyKind: document.getElementById('strategy-kind'),
    strategyFeedback: document.getElementById('strategy-feedback'),
    customStrategy: document.getElementById('custom-strategy'),
    marketSymbolBadge: document.getElementById('market-symbol-badge'),
    marketRange: document.getElementById('market-range'),
    dataSource: document.getElementById('data-source'),
    loadStatus: document.getElementById('load-status'),
    tradeSummary: document.getElementById('trade-summary'),
    metricsCaption: document.getElementById('metrics-caption'),
    summaryStrategy: document.getElementById('summary-strategy'),
    summaryRange: document.getElementById('summary-range'),
    summarySource: document.getElementById('summary-source'),
    summarySignal: document.getElementById('summary-signal'),
    summaryPoints: document.getElementById('summary-points'),
    tradeBody: document.getElementById('trade-body'),
    capitalInput: document.getElementById('capital-input'),
    feeInput: document.getElementById('fee-input'),
    slippageInput: document.getElementById('slippage-input'),
    endValue: document.getElementById('end-value'),
    strategyReturn: document.getElementById('strategy-return'),
    benchmarkReturn: document.getElementById('benchmark-return'),
    outperformance: document.getElementById('outperformance'),
    maxDrawdown: document.getElementById('max-drawdown'),
    tradeCount: document.getElementById('trade-count'),
    winRate: document.getElementById('win-rate'),
    profitFactor: document.getElementById('profit-factor'),
    sharpeRatio: document.getElementById('sharpe-ratio'),
    volatility: document.getElementById('volatility'),
    priceCanvas: document.getElementById('price-chart'),
    equityCanvas: document.getElementById('equity-chart'),
    drawdownCanvas: document.getElementById('drawdown-chart'),
  };

  if (!el.symbolInput || !el.priceCanvas || typeof Chart === 'undefined') {
    if (el.strategyFeedback) {
      el.strategyFeedback.textContent = typeof Chart === 'undefined'
        ? 'Chart.js ist nicht geladen. Die App benötigt das CDN für die Charts.'
        : 'Dashboard-Elemente nicht vollständig gefunden.';
    }
    return;
  }

  const strategyDefinitions = buildStrategyDefinitions();
  const strategyOrder = ['buy_hold', 'ma_crossover', 'rsi', 'bollinger', 'breakout', 'macd', 'custom'];
  const strategyDefaults = {
    buy_hold: {},
    ma_crossover: { fastPeriod: 20, slowPeriod: 50, maType: 'SMA' },
    rsi: { period: 14, buyBelow: 30, sellAbove: 70 },
    bollinger: { period: 20, stdDev: 2, exitAtMiddle: true },
    breakout: { lookback: 20, exitLookback: 10 },
    macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
    custom: {},
  };

  const state = {
    symbol: normalizeSymbol(el.symbolInput.value || 'AAPL'),
    range: '1y',
    source: 'live',
    currency: 'USD',
    candles: [],
    visibleCandles: [],
    lastResult: null,
    requestToken: 0,
    charts: {
      price: null,
      equity: null,
      drawdown: null,
    },
  };

  const formatters = {
    number: new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    number3: new Intl.NumberFormat('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
    integer: new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }),
    percent: new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      signDisplay: 'exceptZero',
    }),
    date: new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    shortDate: new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' }),
  };

  const rangeLabels = {
    '1m': '1M',
    '3m': '3M',
    '6m': '6M',
    '1y': '1J',
    '3y': '3J',
    '5y': '5J',
    max: 'Max',
  };

  const rangeDays = {
    '1m': 31,
    '3m': 92,
    '6m': 183,
    '1y': 365,
    '3y': 365 * 3,
    '5y': 365 * 5,
    max: Infinity,
  };

  const customTemplates = {
    crossover: `BUY WHEN sma(close, 20) crosses_above sma(close, 50)
SELL WHEN sma(close, 20) crosses_below sma(close, 50)` ,
    rsi: `BUY WHEN rsi(close, 14) < 30
SELL WHEN rsi(close, 14) > 70`,
    breakout: `BUY WHEN close > highest(high, 20)
SELL WHEN close < lowest(low, 10)`,
  };

  if (!el.customStrategy.value.trim()) {
    el.customStrategy.value = CUSTOM_DEFAULT;
  }

  strategyOrder.forEach((id) => {
    const option = el.strategySelect.querySelector(`option[value="${id}"]`);
    if (option && id === 'ma_crossover') {
      option.selected = true;
    }
  });

  renderStrategyPanel(el.strategySelect.value || 'ma_crossover');
  updateRangeButtons();
  updateSummaryBasics();
  bindEvents();

  void loadSymbol(state.symbol, { rerun: true });

  function bindEvents() {
    el.runTopButton.addEventListener('click', () => {
      void loadSymbol(el.symbolInput.value, { rerun: true });
    });

    el.runStrategyButton.addEventListener('click', () => {
      void runCurrentBacktest();
    });

    el.resetButton.addEventListener('click', () => {
      el.strategySelect.value = 'custom';
      el.customStrategy.value = CUSTOM_DEFAULT;
      renderStrategyPanel('custom');
      void runCurrentBacktest();
    });

    el.symbolInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void loadSymbol(el.symbolInput.value, { rerun: true });
      }
    });

    el.rangeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        state.range = button.dataset.range || '1y';
        updateRangeButtons();
        renderRangeLabel();
        if (state.candles.length) {
          runCurrentBacktest();
        }
      });
    });

    el.watchButtons.forEach((button) => {
      button.addEventListener('click', () => {
        void loadSymbol(button.dataset.symbol || 'AAPL', { rerun: true });
      });
    });

    el.templateButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const template = customTemplates[button.dataset.template || 'crossover'] || CUSTOM_DEFAULT;
        el.strategySelect.value = 'custom';
        el.customStrategy.value = template;
        renderStrategyPanel('custom');
        void runCurrentBacktest();
      });
    });

    el.strategySelect.addEventListener('change', () => {
      const strategyId = el.strategySelect.value || 'ma_crossover';
      if (strategyId === 'custom' && !el.customStrategy.value.trim()) {
        el.customStrategy.value = CUSTOM_DEFAULT;
      }
      renderStrategyPanel(strategyId);
      if (state.candles.length) {
        runCurrentBacktest();
      }
    });

    el.customStrategy.addEventListener('change', () => {
      if (el.strategySelect.value === 'custom' && state.candles.length) {
        runCurrentBacktest();
      }
    });

    [el.capitalInput, el.feeInput, el.slippageInput].forEach((input) => {
      input.addEventListener('change', () => {
        if (state.candles.length) {
          runCurrentBacktest();
        }
      });
    });

    document.addEventListener('backtest-theme-change', () => {
      if (state.lastResult) {
        renderResult(state.lastResult);
      }
    });

    el.strategyParams.addEventListener('input', () => {
      if (state.candles.length) {
        runCurrentBacktest();
      }
    });
  }

  function renderStrategyPanel(strategyId) {
    const strategy = strategyDefinitions[strategyId] || strategyDefinitions.ma_crossover;
    el.strategyKind.textContent = strategy.kindLabel;
    el.strategyDescription.innerHTML = `
      <p>${escapeHtml(strategy.summary)}</p>
      <ul>
        ${strategy.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('')}
      </ul>
    `;

    el.strategyParams.innerHTML = '';
    const params = strategy.params || [];
    if (!params.length) {
      const empty = document.createElement('div');
      empty.className = 'strategy-description';
      empty.textContent = strategyId === 'custom'
        ? 'Die Custom-DSL nutzt die Textarea unten. Definiere dort BUY WHEN / SELL WHEN Regeln.'
        : 'Diese Strategie hat keine zusätzlichen Parameter.';
      el.strategyParams.appendChild(empty);
      el.strategyKind.textContent = strategyId === 'custom' ? 'Custom DSL' : strategy.kindLabel;
      if (strategyId === 'custom') {
        el.strategyFeedback.textContent = 'Custom-DSL aktiv. Die Regeln werden sicher geparst und ohne eval ausgeführt.';
      }
      return;
    }

    params.forEach((param) => {
      const row = document.createElement('label');
      row.className = 'param-row';
      row.setAttribute('for', `param-${param.key}`);

      const title = document.createElement('span');
      title.textContent = param.label;
      row.appendChild(title);

      let control;
      if (param.type === 'select') {
        control = document.createElement('select');
        control.id = `param-${param.key}`;
        control.name = param.key;
        control.className = 'field field-select';
        param.options.forEach((option) => {
          const opt = document.createElement('option');
          opt.value = option.value;
          opt.textContent = option.label;
          if (option.value === param.defaultValue) {
            opt.selected = true;
          }
          control.appendChild(opt);
        });
      } else if (param.type === 'checkbox') {
        control = document.createElement('input');
        control.type = 'checkbox';
        control.id = `param-${param.key}`;
        control.name = param.key;
        control.checked = Boolean(param.defaultValue);
        control.className = 'field';
        control.style.width = 'auto';
      } else {
        control = document.createElement('input');
        control.type = 'number';
        control.id = `param-${param.key}`;
        control.name = param.key;
        control.className = 'field';
        control.value = String(param.defaultValue);
        if (param.min !== undefined) control.min = String(param.min);
        if (param.max !== undefined) control.max = String(param.max);
        if (param.step !== undefined) control.step = String(param.step);
      }

      if (param.type === 'checkbox') {
        const inline = document.createElement('div');
        inline.className = 'inline';
        inline.appendChild(control);
        const desc = document.createElement('small');
        desc.textContent = param.help || '';
        inline.appendChild(desc);
        row.appendChild(inline);
      } else {
        row.appendChild(control);
        if (param.help) {
          const help = document.createElement('small');
          help.textContent = param.help;
          row.appendChild(help);
        }
      }

      el.strategyParams.appendChild(row);
    });

    el.strategyFeedback.textContent = strategyId === 'custom'
      ? 'Custom-DSL aktiv. Die Regeln werden sicher geparst und ohne eval ausgeführt.'
      : 'Preset aktiv. Passe die Parameter an und starte den Backtest erneut.';
  }

  function updateRangeButtons() {
    el.rangeButtons.forEach((button) => {
      const active = (button.dataset.range || '1y') === state.range;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function renderRangeLabel() {
    const label = rangeLabels[state.range] || '1J';
    el.marketRange.textContent = label;
    el.summaryRange.textContent = label;
  }

  function updateSummaryBasics() {
    const strategyId = el.strategySelect.value || 'ma_crossover';
    const strategy = strategyDefinitions[strategyId] || strategyDefinitions.ma_crossover;
    el.summaryStrategy.textContent = strategy.label;
    renderRangeLabel();
    el.summarySource.textContent = state.source === 'demo' ? 'Demo-Daten' : 'Live-Daten';
    el.summarySignal.textContent = '—';
    el.marketSymbolBadge.textContent = `${state.symbol} · ${state.currency}`;
  }

  async function loadSymbol(rawSymbol, options = {}) {
    const symbol = normalizeSymbol(rawSymbol);
    if (!symbol) {
      setStatus('Bitte ein gültiges Symbol eingeben.', { error: true });
      return;
    }

    state.symbol = symbol;
    el.symbolInput.value = symbol;
    const token = ++state.requestToken;
    setLoading(true, `Lade ${symbol} …`);

    try {
      const payload = await fetchYahooSeries(symbol);
      if (token !== state.requestToken) {
        return;
      }
      state.candles = payload.candles;
      state.currency = payload.currency || 'USD';
      state.source = 'live';
      updateDataSource('Live-Daten', false);
      setStatus(`${symbol} geladen.`, { error: false });
      if (options.rerun) {
        await runCurrentBacktest();
      }
    } catch (error) {
      console.warn('Live-Daten fehlgeschlagen, verwende Demo-Daten.', error);
      if (token !== state.requestToken) {
        return;
      }
      const fallback = buildDemoSeries(symbol, 5 * 252);
      state.candles = fallback.candles;
      state.currency = fallback.currency;
      state.source = 'demo';
      updateDataSource('Demo-Daten', true);
      setStatus('Live-Daten nicht verfügbar; Demo-Fallback geladen.', { error: false });
      if (options.rerun) {
        await runCurrentBacktest();
      }
    } finally {
      if (token === state.requestToken) {
        setLoading(false);
      }
    }
  }

  async function runCurrentBacktest() {
    if (!state.candles.length) {
      setStatus('Keine Kursdaten geladen.', { error: true });
      return;
    }

    const strategyId = el.strategySelect.value || 'ma_crossover';
    const strategy = strategyDefinitions[strategyId] || strategyDefinitions.ma_crossover;
    const params = readParameters(strategy);
    const capital = parseFlexibleNumber(el.capitalInput.value, 10000);
    const feePct = parseFlexibleNumber(el.feeInput.value, 0.05);
    const slippagePct = parseFlexibleNumber(el.slippageInput.value, 0.02);
    const visible = sliceByRange(state.candles, state.range);

    if (visible.length < 20) {
      setStatus('Für den gewählten Zeitraum sind zu wenige Datenpunkte verfügbar.', { error: true });
      return;
    }

    try {
      const result = strategyId === 'custom'
        ? runCustomBacktest(visible, state.currency, capital, feePct, slippagePct, el.customStrategy.value)
        : runPresetBacktest(visible, state.currency, capital, feePct, slippagePct, strategy, params);

      state.visibleCandles = visible;
      state.lastResult = result;
      renderResult(result);
      setStatus(`${strategy.label} ausgeführt: ${formatInteger(result.metrics.tradeCount)} Trades.`, { error: false });
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : 'Unbekannter Fehler beim Backtest.';
      el.strategyFeedback.textContent = message;
      el.strategyFeedback.className = 'feedback error';
      setStatus(message, { error: true });
    }
  }

  function renderResult(result) {
    el.strategyFeedback.textContent = result.feedback;
    el.strategyFeedback.className = `feedback ${result.feedbackType}`;

    el.endValue.textContent = formatMoney(result.metrics.finalValue, state.currency);
    el.strategyReturn.textContent = formatPercent(result.metrics.strategyReturnPct);
    el.benchmarkReturn.textContent = formatPercent(result.metrics.benchmarkReturnPct);
    el.outperformance.textContent = formatPercent(result.metrics.outperformancePct);
    el.maxDrawdown.textContent = formatPercent(result.metrics.maxDrawdownPct);
    el.tradeCount.textContent = formatInteger(result.metrics.tradeCount);
    el.winRate.textContent = `${formatNumber(result.metrics.winRatePct)} %`;
    el.profitFactor.textContent = formatRatio(result.metrics.profitFactor);
    el.sharpeRatio.textContent = formatRatio(result.metrics.sharpeRatio);
    el.volatility.textContent = `${formatNumber(result.metrics.volatilityPct)} %`;

    el.tradeSummary.textContent = result.tradeSummary;
    el.metricsCaption.textContent = `Kapital ${formatMoney(result.inputs.capital, state.currency)} · Gebühren ${formatNumber(result.inputs.feePct)}% · Slippage ${formatNumber(result.inputs.slippagePct)}%`;

    el.summaryStrategy.textContent = result.strategyLabel;
    el.summaryRange.textContent = rangeLabels[state.range] || '1J';
    el.summarySource.textContent = state.source === 'demo' ? 'Demo-Daten' : 'Live-Daten';
    el.summarySignal.textContent = result.lastSignal || 'Kein finales Signal';
    el.summaryPoints.innerHTML = '';
    result.summaryPoints.forEach((point) => {
      const li = document.createElement('li');
      li.textContent = point;
      el.summaryPoints.appendChild(li);
    });
    if (!result.summaryPoints.length) {
      const li = document.createElement('li');
      li.textContent = 'Kein aktives Signal ausgelöst.';
      el.summaryPoints.appendChild(li);
    }

    renderPriceChart(result);
    renderEquityChart(result);
    renderDrawdownChart(result);
    renderTradeTable(result.trades);
    renderMarketMeta(result);
  }

  function renderMarketMeta(result) {
    el.marketSymbolBadge.textContent = `${state.symbol} · ${state.currency}`;
    el.marketRange.textContent = rangeLabels[state.range] || '1J';
    el.loadStatus.textContent = `${result.visibleCandles.length} Kerzen analysiert.`;
  }

  function renderPriceChart(result) {
    const colors = getChartColors();
    const labels = result.visibleCandles.map((candle) => formatChartDate(candle.date));
    const priceSeries = result.visibleCandles.map((candle) => candle.close);

    const data = {
      labels,
      datasets: [
        {
          label: `${state.symbol} Schlusskurs`,
          data: priceSeries,
          borderColor: colors.accent,
          backgroundColor: colors.fill,
          pointRadius: 0,
          pointHitRadius: 10,
          tension: 0.25,
          borderWidth: 2.4,
          fill: true,
        },
        {
          label: 'Kauf',
          data: result.buyMarkers,
          pointStyle: 'triangle',
          rotation: 0,
          pointRadius: 7,
          borderColor: 'rgba(15, 157, 122, 0.95)',
          backgroundColor: 'rgba(15, 157, 122, 0.95)',
          showLine: false,
        },
        {
          label: 'Verkauf',
          data: result.sellMarkers,
          pointStyle: 'triangle',
          rotation: 180,
          pointRadius: 7,
          borderColor: 'rgba(214, 69, 69, 0.95)',
          backgroundColor: 'rgba(214, 69, 69, 0.95)',
          showLine: false,
        },
      ],
    };

    const options = buildBaseChartOptions(colors, state.currency, {
      y: {
        ticks: {
          callback(value) {
            return formatMoney(Number(value), state.currency);
          },
        },
      },
      tooltipMode: 'index',
      tooltipCallbacks: {
        label(context) {
          if (context.dataset.label === 'Kauf' || context.dataset.label === 'Verkauf') {
            const raw = context.raw || {};
            const reason = raw.reason ? ` · ${raw.reason}` : '';
            return `${context.dataset.label}: ${formatMoney(raw.y, state.currency)}${reason}`;
          }
          return `${context.dataset.label}: ${formatMoney(context.parsed.y, state.currency)}`;
        },
      },
    });

    updateChart('price', el.priceCanvas, data, options);
  }

  function renderEquityChart(result) {
    const colors = getChartColors();
    const labels = result.visibleCandles.map((candle) => formatChartDate(candle.date));

    const data = {
      labels,
      datasets: [
        {
          label: 'Strategie',
          data: result.equitySeries,
          borderColor: colors.accent,
          backgroundColor: 'transparent',
          pointRadius: 0,
          tension: 0.25,
          borderWidth: 2.4,
        },
        {
          label: 'Buy & Hold',
          data: result.buyHoldSeries,
          borderColor: 'rgba(15, 157, 122, 0.85)',
          backgroundColor: 'transparent',
          pointRadius: 0,
          tension: 0.25,
          borderWidth: 1.9,
          borderDash: [6, 4],
        },
      ],
    };

    const options = buildBaseChartOptions(colors, state.currency, {
      y: {
        ticks: {
          callback(value) {
            return formatMoney(Number(value), state.currency);
          },
        },
      },
      tooltipCallbacks: {
        label(context) {
          return `${context.dataset.label}: ${formatMoney(context.parsed.y, state.currency)}`;
        },
      },
    });

    updateChart('equity', el.equityCanvas, data, options);
  }

  function renderDrawdownChart(result) {
    const colors = getChartColors();
    const labels = result.visibleCandles.map((candle) => formatChartDate(candle.date));

    const data = {
      labels,
      datasets: [
        {
          label: 'Drawdown',
          data: result.drawdownSeries,
          borderColor: 'rgba(214, 69, 69, 0.95)',
          backgroundColor: 'rgba(214, 69, 69, 0.16)',
          pointRadius: 0,
          tension: 0.22,
          borderWidth: 2.2,
          fill: true,
        },
      ],
    };

    const options = buildBaseChartOptions(colors, state.currency, {
      y: {
        ticks: {
          callback(value) {
            return `${formatNumber(Number(value) * 100)} %`;
          },
        },
      },
      tooltipCallbacks: {
        label(context) {
          return `${context.dataset.label}: ${formatPercent(context.parsed.y)}`;
        },
      },
    });

    updateChart('drawdown', el.drawdownCanvas, data, options);
  }

  function getChartColors() {
    const styles = getComputedStyle(document.body);
    const border = styles.getPropertyValue('--border').trim() || '#e4eaf2';
    return {
      accent: styles.getPropertyValue('--accent').trim() || '#2962ff',
      fill: styles.getPropertyValue('--accent-soft').trim() || 'rgba(41, 98, 255, 0.12)',
      muted: styles.getPropertyValue('--muted').trim() || '#637085',
      border,
      grid: border,
      tooltipBg: styles.getPropertyValue('--panel').trim() || '#ffffff',
      tooltipBorder: border,
      tooltipTitle: styles.getPropertyValue('--text').trim() || '#172033',
      tooltipBody: styles.getPropertyValue('--text').trim() || '#172033',
    };
  }

  function updateChart(key, canvas, data, options) {
    if (!state.charts[key]) {
      state.charts[key] = new Chart(canvas, {
        type: 'line',
        data,
        options,
      });
      return;
    }

    state.charts[key].data = data;
    state.charts[key].options = options;
    state.charts[key].update();
  }

  function buildBaseChartOptions(colors, currency, overrides = {}) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: overrides.tooltipMode || 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            color: colors.muted,
            usePointStyle: true,
            boxWidth: 10,
            boxHeight: 10,
            padding: 18,
          },
        },
        tooltip: {
          backgroundColor: colors.tooltipBg,
          borderColor: colors.tooltipBorder,
          borderWidth: 1,
          padding: 12,
          titleColor: colors.tooltipTitle,
          bodyColor: colors.tooltipBody,
          displayColors: false,
          callbacks: overrides.tooltipCallbacks || {},
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            color: colors.muted,
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
          },
          border: {
            color: colors.border,
          },
        },
        y: {
          grid: {
            color: colors.grid,
          },
          ticks: {
            color: colors.muted,
          },
          border: {
            color: colors.border,
          },
          ...overrides.y,
        },
      },
    };
  }

  function renderTradeTable(trades) {
    el.tradeBody.innerHTML = '';
    if (!trades.length) {
      const row = document.createElement('tr');
      row.className = 'empty-row';
      const cell = document.createElement('td');
      cell.colSpan = 9;
      cell.textContent = 'Keine Trades in diesem Zeitraum.';
      row.appendChild(cell);
      el.tradeBody.appendChild(row);
      return;
    }

    trades.forEach((trade) => {
      const row = document.createElement('tr');
      const cells = [
        formatDate(trade.entryDate),
        formatMoney(trade.entryPrice, state.currency),
        formatDate(trade.exitDate),
        formatMoney(trade.exitPrice, state.currency),
        formatInteger(trade.barsHeld),
        formatNumber(trade.quantity),
        formatSignedMoney(trade.netPnl, state.currency),
        formatPercent(trade.returnPct),
        `${trade.entryReason} → ${trade.exitReason}`,
      ];

      cells.forEach((value, index) => {
        const cell = document.createElement('td');
        cell.textContent = value;
        if (index === 6) {
          cell.className = trade.netPnl >= 0 ? 'pnl-positive' : 'pnl-negative';
        }
        row.appendChild(cell);
      });
      el.tradeBody.appendChild(row);
    });
  }

  function setLoading(isLoading, message) {
    el.runTopButton.disabled = isLoading;
    el.runStrategyButton.disabled = isLoading;
    el.symbolInput.disabled = isLoading;
    if (message) {
      el.loadStatus.textContent = message;
    }
  }

  function updateDataSource(label, demo) {
    el.dataSource.textContent = label;
    el.dataSource.classList.toggle('demo', demo);
    el.summarySource.textContent = demo ? 'Demo-Daten' : 'Live-Daten';
  }

  function setStatus(message, options = {}) {
    el.loadStatus.textContent = message;
    el.strategyFeedback.textContent = message;
    el.strategyFeedback.className = options.error ? 'feedback error' : 'feedback muted';
  }

  function readParameters(strategy) {
    const params = {};
    (strategy.params || []).forEach((param) => {
      const control = document.getElementById(`param-${param.key}`);
      if (!control) {
        return;
      }
      if (param.type === 'checkbox') {
        params[param.key] = control.checked;
      } else if (param.type === 'select') {
        params[param.key] = control.value;
      } else {
        params[param.key] = parseFlexibleNumber(control.value, param.defaultValue);
      }
    });
    return params;
  }

  function runPresetBacktest(candles, currency, capital, feePct, slippagePct, strategy, params) {
    const signals = strategy.buildSignals(candles, params);
    return runLongOnlyBacktest(candles, currency, capital, feePct, slippagePct, signals, strategy.label, strategy.kindLabel);
  }

  function runCustomBacktest(candles, currency, capital, feePct, slippagePct, text) {
    const compiled = compileCustomStrategy(text || '', candles);
    const signals = {
      buy: compiled.buySignals,
      sell: compiled.sellSignals,
      buyReasons: compiled.buyReasons,
      sellReasons: compiled.sellReasons,
    };
    const result = runLongOnlyBacktest(candles, currency, capital, feePct, slippagePct, signals, 'Custom DSL', 'Custom DSL');
    result.feedback = 'Custom-DSL erfolgreich ausgewertet.';
    result.feedbackType = 'muted';
    result.summaryPoints.unshift(`Regeln: ${compiled.ruleSummary}`);
    return result;
  }

  function runLongOnlyBacktest(candles, currency, capital, feePct, slippagePct, signals, strategyLabel, strategyKind) {
    const buySignals = signals.buy || [];
    const sellSignals = signals.sell || [];
    const buyReasons = signals.buyReasons || [];
    const sellReasons = signals.sellReasons || [];
    const feeRate = Math.max(0, feePct) / 100;
    const slippageRate = Math.max(0, slippagePct) / 100;
    const initialCapital = Math.max(0, capital);
    const firstClose = candles[0].close;
    const lastIndex = candles.length - 1;
    const equitySeries = [];
    const buyHoldSeries = [];
    const drawdownSeries = [];
    const trades = [];
    const buyMarkers = [];
    const sellMarkers = [];
    const dailyReturns = [];
    let cash = initialCapital;
    let shares = 0;
    let entry = null;
    let peak = initialCapital;
    let previousEquity = initialCapital;
    let investedBars = 0;
    let lastSignal = 'Kein finales Signal';

    for (let index = 0; index < candles.length; index += 1) {
      const candle = candles[index];
      const close = candle.close;

      if (shares > 0) {
        investedBars += 1;
      }

      if (shares === 0 && buySignals[index]) {
        const entryPrice = close * (1 + slippageRate);
        const spendableCash = cash * (1 - feeRate);
        const quantity = spendableCash / entryPrice;
        if (quantity > 0) {
          entry = {
            entryDate: candle.date,
            entryPrice,
            entryIndex: index,
            capitalUsed: cash,
            entryReason: buyReasons[index] || `${strategyLabel}: Einstiegssignal`,
          };
          shares = quantity;
          cash = 0;
          buyMarkers.push({ x: formatChartDate(candle.date), y: close, reason: entry.entryReason });
          lastSignal = `BUY am ${formatDate(candle.date)}`;
        }
      } else if (shares > 0 && sellSignals[index]) {
        closeTrade(candle, close * (1 - slippageRate), index, sellReasons[index] || `${strategyLabel}: Ausstiegssignal`);
      }

      if (index === lastIndex && shares > 0) {
        closeTrade(candle, close * (1 - slippageRate), index, 'Ende der Daten');
      }

      const equity = cash + shares * close;
      equitySeries.push(equity);
      buyHoldSeries.push(initialCapital * (close / firstClose));
      peak = Math.max(peak, equity);
      drawdownSeries.push(peak > 0 ? (equity / peak) - 1 : 0);
      if (index > 0) {
        dailyReturns.push(previousEquity > 0 ? (equity / previousEquity) - 1 : 0);
      }
      previousEquity = equity;
    }

    function closeTrade(candle, exitPrice, index, reason) {
      if (!entry) {
        return;
      }
      const exitProceeds = shares * exitPrice * (1 - feeRate);
      const grossPnl = shares * (exitPrice - entry.entryPrice);
      const netPnl = exitProceeds - entry.capitalUsed;
      const returnPct = entry.capitalUsed > 0 ? (netPnl / entry.capitalUsed) * 100 : 0;
      trades.push({
        entryDate: entry.entryDate,
        entryPrice: entry.entryPrice,
        exitDate: candle.date,
        exitPrice,
        barsHeld: Math.max(0, index - entry.entryIndex),
        quantity: shares,
        grossPnl,
        netPnl,
        returnPct,
        entryReason: entry.entryReason,
        exitReason: reason,
      });
      sellMarkers.push({ x: formatChartDate(candle.date), y: candle.close, reason });
      cash = exitProceeds;
      shares = 0;
      entry = null;
      lastSignal = `SELL am ${formatDate(candle.date)}`;
    }

    const finalValue = equitySeries[equitySeries.length - 1] ?? initialCapital;
    const benchmarkFinal = buyHoldSeries[buyHoldSeries.length - 1] ?? initialCapital;
    const benchmarkReturnPct = initialCapital > 0 ? ((benchmarkFinal / initialCapital) - 1) * 100 : 0;
    const strategyReturnPct = initialCapital > 0 ? ((finalValue / initialCapital) - 1) * 100 : 0;
    const outperformancePct = strategyReturnPct - benchmarkReturnPct;
    const maxDrawdownPct = Math.min(...drawdownSeries, 0) * 100;
    const winTrades = trades.filter((trade) => trade.netPnl > 0).length;
    const grossProfit = trades.filter((trade) => trade.netPnl > 0).reduce((sum, trade) => sum + trade.netPnl, 0);
    const grossLoss = trades.filter((trade) => trade.netPnl < 0).reduce((sum, trade) => sum + Math.abs(trade.netPnl), 0);
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : null);
    const winRatePct = trades.length ? (winTrades / trades.length) * 100 : 0;
    const meanReturn = dailyReturns.reduce((sum, value) => sum + value, 0) / Math.max(dailyReturns.length, 1);
    const variance = dailyReturns.reduce((sum, value) => sum + (value - meanReturn) ** 2, 0) / Math.max(dailyReturns.length - 1, 1);
    const volatilityPct = Math.sqrt(Math.max(variance, 0)) * Math.sqrt(252) * 100;
    const sharpeRatio = variance > 0 ? (meanReturn / Math.sqrt(variance)) * Math.sqrt(252) : 0;
    const bestTrade = trades.reduce((best, trade) => (best === null || trade.netPnl > best.netPnl ? trade : best), null);
    const worstTrade = trades.reduce((worst, trade) => (worst === null || trade.netPnl < worst.netPnl ? trade : worst), null);
    const exposurePct = candles.length ? (investedBars / candles.length) * 100 : 0;
    const avgTradePnl = trades.length ? trades.reduce((sum, trade) => sum + trade.netPnl, 0) / trades.length : 0;

    const metrics = {
      finalValue,
      strategyReturnPct,
      benchmarkReturnPct,
      outperformancePct,
      maxDrawdownPct,
      tradeCount: trades.length,
      winRatePct,
      profitFactor,
      sharpeRatio,
      volatilityPct,
      exposurePct,
      avgTradePnl,
      bestTrade,
      worstTrade,
    };

    const summaryPoints = [
      `Performance ${formatPercent(strategyReturnPct)} gegenüber Buy & Hold ${formatPercent(benchmarkReturnPct)}.`,
      `Max Drawdown ${formatPercent(maxDrawdownPct)} bei ${formatInteger(trades.length)} Trades und ${formatNumber(winRatePct)} % Trefferquote.`,
      `Profit-Faktor ${formatRatio(profitFactor)} · Sharpe ${formatRatio(sharpeRatio)} · Exposure ${formatNumber(exposurePct)} %.`,
    ];

    if (bestTrade) {
      summaryPoints.push(`Bester Trade ${formatSignedMoney(bestTrade.netPnl, currency)}; schwächster Trade ${formatSignedMoney(worstTrade.netPnl, currency)}.`);
    }

    return {
      visibleCandles: candles,
      equitySeries,
      buyHoldSeries,
      drawdownSeries,
      trades,
      buyMarkers,
      sellMarkers,
      lastSignal,
      strategyLabel,
      strategyKind,
      metrics,
      summaryPoints,
      tradeSummary: trades.length
        ? `${formatInteger(trades.length)} Trades · ${formatNumber(winRatePct)} % Trefferquote · ${formatNumber(exposurePct)} % Exposure`
        : 'Keine Trades ausgelöst.',
      feedback: `${strategyLabel} erfolgreich berechnet.`,
      feedbackType: 'muted',
      inputs: {
        capital: initialCapital,
        feePct,
        slippagePct,
      },
    };
  }

  function compileCustomStrategy(text, candles) {
    const lines = String(text || '')
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));

    if (!lines.length) {
      throw new Error('Die Custom-DSL ist leer. Füge mindestens eine BUY WHEN- und eine SELL WHEN-Regel ein.');
    }

    const parsed = lines.map(parseRuleLine);
    const buyRule = parsed.find((rule) => rule.action === 'buy');
    const sellRule = parsed.find((rule) => rule.action === 'sell');

    if (!buyRule || !sellRule) {
      throw new Error('Die DSL benötigt genau eine BUY WHEN-Regel und genau eine SELL WHEN-Regel.');
    }

    const buySignals = evaluateRule(buyRule.ast, candles);
    const sellSignals = evaluateRule(sellRule.ast, candles);
    const buyReasons = buySignals.map((signal) => (signal ? buyRule.source : ''));
    const sellReasons = sellSignals.map((signal) => (signal ? sellRule.source : ''));

    return {
      buySignals,
      sellSignals,
      buyReasons,
      sellReasons,
      ruleSummary: `${buyRule.source} / ${sellRule.source}`,
    };
  }

  function parseRuleLine(line) {
    const match = line.match(/^(BUY|SELL)\s+WHEN\s+(.+)$/i);
    if (!match) {
      throw new Error(`Ungültige DSL-Zeile: "${line}". Erwartet wird BUY WHEN oder SELL WHEN.`);
    }

    const action = match[1].toLowerCase();
    const expression = match[2].trim();
    const terms = splitByAnd(expression).map(parseComparison);
    if (!terms.length) {
      throw new Error(`In der Zeile "${line}" wurde keine gültige Bedingung gefunden.`);
    }

    return {
      action,
      source: line,
      ast: { type: 'and', terms },
    };
  }

  function splitByAnd(expression) {
    return expression
      .split(/\s+AND\s+/i)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  function parseComparison(text) {
    const match = text.match(/^(.+?)\s*(crosses_above|crosses_below|>=|<=|>|<)\s*(.+)$/i);
    if (!match) {
      throw new Error(`Ungültiger Ausdruck: "${text}". Erlaubt sind >, <, >=, <=, crosses_above und crosses_below.`);
    }

    return {
      type: 'comparison',
      left: parseOperand(match[1]),
      operator: match[2].toLowerCase(),
      right: parseOperand(match[3]),
    };
  }

  function parseOperand(text) {
    const value = text.trim();
    if (!value) {
      throw new Error('Leerer Operand in der DSL.');
    }

    if (/^\d+(?:\.\d+)?$/.test(value)) {
      return { type: 'number', value: Number(value) };
    }

    if (/^(open|high|low|close|volume)$/i.test(value)) {
      return { type: 'field', name: value.toLowerCase() };
    }

    const fnMatch = value.match(/^([a-z_][a-z0-9_]*)\s*\((.*)\)$/i);
    if (!fnMatch) {
      throw new Error(`Unbekanntes DSL-Token: "${value}".`);
    }

    const fnName = fnMatch[1].toLowerCase();
    const args = splitArguments(fnMatch[2]);

    if (!['sma', 'ema', 'highest', 'lowest', 'rsi'].includes(fnName)) {
      throw new Error(`Funktion "${fnName}" ist in der DSL nicht erlaubt.`);
    }

    if (args.length !== 2) {
      throw new Error(`Funktion "${fnName}" erwartet genau zwei Argumente.`);
    }

    if (!/^(open|high|low|close|volume)$/i.test(args[0])) {
      throw new Error(`Das erste Argument von ${fnName}() muss ein Feld wie close oder high sein.`);
    }

    if (!/^\d+(?:\.\d+)?$/.test(args[1])) {
      throw new Error(`Das zweite Argument von ${fnName}() muss eine Zahl sein.`);
    }

    return {
      type: 'indicator',
      name: fnName,
      field: args[0].toLowerCase(),
      period: Number(args[1]),
    };
  }

  function splitArguments(argumentString) {
    const raw = String(argumentString || '');
    const args = [];
    let depth = 0;
    let current = '';
    for (const char of raw) {
      if (char === '(') {
        depth += 1;
      } else if (char === ')') {
        depth -= 1;
      }
      if (char === ',' && depth === 0) {
        args.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) {
      args.push(current.trim());
    }
    return args;
  }

  function evaluateRule(ast, candles) {
    if (!ast || ast.type !== 'and') {
      throw new Error('DSL-Parserfehler: kein gültiger AST.');
    }

    const termResults = ast.terms.map((term) => evaluateComparison(term, candles));
    return candles.map((_, index) => termResults.every((series) => Boolean(series[index])));
  }

  function evaluateComparison(node, candles) {
    const left = resolveOperand(node.left, candles);
    const right = resolveOperand(node.right, candles);
    const out = Array(candles.length).fill(false);

    for (let index = 0; index < candles.length; index += 1) {
      const l = left[index];
      const r = right[index];
      if (!Number.isFinite(l) || !Number.isFinite(r)) {
        continue;
      }

      if (node.operator === '>') {
        out[index] = l > r;
      } else if (node.operator === '<') {
        out[index] = l < r;
      } else if (node.operator === '>=') {
        out[index] = l >= r;
      } else if (node.operator === '<=') {
        out[index] = l <= r;
      } else if (node.operator === 'crosses_above') {
        if (index > 0) {
          const prevLeft = left[index - 1];
          const prevRight = right[index - 1];
          out[index] = Number.isFinite(prevLeft) && Number.isFinite(prevRight) && prevLeft <= prevRight && l > r;
        }
      } else if (node.operator === 'crosses_below') {
        if (index > 0) {
          const prevLeft = left[index - 1];
          const prevRight = right[index - 1];
          out[index] = Number.isFinite(prevLeft) && Number.isFinite(prevRight) && prevLeft >= prevRight && l < r;
        }
      }
    }

    return out;
  }

  function resolveOperand(node, candles) {
    if (node.type === 'number') {
      return candles.map(() => node.value);
    }

    if (node.type === 'field') {
      return candles.map((candle) => candle[node.name]);
    }

    if (node.type === 'indicator') {
      const source = candles.map((candle) => candle[node.field]);
      if (node.name === 'sma') return sma(source, node.period);
      if (node.name === 'ema') return ema(source, node.period);
      if (node.name === 'highest') return rollingHighest(source, node.period);
      if (node.name === 'lowest') return rollingLowest(source, node.period);
      if (node.name === 'rsi') return rsi(source, node.period);
    }

    throw new Error('DSL-Operand konnte nicht ausgewertet werden.');
  }

  function buildStrategyDefinitions() {
    return {
      buy_hold: {
        label: 'Buy-and-Hold Benchmark',
        kindLabel: 'Benchmark',
        summary: 'Einmal zu Beginn kaufen und bis zum Ende halten. Diese Strategie dient als Referenz für alle anderen Backtests.',
        bullets: [
          'Ein Trade über die gesamte gewählte Periode.',
          'Sehr nützlich als objektive Benchmark.',
          'Ideal zum Vergleichen von Trend- und Mean-Reversion-Ansätzen.',
        ],
        params: [],
        buildSignals(candles) {
          const buy = candles.map(() => false);
          const sell = candles.map(() => false);
          const buyReasons = candles.map(() => '');
          const sellReasons = candles.map(() => '');
          if (candles.length) {
            buy[0] = true;
            buyReasons[0] = 'Kauf zu Periodenbeginn';
            sell[candles.length - 1] = true;
            sellReasons[candles.length - 1] = 'Verkauf am letzten verfügbaren Schlusskurs';
          }
          return { buy, sell, buyReasons, sellReasons };
        },
      },
      ma_crossover: {
        label: 'Moving Average Crossover',
        kindLabel: 'Preset',
        summary: 'Die schnellere Durchschnittslinie soll die langsamere Linie nach oben kreuzen, um eine Long-Position zu eröffnen. Ein gegenteiliger Cross löst den Ausstieg aus.',
        bullets: [
          'Klassische Trendfolgestrategie mit klarer, regelbasierter Logik.',
          'SMA oder EMA als gleitende Durchschnitte auswählbar.',
          'Gute Grundlage für einen TradingView-ähnlichen Strategie-Workflow.',
        ],
        params: [
          { key: 'fastPeriod', label: 'Fast Period', type: 'number', defaultValue: 20, min: 2, step: 1, help: 'Schnelle Linie für das Signal.' },
          { key: 'slowPeriod', label: 'Slow Period', type: 'number', defaultValue: 50, min: 3, step: 1, help: 'Langsame Referenzlinie.' },
          {
            key: 'maType',
            label: 'MA Typ',
            type: 'select',
            defaultValue: 'SMA',
            options: [
              { value: 'SMA', label: 'SMA' },
              { value: 'EMA', label: 'EMA' },
            ],
            help: 'Wähle den Durchschnittstyp.',
          },
        ],
        buildSignals(candles, params) {
          const close = candles.map((candle) => candle.close);
          const fast = params.maType === 'EMA' ? ema(close, params.fastPeriod) : sma(close, params.fastPeriod);
          const slow = params.maType === 'EMA' ? ema(close, params.slowPeriod) : sma(close, params.slowPeriod);
          return buildCrossSignals(candles, fast, slow, `MA Cross ${params.fastPeriod}/${params.slowPeriod} (${params.maType})`, `MA Cross ${params.fastPeriod}/${params.slowPeriod} (${params.maType})`);
        },
      },
      rsi: {
        label: 'RSI',
        kindLabel: 'Preset',
        summary: 'Der RSI misst überkaufte und überverkaufte Phasen. Die Strategie eröffnet Longs bei niedrigen RSI-Werten und schließt sie bei überhitzten Werten.',
        bullets: [
          'Sehr bekannte Oszillator-Strategie für Mean-Reversion-Phasen.',
          'Einfach zu parameterisieren und zu erklären.',
          'In Trendphasen kann der RSI länger extrem bleiben als erwartet.',
        ],
        params: [
          { key: 'period', label: 'RSI Periode', type: 'number', defaultValue: 14, min: 2, step: 1, help: 'Standardwert ist 14.' },
          { key: 'buyBelow', label: 'Buy unter', type: 'number', defaultValue: 30, min: 1, step: 1, help: 'Überverkauftes Niveau.' },
          { key: 'sellAbove', label: 'Sell über', type: 'number', defaultValue: 70, min: 1, step: 1, help: 'Überkauftes Niveau.' },
        ],
        buildSignals(candles, params) {
          const values = candles.map((candle) => candle.close);
          const series = rsi(values, params.period);
          const buy = candles.map(() => false);
          const sell = candles.map(() => false);
          const buyReasons = candles.map(() => '');
          const sellReasons = candles.map(() => '');
          for (let index = 1; index < candles.length; index += 1) {
            if (Number.isFinite(series[index - 1]) && Number.isFinite(series[index])) {
              if (series[index - 1] >= params.buyBelow && series[index] < params.buyBelow) {
                buy[index] = true;
                buyReasons[index] = `RSI ${formatNumber(series[index])} unter ${params.buyBelow}`;
              }
              if (series[index - 1] <= params.sellAbove && series[index] > params.sellAbove) {
                sell[index] = true;
                sellReasons[index] = `RSI ${formatNumber(series[index])} über ${params.sellAbove}`;
              }
            }
          }
          return { buy, sell, buyReasons, sellReasons };
        },
      },
      bollinger: {
        label: 'Bollinger Mean Reversion',
        kindLabel: 'Preset',
        summary: 'Bollinger-Bands kombinieren gleitenden Durchschnitt und Standardabweichung. Die hier implementierte Variante kauft am unteren Band und verkauft wieder am Mittelband.',
        bullets: [
          'Beliebte Mean-Reversion-Logik mit klarer Visibilität im Chart.',
          'Perioden- und Bandbreiten-Parameter sind leicht testbar.',
          'Besonders nützlich in ruhigen, seitwärts laufenden Märkten.',
        ],
        params: [
          { key: 'period', label: 'Band Periode', type: 'number', defaultValue: 20, min: 2, step: 1, help: 'Fenster für Mittelwert und Standardabweichung.' },
          { key: 'stdDev', label: 'StdDev Faktor', type: 'number', defaultValue: 2, min: 0.5, step: 0.1, help: 'Breite der Bänder.' },
          { key: 'exitAtMiddle', label: 'Ausstieg am Mittelband', type: 'checkbox', defaultValue: true, help: 'Falls deaktiviert, wird erst am oberen Band verkauft.' },
        ],
        buildSignals(candles, params) {
          const close = candles.map((candle) => candle.close);
          const middle = sma(close, params.period);
          const deviation = rollingStdDev(close, params.period);
          const lower = middle.map((value, index) => (Number.isFinite(value) && Number.isFinite(deviation[index]) ? value - (deviation[index] * params.stdDev) : null));
          const upper = middle.map((value, index) => (Number.isFinite(value) && Number.isFinite(deviation[index]) ? value + (deviation[index] * params.stdDev) : null));
          const buy = candles.map(() => false);
          const sell = candles.map(() => false);
          const buyReasons = candles.map(() => '');
          const sellReasons = candles.map(() => '');
          for (let index = 1; index < candles.length; index += 1) {
            if (Number.isFinite(lower[index - 1]) && Number.isFinite(lower[index]) && close[index - 1] >= lower[index - 1] && close[index] < lower[index]) {
              buy[index] = true;
              buyReasons[index] = `Close ${formatNumber(close[index])} unter unterem Band`;
            }
            const exitLine = params.exitAtMiddle ? middle : upper;
            if (Number.isFinite(exitLine[index - 1]) && Number.isFinite(exitLine[index]) && close[index - 1] <= exitLine[index - 1] && close[index] > exitLine[index]) {
              sell[index] = true;
              sellReasons[index] = params.exitAtMiddle ? 'Ausstieg am Mittelband' : 'Ausstieg am oberen Band';
            }
          }
          return { buy, sell, buyReasons, sellReasons };
        },
      },
      breakout: {
        label: 'Breakout',
        kindLabel: 'Preset',
        summary: 'Die Strategie steigt ein, wenn der Kurs über das jüngste Hoch ausbricht, und steigt aus, wenn die Unterstützung durchbrochen wird.',
        bullets: [
          'Eignet sich gut zum Erkennen starker Trendphasen.',
          'Fehlausbrüche sind die größte Schwäche.',
          'Lookback-Perioden für Einstieg und Ausstieg sind getrennt konfigurierbar.',
        ],
        params: [
          { key: 'lookback', label: 'Breakout Lookback', type: 'number', defaultValue: 20, min: 2, step: 1, help: 'Hoch/Tief der letzten N Tage.' },
          { key: 'exitLookback', label: 'Exit Lookback', type: 'number', defaultValue: 10, min: 2, step: 1, help: 'Ausstieg bei Durchbruch des Tiefs.' },
        ],
        buildSignals(candles, params) {
          const buy = candles.map(() => false);
          const sell = candles.map(() => false);
          const buyReasons = candles.map(() => '');
          const sellReasons = candles.map(() => '');
          for (let index = 1; index < candles.length; index += 1) {
            const breakoutHigh = rollingExtremeBefore(candles, index, params.lookback, 'high', 'max');
            const exitLow = rollingExtremeBefore(candles, index, params.exitLookback, 'low', 'min');
            if (Number.isFinite(breakoutHigh) && candles[index - 1].close <= breakoutHigh && candles[index].close > breakoutHigh) {
              buy[index] = true;
              buyReasons[index] = `Ausbruch über ${formatNumber(breakoutHigh)}`;
            }
            if (Number.isFinite(exitLow) && candles[index - 1].close >= exitLow && candles[index].close < exitLow) {
              sell[index] = true;
              sellReasons[index] = `Bruch unter ${formatNumber(exitLow)}`;
            }
          }
          return { buy, sell, buyReasons, sellReasons };
        },
      },
      macd: {
        label: 'MACD Crossover',
        kindLabel: 'Preset',
        summary: 'Der MACD vergleicht kurze und lange EMAs. Ein Cross der MACD-Linie über die Signallinie erzeugt ein Kaufsignal, der Gegen-Cross ein Verkaufssignal.',
        bullets: [
          'Klassischer Trend-/Momentum-Indikator aus dem Charting-Standardrepertoire.',
          'Gut, um Trendwechsel und Momentum zu veranschaulichen.',
          'Einfach mit Tagesdaten zu berechnen.',
        ],
        params: [
          { key: 'fastPeriod', label: 'Fast EMA', type: 'number', defaultValue: 12, min: 2, step: 1, help: 'Schnelle EMA.' },
          { key: 'slowPeriod', label: 'Slow EMA', type: 'number', defaultValue: 26, min: 3, step: 1, help: 'Langsame EMA.' },
          { key: 'signalPeriod', label: 'Signal EMA', type: 'number', defaultValue: 9, min: 2, step: 1, help: 'Signallinie.' },
        ],
        buildSignals(candles, params) {
          const close = candles.map((candle) => candle.close);
          const macdLines = macd(close, params.fastPeriod, params.slowPeriod, params.signalPeriod);
          return buildCrossSignals(candles, macdLines.macd, macdLines.signal, `MACD ${params.fastPeriod}/${params.slowPeriod}/${params.signalPeriod}`, `MACD ${params.fastPeriod}/${params.slowPeriod}/${params.signalPeriod}`);
        },
      },
      custom: {
        label: 'Custom DSL',
        kindLabel: 'Custom DSL',
        summary: 'Eigene Regeln werden in einer kleinen, sicheren DSL eingegeben. Unterstützt sind BUY WHEN / SELL WHEN, Vergleichsoperatoren und einfache Indikatorfunktionen.',
        bullets: [
          'Kein eval, keine Script-Injection.',
          'Nur eine Whitelist aus Feldern und Indikatoren ist erlaubt.',
          'Ideal für experimentelle Regeln, die trotzdem sicher bleiben sollen.',
        ],
        params: [],
      },
    };
  }

  function buildCrossSignals(candles, fast, slow, buyReason, sellReason) {
    const buy = candles.map(() => false);
    const sell = candles.map(() => false);
    const buyReasons = candles.map(() => '');
    const sellReasons = candles.map(() => '');
    for (let index = 1; index < candles.length; index += 1) {
      if (Number.isFinite(fast[index - 1]) && Number.isFinite(slow[index - 1]) && Number.isFinite(fast[index]) && Number.isFinite(slow[index])) {
        if (fast[index - 1] <= slow[index - 1] && fast[index] > slow[index]) {
          buy[index] = true;
          buyReasons[index] = `${buyReason}: Cross über`;
        }
        if (fast[index - 1] >= slow[index - 1] && fast[index] < slow[index]) {
          sell[index] = true;
          sellReasons[index] = `${sellReason}: Cross unter`;
        }
      }
    }
    return { buy, sell, buyReasons, sellReasons };
  }

  function rollingExtremeBefore(candles, index, lookback, field, mode) {
    const start = Math.max(0, index - lookback);
    let result = mode === 'max' ? -Infinity : Infinity;
    for (let cursor = start; cursor < index; cursor += 1) {
      const value = candles[cursor][field];
      if (!Number.isFinite(value)) {
        continue;
      }
      if (mode === 'max') {
        result = Math.max(result, value);
      } else {
        result = Math.min(result, value);
      }
    }
    return Number.isFinite(result) ? result : null;
  }

  function sma(values, period) {
    const out = Array(values.length).fill(null);
    if (!Number.isFinite(period) || period < 1) {
      return out;
    }
    let sum = 0;
    for (let index = 0; index < values.length; index += 1) {
      const value = values[index];
      if (Number.isFinite(value)) {
        sum += value;
      }
      if (index >= period) {
        const old = values[index - period];
        if (Number.isFinite(old)) {
          sum -= old;
        }
      }
      if (index >= period - 1) {
        out[index] = sum / period;
      }
    }
    return out;
  }

  function ema(values, period) {
    const out = Array(values.length).fill(null);
    if (!Number.isFinite(period) || period < 1) {
      return out;
    }
    const multiplier = 2 / (period + 1);
    let seedSum = 0;
    let seedCount = 0;
    let previous = null;
    for (let index = 0; index < values.length; index += 1) {
      const value = values[index];
      if (!Number.isFinite(value)) {
        continue;
      }
      if (seedCount < period) {
        seedSum += value;
        seedCount += 1;
        if (seedCount === period) {
          previous = seedSum / period;
          out[index] = previous;
        }
        continue;
      }
      previous = ((value - previous) * multiplier) + previous;
      out[index] = previous;
    }
    return out;
  }

  function rollingStdDev(values, period) {
    const out = Array(values.length).fill(null);
    if (!Number.isFinite(period) || period < 2) {
      return out;
    }
    for (let index = period - 1; index < values.length; index += 1) {
      const slice = values.slice(index - period + 1, index + 1).filter((value) => Number.isFinite(value));
      if (slice.length !== period) {
        continue;
      }
      const mean = slice.reduce((sum, value) => sum + value, 0) / period;
      const variance = slice.reduce((sum, value) => sum + (value - mean) ** 2, 0) / period;
      out[index] = Math.sqrt(Math.max(variance, 0));
    }
    return out;
  }

  function rollingHighest(values, period) {
    const out = Array(values.length).fill(null);
    if (!Number.isFinite(period) || period < 1) {
      return out;
    }
    for (let index = period - 1; index < values.length; index += 1) {
      const slice = values.slice(index - period + 1, index + 1).filter((value) => Number.isFinite(value));
      if (slice.length === period) {
        out[index] = Math.max(...slice);
      }
    }
    return out;
  }

  function rollingLowest(values, period) {
    const out = Array(values.length).fill(null);
    if (!Number.isFinite(period) || period < 1) {
      return out;
    }
    for (let index = period - 1; index < values.length; index += 1) {
      const slice = values.slice(index - period + 1, index + 1).filter((value) => Number.isFinite(value));
      if (slice.length === period) {
        out[index] = Math.min(...slice);
      }
    }
    return out;
  }

  function rsi(values, period) {
    const out = Array(values.length).fill(null);
    if (!Number.isFinite(period) || period < 1) {
      return out;
    }
    let gain = 0;
    let loss = 0;
    for (let index = 1; index <= period && index < values.length; index += 1) {
      const change = values[index] - values[index - 1];
      if (change >= 0) {
        gain += change;
      } else {
        loss += Math.abs(change);
      }
    }
    let avgGain = gain / period;
    let avgLoss = loss / period;
    if (period < values.length) {
      out[period] = calculateRSI(avgGain, avgLoss);
    }
    for (let index = period + 1; index < values.length; index += 1) {
      const change = values[index] - values[index - 1];
      const currentGain = Math.max(change, 0);
      const currentLoss = Math.max(-change, 0);
      avgGain = ((avgGain * (period - 1)) + currentGain) / period;
      avgLoss = ((avgLoss * (period - 1)) + currentLoss) / period;
      out[index] = calculateRSI(avgGain, avgLoss);
    }
    return out;
  }

  function calculateRSI(avgGain, avgLoss) {
    if (avgLoss === 0) {
      return avgGain === 0 ? 50 : 100;
    }
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  function macd(values, fastPeriod, slowPeriod, signalPeriod) {
    const fast = ema(values, fastPeriod);
    const slow = ema(values, slowPeriod);
    const line = values.map((_, index) => {
      if (!Number.isFinite(fast[index]) || !Number.isFinite(slow[index])) {
        return null;
      }
      return fast[index] - slow[index];
    });
    const signal = ema(line.map((value) => (Number.isFinite(value) ? value : 0)), signalPeriod);
    const histogram = line.map((value, index) => (Number.isFinite(value) && Number.isFinite(signal[index]) ? value - signal[index] : null));
    return { macd: line, signal, histogram };
  }

  function sliceByRange(candles, range) {
    if (range === 'max') {
      return candles.slice();
    }
    const cutoff = new Date(candles[candles.length - 1].date);
    cutoff.setDate(cutoff.getDate() - (rangeDays[range] || rangeDays['1y']));
    return candles.filter((candle) => candle.date >= cutoff);
  }

  function normalizeSymbol(value) {
    return String(value || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9.^-]/g, '')
      .slice(0, 12);
  }

  async function fetchYahooSeries(symbol) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5y&includePrePost=false&events=div,splits`;
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      mode: 'cors',
    });

    if (!response.ok) {
      throw new Error(`Yahoo API antwortete mit ${response.status}`);
    }

    const payload = await response.json();
    const result = payload?.chart?.result?.[0];
    const timestamps = result?.timestamp || [];
    const quote = result?.indicators?.quote?.[0] || {};
    const currency = result?.meta?.currency || 'USD';

    const candles = timestamps
      .map((timestamp, index) => ({
        date: new Date(timestamp * 1000),
        open: quote.open?.[index],
        high: quote.high?.[index],
        low: quote.low?.[index],
        close: quote.close?.[index],
        volume: quote.volume?.[index],
      }))
      .filter((candle) => [candle.open, candle.high, candle.low, candle.close].every((value) => Number.isFinite(value)));

    if (candles.length < 20) {
      throw new Error('Zu wenige Datenpunkte aus der API.');
    }

    return { candles, currency };
  }

  function buildDemoSeries(symbol, points) {
    const seed = Array.from(symbol).reduce((total, char) => total + char.charCodeAt(0), 0) || 1;
    const rand = seededRandom(seed);
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 5);
    const candles = [];
    let close = 80 + (seed % 180);

    for (let offset = 0; candles.length < points; offset += 1) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + offset);
      if (isWeekend(date)) {
        continue;
      }
      const drift = 0.00028;
      const shock = (rand() - 0.5) * 0.03;
      const open = close;
      close = Math.max(10, close * (1 + drift + shock));
      const intraday = Math.abs((rand() - 0.5) * 0.03);
      const high = Math.max(open, close) * (1 + intraday);
      const low = Math.max(1, Math.min(open, close) * (1 - intraday));
      const volume = Math.round(800000 + rand() * 1800000);
      candles.push({
        date,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume,
      });
    }

    return { candles, currency: 'USD' };
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

  function updateSummaryBasics() {
    const strategyId = el.strategySelect.value || 'ma_crossover';
    const strategy = strategyDefinitions[strategyId] || strategyDefinitions.ma_crossover;
    el.summaryStrategy.textContent = strategy.label;
    el.summarySource.textContent = state.source === 'demo' ? 'Demo-Daten' : 'Live-Daten';
    el.marketSymbolBadge.textContent = `${state.symbol} · ${state.currency}`;
    renderRangeLabel();
  }

  function formatChartDate(date) {
    return formatters.shortDate.format(date);
  }

  function formatDate(date) {
    return formatters.date.format(date);
  }

  function formatMoney(value, currency) {
    if (!Number.isFinite(value)) {
      return '—';
    }
    return `${formatters.number.format(value)} ${currency}`;
  }

  function formatSignedMoney(value, currency) {
    if (!Number.isFinite(value)) {
      return '—';
    }
    const sign = value > 0 ? '+' : '';
    return `${sign}${formatters.number.format(value)} ${currency}`;
  }

  function formatNumber(value) {
    if (!Number.isFinite(value)) {
      return '—';
    }
    return formatters.number.format(value);
  }

  function formatInteger(value) {
    if (!Number.isFinite(value)) {
      return '—';
    }
    return formatters.integer.format(value);
  }

  function formatPercent(value) {
    if (!Number.isFinite(value)) {
      return '—';
    }
    return `${formatters.percent.format(value)} %`;
  }

  function formatRatio(value) {
    if (value === null || value === undefined) {
      return '—';
    }
    if (!Number.isFinite(value)) {
      return '∞';
    }
    return formatters.number3.format(value);
  }

  function parseFlexibleNumber(value, fallback) {
    const numeric = Number(String(value).replace(',', '.'));
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
}
