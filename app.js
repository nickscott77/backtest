/* global Chart */

const THEME_KEY = 'backtest-theme';
const RANGE_LABELS = { '1m': '1 Monat', '3m': '3 Monate', '6m': '6 Monate', '1y': '1 Jahr', '3y': '3 Jahre', '5y': '5 Jahre', max: 'Max' };
const RANGE_DAYS = { '1m': 30, '3m': 90, '6m': 180, '1y': 365, '3y': 1095, '5y': 1825, max: Infinity };
const TEMPLATES = {
  cross: "BUY WHEN sma(close, 20) crosses_above sma(close, 50)\nSELL WHEN sma(close, 20) crosses_below sma(close, 50)",
  rsi: "BUY WHEN rsi(close, 14) < 30\nSELL WHEN rsi(close, 14) > 70",
  breakout: "BUY WHEN close > highest(high, 20)\nSELL WHEN close < sma(close, 20)",
};
const STRATEGIES = {
  'buy-hold': { label: 'Buy & Hold Benchmark', params: [] },
  'ma-crossover': { label: 'Moving Average Crossover', params: [
    { key: 'fastPeriod', label: 'Fast Period', type: 'number', value: 20, min: 2, max: 200, step: 1 },
    { key: 'slowPeriod', label: 'Slow Period', type: 'number', value: 50, min: 5, max: 400, step: 1 },
    { key: 'maType', label: 'MA Typ', type: 'select', value: 'sma', options: ['sma', 'ema'] },
  ] },
  rsi: { label: 'RSI', params: [
    { key: 'period', label: 'Periode', type: 'number', value: 14, min: 2, max: 100, step: 1 },
    { key: 'buyBelow', label: 'Kaufen unter', type: 'number', value: 30, min: 1, max: 50, step: 1 },
    { key: 'sellAbove', label: 'Verkaufen über', type: 'number', value: 70, min: 50, max: 99, step: 1 },
  ] },
  bollinger: { label: 'Bollinger Mean Reversion', params: [
    { key: 'period', label: 'Periode', type: 'number', value: 20, min: 5, max: 100, step: 1 },
    { key: 'stdDev', label: 'Std.-Abw.', type: 'number', value: 2, min: 1, max: 4, step: 0.1 },
    { key: 'exitAtMiddle', label: 'Exit am Mittelband', type: 'checkbox', value: true },
  ] },
  breakout: { label: 'Breakout', params: [
    { key: 'lookback', label: 'Lookback', type: 'number', value: 20, min: 5, max: 200, step: 1 },
    { key: 'exitLookback', label: 'Exit-Lookback', type: 'number', value: 10, min: 3, max: 120, step: 1 },
  ] },
  macd: { label: 'MACD', params: [
    { key: 'fast', label: 'Fast EMA', type: 'number', value: 12, min: 2, max: 50, step: 1 },
    { key: 'slow', label: 'Slow EMA', type: 'number', value: 26, min: 5, max: 100, step: 1 },
    { key: 'signal', label: 'Signal EMA', type: 'number', value: 9, min: 2, max: 50, step: 1 },
  ] },
  momentum: { label: 'Momentum', params: [
    { key: 'lookback', label: 'Lookback', type: 'number', value: 63, min: 5, max: 252, step: 1 },
    { key: 'threshold', label: 'Schwelle %', type: 'number', value: 8, min: 0, max: 100, step: 0.1 },
  ] },
  atr: { label: 'ATR Trend', params: [
    { key: 'atrPeriod', label: 'ATR Periode', type: 'number', value: 14, min: 5, max: 100, step: 1 },
    { key: 'atrMultiplier', label: 'ATR Multiplikator', type: 'number', value: 3, min: 0.5, max: 10, step: 0.1 },
    { key: 'trendPeriod', label: 'Trend SMA', type: 'number', value: 50, min: 5, max: 200, step: 1 },
  ] },
  custom: { label: 'Custom DSL', params: [] },
};

const fmt = {
  num: new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  pct: new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' }),
  int: new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }),
  date: new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }),
};

const ui = {
  symbolInput: document.getElementById('symbol-input'),
  loadButton: document.getElementById('run-backtest'),
  runStrategyButton: document.getElementById('run-strategy'),
  loadDemoButton: document.getElementById('load-demo'),
  rangeButtons: Array.from(document.querySelectorAll('.range-btn')),
  strategySelect: document.getElementById('strategy-select'),
  paramFields: document.getElementById('param-fields'),
  initialCapital: document.getElementById('initial-capital'),
  feePct: document.getElementById('fee-pct'),
  slippagePct: document.getElementById('slippage-pct'),
  customInput: document.getElementById('custom-strategy-input'),
  dslError: document.getElementById('dsl-error'),
  themeToggle: document.getElementById('theme-toggle'),
  dataSource: document.getElementById('data-source'),
  loadStatus: document.getElementById('load-status'),
  summarySource: document.getElementById('summary-source'),
  summaryStrategy: document.getElementById('summary-strategy'),
  summaryUpdated: document.getElementById('summary-updated'),
  symbolReadout: document.getElementById('symbol-readout'),
  marketTitle: document.getElementById('market-title'),
  lastClose: document.getElementById('last-close'),
  lastChange: document.getElementById('last-change'),
  rangeReadout: document.getElementById('range-readout'),
  metricEndValue: document.getElementById('metric-end-value'),
  metricPerformance: document.getElementById('metric-performance'),
  metricBuyHold: document.getElementById('metric-buyhold'),
  metricOutperformance: document.getElementById('metric-outperformance'),
  metricDrawdown: document.getElementById('metric-drawdown'),
  metricTrades: document.getElementById('metric-trades'),
  metricWinrate: document.getElementById('metric-winrate'),
  metricProfitFactor: document.getElementById('metric-profitfactor'),
  metricSharpe: document.getElementById('metric-sharpe'),
  metricVolatility: document.getElementById('metric-volatility'),
  tradeTableBody: document.getElementById('trade-table-body'),
  priceChart: document.getElementById('price-chart'),
  equityChart: document.getElementById('equity-chart'),
  drawdownChart: document.getElementById('drawdown-chart'),
};

const state = {
  symbol: normalizeSymbol(ui.symbolInput?.value || 'AAPL'),
  range: '6m',
  source: 'live',
  activeStrategy: normalizeStrategyKey(ui.strategySelect?.value || 'ma_crossover'),
  candles: [],
  charts: { price: null, equity: null, drawdown: null },
  lastResult: null,
};

initTheme();
attachQuickLinks();
if (ui.priceChart && ui.equityChart && ui.drawdownChart && typeof Chart !== 'undefined') {
  boot().catch((err) => { console.error(err); useDemoData(state.symbol, 'Demo-Daten geladen.'); });
}

function normalizeStrategyKey(value) {
  return String(value || '').trim().toLowerCase().replace(/_/g, '-');
}

function boot() {
  bindEvents();
  renderStrategyParams();
  updateRangeButtons();
  return loadSymbol(state.symbol);
}

function bindEvents() {
  ui.loadButton?.addEventListener('click', () => void loadSymbol(ui.symbolInput?.value || state.symbol));
  ui.runStrategyButton?.addEventListener('click', () => rerunBacktest());
  ui.loadDemoButton?.addEventListener('click', () => useDemoData(normalizeSymbol(ui.symbolInput?.value || state.symbol) || state.symbol, 'Demo-Daten geladen.'));
  ui.symbolInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); void loadSymbol(ui.symbolInput.value); } });
  ui.rangeButtons.forEach((btn) => btn.addEventListener('click', () => { state.range = btn.dataset.range || '6m'; updateRangeButtons(); rerunBacktest(); }));
  ui.strategySelect?.addEventListener('change', () => { state.activeStrategy = normalizeStrategyKey(ui.strategySelect.value); renderStrategyParams(); rerunBacktest(); });
  [ui.initialCapital, ui.feePct, ui.slippagePct, ui.customInput].forEach((el) => el?.addEventListener('input', () => { if (state.lastResult) rerunBacktest(true); }));
  ui.paramFields?.addEventListener('input', () => { if (state.lastResult) rerunBacktest(true); });
  document.addEventListener('backtest-theme-change', () => { if (state.lastResult) renderCharts(state.lastResult); });
}

function attachQuickLinks() {
  document.querySelectorAll('[data-symbol]').forEach((btn) => btn.addEventListener('click', () => { const s = btn.dataset.symbol || ''; if (ui.symbolInput) ui.symbolInput.value = s; void loadSymbol(s); }));
  document.querySelectorAll('[data-template]').forEach((btn) => btn.addEventListener('click', () => { const template = btn.dataset.template || 'cross'; if (ui.customInput) ui.customInput.value = TEMPLATES[template] || TEMPLATES.cross; if (ui.strategySelect) ui.strategySelect.value = 'custom'; state.activeStrategy = 'custom'; renderStrategyParams(); rerunBacktest(); }));
}

function initTheme() {
  const saved = safeGet(THEME_KEY);
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));
  ui.themeToggle?.addEventListener('click', () => {
    const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    safeSet(THEME_KEY, next);
    document.dispatchEvent(new Event('backtest-theme-change'));
  });
}

function applyTheme(theme) {
  document.body.dataset.theme = theme === 'dark' ? 'dark' : 'light';
  if (ui.themeToggle) {
    const dark = document.body.dataset.theme === 'dark';
    ui.themeToggle.textContent = dark ? 'Light Mode' : 'Dark Mode';
    ui.themeToggle.setAttribute('aria-label', dark ? 'Light Mode aktivieren' : 'Dark Mode aktivieren');
    ui.themeToggle.setAttribute('aria-pressed', dark ? 'true' : 'false');
  }
}

function renderStrategyParams() {
  if (!ui.paramFields || !ui.strategySelect) return;
  ui.paramFields.innerHTML = '';
  const key = normalizeStrategyKey(ui.strategySelect.value);
  const def = STRATEGIES[key] || STRATEGIES['ma-crossover'];
  if (ui.summaryStrategy) ui.summaryStrategy.textContent = def.label;
  if (!def.params.length) {
    const p = document.createElement('p');
    p.className = 'form-message';
    p.textContent = key === 'custom' ? 'Custom-DSL: BUY WHEN / SELL WHEN und whitelisted Funktionen.' : 'Keine zusätzlichen Parameter.';
    ui.paramFields.appendChild(p);
    return;
  }
  for (const param of def.params) {
    const wrap = document.createElement('div');
    wrap.className = param.type === 'checkbox' ? 'param full' : 'param';
    const label = document.createElement('label');
    label.textContent = param.label;
    label.setAttribute('for', `param-${param.key}`);
    wrap.appendChild(label);
    let input;
    if (param.type === 'select') {
      input = document.createElement('select');
      input.id = `param-${param.key}`;
      input.dataset.param = param.key;
      for (const optionValue of param.options) {
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = optionValue.toUpperCase();
        if (optionValue === param.value) option.selected = true;
        input.appendChild(option);
      }
    } else if (param.type === 'checkbox') {
      input = document.createElement('input');
      input.id = `param-${param.key}`;
      input.dataset.param = param.key;
      input.type = 'checkbox';
      input.checked = Boolean(param.value);
    } else {
      input = document.createElement('input');
      input.id = `param-${param.key}`;
      input.dataset.param = param.key;
      input.type = 'number';
      input.value = String(param.value);
      if (param.min !== undefined) input.min = String(param.min);
      if (param.max !== undefined) input.max = String(param.max);
      if (param.step !== undefined) input.step = String(param.step);
    }
    wrap.appendChild(input);
    ui.paramFields.appendChild(wrap);
  }
}

function readParams() {
  const key = normalizeStrategyKey(ui.strategySelect?.value || state.activeStrategy);
  const def = STRATEGIES[key] || STRATEGIES['ma-crossover'];
  const params = {};
  def.params.forEach((param) => {
    const el = ui.paramFields?.querySelector(`[data-param="${param.key}"]`);
    if (!el) return;
    params[param.key] = param.type === 'checkbox' ? Boolean(el.checked) : param.type === 'select' ? String(el.value) : parseNum(el.value, param.value);
  });
  return params;
}

function updateRangeButtons() {
  ui.rangeButtons.forEach((btn) => { const active = btn.dataset.range === state.range; btn.classList.toggle('active', active); btn.setAttribute('aria-pressed', active ? 'true' : 'false'); });
  if (ui.rangeReadout) ui.rangeReadout.textContent = RANGE_LABELS[state.range] || '6 Monate';
}

async function loadSymbol(raw) {
  const symbol = normalizeSymbol(raw);
  if (!symbol) { setStatus('Bitte ein gültiges Symbol eingeben.'); return; }
  state.symbol = symbol;
  if (ui.symbolInput && ui.symbolInput.value !== symbol) ui.symbolInput.value = symbol;
  clearDslMessage();
  setLoading(true, `Lade ${symbol} …`);
  try {
    state.candles = await fetchYahooSeries(symbol);
    state.source = 'live';
    setSource('Live-Daten', false);
    setStatus(`${symbol} geladen.`);
    rerunBacktest();
  } catch (err) {
    console.warn('Live-Daten fehlgeschlagen, verwende Demo.', err);
    useDemoData(symbol, 'Live-Daten nicht verfügbar; Demo-Daten geladen.');
  } finally {
    setLoading(false);
  }
}

function useDemoData(symbol, message) {
  state.symbol = symbol;
  state.source = 'demo';
  state.candles = buildDemoSeries(symbol, 5 * 252);
  if (ui.symbolInput) ui.symbolInput.value = symbol;
  setSource('Demo-Daten', true);
  setStatus(message);
  rerunBacktest();
}

function setLoading(isLoading, message) {
  [ui.loadButton, ui.runStrategyButton, ui.symbolInput].forEach((el) => { if (el) el.disabled = isLoading; });
  if (message) setStatus(message);
}
function setStatus(text) { if (ui.loadStatus) ui.loadStatus.textContent = text; }
function setSource(text, demo) { if (ui.dataSource) { ui.dataSource.textContent = text; ui.dataSource.classList.toggle('demo', demo); } if (ui.summarySource) ui.summarySource.textContent = text; }
function clearDslMessage() { if (ui.dslError) { ui.dslError.textContent = ''; ui.dslError.classList.remove('error', 'success'); } }
function showDslMessage(text, kind = 'error') { if (!ui.dslError) return; ui.dslError.textContent = text; ui.dslError.classList.toggle('error', kind === 'error'); ui.dslError.classList.toggle('success', kind === 'success'); }
function setLoading(isLoading, message) { [ui.loadButton, ui.runStrategyButton, ui.symbolInput].forEach((el) => { if (el) el.disabled = isLoading; }); if (message) setStatus(message); }
function rerunBacktest(keepStatus = false) {
  if (!state.candles.length) return;
  try {
    const visible = sliceByRange(state.candles, state.range);
    const result = runBacktest(visible);
    state.lastResult = result;
    renderMarketStrip(visible);
    renderMetrics(result.metrics);
    renderTrades(result.trades);
    renderCharts(result);
    if (!keepStatus) setStatus(`${state.symbol} · ${visible.length} Kerzen · ${STRATEGIES[normalizeStrategyKey(ui.strategySelect?.value || state.activeStrategy)]?.label || 'Strategie'} berechnet.`);
    if (ui.summaryUpdated) ui.summaryUpdated.textContent = getNowString();
    clearDslMessage();
  } catch (err) {
    console.error(err);
    showDslMessage(err.message || 'Backtest konnte nicht ausgeführt werden.');
    setStatus('Backtest-Fehler.');
  }
}
function renderMarketStrip(candles) {
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2] || last;
  const change = last.close - prev.close;
  const changePct = prev.close ? (change / prev.close) * 100 : 0;
  if (ui.symbolReadout) ui.symbolReadout.textContent = state.symbol;
  if (ui.marketTitle) ui.marketTitle.textContent = `${state.symbol} · Backtest-Übersicht`;
  if (ui.lastClose) ui.lastClose.textContent = formatNumber(last.close);
  if (ui.lastChange) { ui.lastChange.textContent = `${change >= 0 ? '+' : ''}${formatNumber(change)} (${change >= 0 ? '+' : ''}${formatPercent(changePct)})`; ui.lastChange.className = change >= 0 ? 'pos' : 'neg'; }
}
function renderMetrics(m) {
  if (ui.metricEndValue) ui.metricEndValue.textContent = formatNumber(m.finalValue);
  if (ui.metricPerformance) ui.metricPerformance.textContent = formatSignedPercent(m.performancePct);
  if (ui.metricBuyHold) ui.metricBuyHold.textContent = formatSignedPercent(m.buyHoldPct);
  if (ui.metricOutperformance) ui.metricOutperformance.textContent = formatSignedPercent(m.outperformancePct);
  if (ui.metricDrawdown) ui.metricDrawdown.textContent = formatSignedPercent(m.maxDrawdownPct);
  if (ui.metricTrades) ui.metricTrades.textContent = fmt.int.format(m.tradeCount);
  if (ui.metricWinrate) ui.metricWinrate.textContent = formatPercent(m.winRatePct);
  if (ui.metricProfitFactor) ui.metricProfitFactor.textContent = formatRatio(m.profitFactor);
  if (ui.metricSharpe) ui.metricSharpe.textContent = m.sharpe === null ? '—' : fmt.num.format(m.sharpe);
  if (ui.metricVolatility) ui.metricVolatility.textContent = formatPercent(m.volatilityPct);
}
function renderTrades(trades) {
  if (!ui.tradeTableBody) return;
  ui.tradeTableBody.innerHTML = '';
  if (!trades.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 9;
    cell.className = 'empty-state';
    cell.textContent = 'Keine abgeschlossenen Trades im gewählten Zeitraum.';
    row.appendChild(cell);
    ui.tradeTableBody.appendChild(row);
    return;
  }
  for (const trade of trades) {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${formatDate(trade.entryDate)}</td><td>${formatNumber(trade.entryPrice)}</td><td>${formatDate(trade.exitDate)}</td><td>${formatNumber(trade.exitPrice)}</td><td>${fmt.int.format(trade.barsHeld)}</td><td>${fmt.num.format(trade.quantity)}</td><td class="${trade.netPnl >= 0 ? 'pos' : 'neg'}">${formatSignedNumber(trade.netPnl)}</td><td class="${trade.returnPct >= 0 ? 'pos' : 'neg'}">${formatSignedPercent(trade.returnPct)}</td><td>${escapeHtml(trade.exitReason)}</td>`;
    ui.tradeTableBody.appendChild(row);
  }
}
function renderCharts(result) {
  const candles = sliceByRange(state.candles, state.range);
  const labels = candles.map((c) => formatDate(c.date));
  const colors = getChartColors();
  const priceDatasets = [{ label: `${state.symbol} Close`, data: candles.map((c) => c.close), borderColor: colors.accent, backgroundColor: colors.fill, pointRadius: 0, borderWidth: 2.2, tension: 0.28, fill: true }];
  addOverlay(priceDatasets, result.overlays.fast, 'Fast', '#7aa2ff');
  addOverlay(priceDatasets, result.overlays.slow, 'Slow', '#f59e0b');
  addOverlay(priceDatasets, result.overlays.middle, 'Middle', '#9ca3af');
  addOverlay(priceDatasets, result.overlays.upper, 'Upper', '#60a5fa');
  addOverlay(priceDatasets, result.overlays.lower, 'Lower', '#f97316');
  addOverlay(priceDatasets, result.overlays.signal, 'Signal', '#8b5cf6');
  addOverlay(priceDatasets, result.overlays.trend, 'Trend', '#14b8a6');
  priceDatasets.push(markerDataset('Buy', result.markers.buy, '#16a34a'));
  priceDatasets.push(markerDataset('Sell', result.markers.sell, '#ef4444'));
  const equityData = { labels, datasets: [
    { label: 'Strategie', data: result.equitySeries.map((p) => p.value), borderColor: '#2f6bff', backgroundColor: 'rgba(47, 107, 255, 0.12)', pointRadius: 0, borderWidth: 2.4, tension: 0.28, fill: true },
    { label: 'Buy & Hold', data: result.buyHoldSeries.map((p) => p.value), borderColor: '#14b8a6', backgroundColor: 'rgba(20, 184, 166, 0.12)', pointRadius: 0, borderDash: [6, 4], borderWidth: 2, tension: 0.28, fill: false },
  ] };
  const drawdownData = { labels, datasets: [{ label: 'Drawdown', data: result.drawdownSeries.map((p) => p.value), borderColor: '#f97316', backgroundColor: 'rgba(249, 115, 22, 0.14)', pointRadius: 0, borderWidth: 2, tension: 0.18, fill: true }] };
  state.charts.price = syncChart(state.charts.price, ui.priceChart, 'line', { labels, datasets: priceDatasets }, chartOptions(colors, false));
  state.charts.equity = syncChart(state.charts.equity, ui.equityChart, 'line', equityData, chartOptions(colors, false));
  state.charts.drawdown = syncChart(state.charts.drawdown, ui.drawdownChart, 'line', drawdownData, chartOptions(colors, true));
}
function syncChart(existing, canvas, type, data, options) { if (!existing) return new Chart(canvas, { type, data, options }); existing.data = data; existing.options = options; existing.update(); return existing; }
function chartOptions(colors, drawdown) { return { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { labels: { color: colors.muted, usePointStyle: true } }, tooltip: { backgroundColor: colors.tooltipBg, borderColor: colors.tooltipBorder, borderWidth: 1, padding: 12, titleColor: colors.tooltipTitle, bodyColor: colors.tooltipBody, displayColors: false } }, scales: { x: { grid: { display: false }, ticks: { color: colors.muted, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, border: { color: colors.border } }, y: { grid: { color: colors.grid }, ticks: { color: colors.muted, callback(value) { return drawdown ? `${formatAxisValue(value)} %` : formatAxisValue(value); } }, border: { color: colors.border } } } }; }
function addOverlay(collection, values, label, color) { if (!values?.some((v) => Number.isFinite(v))) return; collection.push({ label, data: values, borderColor: color, backgroundColor: color, pointRadius: 0, borderWidth: 1.6, tension: 0.22, fill: false }); }
function markerDataset(label, values, color) { return { label, data: values, borderColor: color, backgroundColor: color, pointBackgroundColor: color, pointBorderColor: '#fff', pointBorderWidth: 1, pointRadius: 4.8, pointHoverRadius: 6, showLine: false }; }
function runBacktest(candles) {
  const strategyKey = normalizeStrategyKey(ui.strategySelect?.value || state.activeStrategy || 'ma-crossover');
  const params = readParams();
  const initialCapital = parseNum(ui.initialCapital?.value, 10000);
  const feePct = parseNum(ui.feePct?.value, 0.1) / 100;
  const slippagePct = parseNum(ui.slippagePct?.value, 0.05) / 100;
  const costPct = Math.max(0, feePct + slippagePct);
  if (strategyKey === 'buy-hold') return backtestBuyHold(candles, initialCapital);
  if (strategyKey === 'custom') return backtestCustom(candles, initialCapital, costPct, parseDsl(ui.customInput?.value || ''));
  const cache = buildCache(candles);
  const overlays = blankOverlays(candles.length);
  const markers = { buy: blankArray(candles.length), sell: blankArray(candles.length) };
  const equitySeries = [], buyHoldSeries = [], drawdownSeries = [], trades = [], dailyReturns = [];
  const benchmarkQty = initialCapital / candles[0].close;
  let cash = initialCapital, qty = 0, entry = null, peak = initialCapital, prevEquity = initialCapital, trailingStop = null;
  const close = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const fast = strategyKey === 'ma-crossover' ? average(close, params.fastPeriod, params.maType) : null;
  const slow = strategyKey === 'ma-crossover' ? average(close, params.slowPeriod, params.maType) : null;
  const rsiSeries = strategyKey === 'rsi' ? cache.rsi(params.period) : null;
  const boll = strategyKey === 'bollinger' ? cache.bollinger(params.period, params.stdDev) : null;
  const macdSeries = strategyKey === 'macd' ? cache.macd(params.fast, params.slow, params.signal) : null;
  const trend = strategyKey === 'atr' ? cache.sma(params.trendPeriod) : null;
  const atrSeries = strategyKey === 'atr' ? cache.atr(params.atrPeriod) : null;
  overlays.fast = fast || overlays.fast; overlays.slow = slow || overlays.slow; overlays.middle = boll?.middle || overlays.middle; overlays.upper = boll?.upper || overlays.upper; overlays.lower = boll?.lower || overlays.lower; overlays.signal = macdSeries?.signal || overlays.signal; overlays.trend = trend || overlays.trend;
  for (let i = 0; i < candles.length; i += 1) {
    const buy = signalFor('buy', i);
    const sell = signalFor('sell', i);
    if (qty > 0 && strategyKey === 'atr' && Number.isFinite(atrSeries[i])) {
      const stop = candles[i].close - atrSeries[i] * params.atrMultiplier;
      trailingStop = trailingStop === null ? stop : Math.max(trailingStop, stop);
      if (Number.isFinite(trailingStop) && candles[i].close < trailingStop) finalize(i, candles[i].close, 'ATR Trailing Stop');
    }
    if (qty <= 0 && buy) open(i, candles[i].close, buy.reason);
    else if (qty > 0 && sell) finalize(i, candles[i].close, sell.reason);
    const equity = qty > 0 ? qty * candles[i].close : cash;
    const bench = benchmarkQty * candles[i].close;
    equitySeries.push({ date: candles[i].date, value: equity });
    buyHoldSeries.push({ date: candles[i].date, value: bench });
    drawdownSeries.push({ date: candles[i].date, value: peak > 0 ? ((equity - peak) / peak) * 100 : 0 });
    if (equity > peak) peak = equity;
    if (i > 0 && prevEquity !== 0) dailyReturns.push((equity / prevEquity) - 1);
    prevEquity = equity;
  }
  if (qty > 0) finalize(candles.length - 1, candles[candles.length - 1].close, 'Ende des Zeitraums');
  return { equitySeries, buyHoldSeries, drawdownSeries, trades, metrics: calculateMetrics(initialCapital, equitySeries, buyHoldSeries, trades, dailyReturns), markers, overlays };
  function signalFor(kind, i) {
    if (strategyKey === 'ma-crossover') return kind === 'buy' ? (crossesAbove(fast, slow, i) ? { reason: 'Moving-Average-Crossover' } : null) : (crossesBelow(fast, slow, i) ? { reason: 'Gegenkreuzung' } : null);
    if (strategyKey === 'rsi') return kind === 'buy' ? (Number.isFinite(rsiSeries[i]) && rsiSeries[i] <= params.buyBelow ? { reason: `RSI unter ${params.buyBelow}` } : null) : (Number.isFinite(rsiSeries[i]) && rsiSeries[i] >= params.sellAbove ? { reason: `RSI über ${params.sellAbove}` } : null);
    if (strategyKey === 'bollinger') { const exitLine = params.exitAtMiddle ? boll.middle : boll.upper; return kind === 'buy' ? (Number.isFinite(boll.lower[i]) && close[i] <= boll.lower[i] ? { reason: 'Unteres Bollinger-Band' } : null) : (Number.isFinite(exitLine[i]) && close[i] >= exitLine[i] ? { reason: params.exitAtMiddle ? 'Mittelband erreicht' : 'Oberes Band erreicht' } : null); }
    if (strategyKey === 'breakout') return kind === 'buy' ? (Number.isFinite(priorHigh(highs, params.lookback, i)) && close[i] > priorHigh(highs, params.lookback, i) ? { reason: `${params.lookback}-Tage-Breakout` } : null) : (Number.isFinite(priorLow(lows, params.exitLookback, i)) && close[i] < priorLow(lows, params.exitLookback, i) ? { reason: `${params.exitLookback}-Tage-Exit` } : null);
    if (strategyKey === 'macd') return kind === 'buy' ? (crossesAbove(macdSeries.macd, macdSeries.signal, i) ? { reason: 'MACD-Crossover' } : null) : (crossesBelow(macdSeries.macd, macdSeries.signal, i) ? { reason: 'MACD-Gegenkreuzung' } : null);
    if (strategyKey === 'momentum') { const mom = momentum(close, params.lookback); return kind === 'buy' ? (Number.isFinite(mom[i]) && mom[i] >= params.threshold ? { reason: `Momentum ≥ ${params.threshold}%` } : null) : (Number.isFinite(mom[i]) && mom[i] < 0 ? { reason: 'Momentum schwächer' } : null); }
    if (strategyKey === 'atr') return kind === 'buy' ? (Number.isFinite(trend[i]) && close[i] > trend[i] ? { reason: 'Trendfilter positiv' } : null) : (Number.isFinite(trend[i]) && close[i] < trend[i] ? { reason: 'Unter Trend-SMA' } : null);
    return null;
  }
  function open(i, price, reason) { const entryCapital = cash; qty = entryCapital / (price * (1 + costPct)); entry = { date: candles[i].date, price: price * (1 + costPct), cash: entryCapital, qty, index: i, reason: reason || 'Buy' }; cash = 0; markers.buy[i] = price; trailingStop = null; }
  function finalize(i, price, reason) { if (!entry || qty <= 0) return; const exitPrice = price * (1 - costPct); const exitCash = qty * exitPrice; const netPnl = exitCash - entry.cash; trades.push({ entryDate: entry.date, entryPrice: entry.price, exitDate: candles[i].date, exitPrice, barsHeld: Math.max(1, i - entry.index), quantity: entry.qty, grossPnl: qty * (price - entry.price), netPnl, returnPct: entry.cash ? (netPnl / entry.cash) * 100 : 0, entryReason: entry.reason, exitReason: reason || 'Verkaufssignal' }); cash = exitCash; qty = 0; entry = null; markers.sell[i] = price; trailingStop = null; }
}
function backtestBuyHold(candles, initialCapital) {
  const qty = initialCapital / candles[0].close;
  const equitySeries = candles.map((c) => ({ date: c.date, value: qty * c.close }));
  return { equitySeries, buyHoldSeries: equitySeries.map((p) => ({ ...p })), drawdownSeries: drawdowns(equitySeries), trades: [], metrics: calculateMetrics(initialCapital, equitySeries, equitySeries, [], returns(equitySeries)), markers: { buy: blankArray(candles.length), sell: blankArray(candles.length) }, overlays: blankOverlays(candles.length) };
}
function backtestCustom(candles, initialCapital, costPct, rules) {
  if (!rules.buy || !rules.sell) throw new Error('Die Custom-DSL benötigt BUY und SELL.');
  const cache = buildCache(candles);
  const markers = { buy: blankArray(candles.length), sell: blankArray(candles.length) };
  const overlays = blankOverlays(candles.length);
  const equitySeries = [], buyHoldSeries = [], drawdownSeries = [], trades = [], dailyReturns = [];
  const benchmarkQty = initialCapital / candles[0].close;
  let cash = initialCapital, qty = 0, entry = null, peak = initialCapital, prevEquity = initialCapital;
  for (let i = 0; i < candles.length; i += 1) {
    const buy = evalRule(rules.buy, i, candles, cache);
    const sell = evalRule(rules.sell, i, candles, cache);
    if (qty <= 0 && buy) { const entryPrice = candles[i].close * (1 + costPct); qty = cash / entryPrice; entry = { date: candles[i].date, price: entryPrice, cash, qty, index: i, reason: 'Custom BUY' }; cash = 0; markers.buy[i] = candles[i].close; }
    else if (qty > 0 && sell) { const exitPrice = candles[i].close * (1 - costPct); const exitCash = qty * exitPrice; const netPnl = exitCash - entry.cash; trades.push({ entryDate: entry.date, entryPrice: entry.price, exitDate: candles[i].date, exitPrice, barsHeld: Math.max(1, i - entry.index), quantity: entry.qty, grossPnl: qty * (candles[i].close - entry.price), netPnl, returnPct: entry.cash ? (netPnl / entry.cash) * 100 : 0, entryReason: entry.reason, exitReason: 'Custom SELL' }); cash = exitCash; qty = 0; entry = null; markers.sell[i] = candles[i].close; }
    const equity = qty > 0 ? qty * candles[i].close : cash;
    const bench = benchmarkQty * candles[i].close;
    equitySeries.push({ date: candles[i].date, value: equity });
    buyHoldSeries.push({ date: candles[i].date, value: bench });
    drawdownSeries.push({ date: candles[i].date, value: peak > 0 ? ((equity - peak) / peak) * 100 : 0 });
    if (equity > peak) peak = equity;
    if (i > 0 && prevEquity !== 0) dailyReturns.push((equity / prevEquity) - 1);
    prevEquity = equity;
  }
  if (qty > 0 && entry) {
    const exitPrice = candles[candles.length - 1].close * (1 - costPct);
    const exitCash = qty * exitPrice;
    const netPnl = exitCash - entry.cash;
    trades.push({ entryDate: entry.date, entryPrice: entry.price, exitDate: candles[candles.length - 1].date, exitPrice, barsHeld: Math.max(1, candles.length - 1 - entry.index), quantity: entry.qty, grossPnl: qty * (candles[candles.length - 1].close - entry.price), netPnl, returnPct: entry.cash ? (netPnl / entry.cash) * 100 : 0, entryReason: entry.reason, exitReason: 'Ende des Zeitraums' });
    equitySeries[equitySeries.length - 1] = { date: candles[candles.length - 1].date, value: exitCash };
    drawdownSeries[drawdownSeries.length - 1] = { date: candles[candles.length - 1].date, value: peak > 0 ? ((exitCash - peak) / peak) * 100 : 0 };
  }
  return { equitySeries, buyHoldSeries, drawdownSeries, trades, metrics: calculateMetrics(initialCapital, equitySeries, buyHoldSeries, trades, dailyReturns), markers, overlays };
}
function calculateMetrics(initialCapital, equitySeries, buyHoldSeries, trades, dailyReturns) {
  const finalValue = equitySeries.at(-1)?.value ?? initialCapital;
  const bhValue = buyHoldSeries.at(-1)?.value ?? initialCapital;
  const performancePct = initialCapital ? ((finalValue - initialCapital) / initialCapital) * 100 : 0;
  const buyHoldPct = initialCapital ? ((bhValue - initialCapital) / initialCapital) * 100 : 0;
  const outperformancePct = performancePct - buyHoldPct;
  const maxDrawdownPct = drawdowns(equitySeries).reduce((min, p) => Math.min(min, p.value), 0);
  const tradeCount = trades.length;
  const winRatePct = tradeCount ? (trades.filter((t) => t.netPnl > 0).length / tradeCount) * 100 : 0;
  const wins = trades.filter((t) => t.netPnl > 0).reduce((sum, t) => sum + t.netPnl, 0);
  const losses = trades.filter((t) => t.netPnl < 0).reduce((sum, t) => sum + Math.abs(t.netPnl), 0);
  const profitFactor = losses === 0 ? (wins > 0 ? Infinity : null) : wins / losses;
  const mean = dailyReturns.length ? dailyReturns.reduce((sum, v) => sum + v, 0) / dailyReturns.length : 0;
  const variance = dailyReturns.length > 1 ? dailyReturns.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (dailyReturns.length - 1) : 0;
  const volatilityPct = Math.sqrt(variance) * Math.sqrt(252) * 100;
  const sharpe = variance > 0 ? (mean / Math.sqrt(variance)) * Math.sqrt(252) : null;
  return { finalValue, performancePct, buyHoldPct, outperformancePct, maxDrawdownPct, tradeCount, winRatePct, profitFactor, sharpe, volatilityPct };
}
function blankOverlays(length) { return { fast: blankArray(length), slow: blankArray(length), middle: blankArray(length), upper: blankArray(length), lower: blankArray(length), signal: blankArray(length), trend: blankArray(length) }; }
function blankArray(length) { return Array.from({ length }, () => null); }
function returns(series) { const out = []; for (let i = 1; i < series.length; i += 1) { const prev = series[i - 1].value; const cur = series[i].value; if (prev) out.push((cur / prev) - 1); } return out; }
function drawdowns(series) { let peak = series[0]?.value || 0; return series.map((p) => { if (p.value > peak) peak = p.value; return { date: p.date, value: peak > 0 ? ((p.value - peak) / peak) * 100 : 0 }; }); }
function buildCache(candles) {
  const close = candles.map((c) => c.close);
  const high = candles.map((c) => c.high);
  const low = candles.map((c) => c.low);
  const memo = new Map();
  return { close, high, low, sma: (period) => cached(`sma:${period}`, () => sma(close, period)), ema: (period) => cached(`ema:${period}`, () => ema(close, period)), rsi: (period) => cached(`rsi:${period}`, () => rsi(close, period)), bollinger: (period, stdDev) => cached(`boll:${period}:${stdDev}`, () => bollingerBands(close, period, stdDev)), atr: (period) => cached(`atr:${period}`, () => atr(candles, period)), macd: (fast, slow, signal) => cached(`macd:${fast}:${slow}:${signal}`, () => macd(close, fast, slow, signal)) };
  function cached(key, factory) { if (!memo.has(key)) memo.set(key, factory()); return memo.get(key); }
}
function average(values, period, type) { return type === 'ema' ? ema(values, period) : sma(values, period); }
function sma(values, period) { const out = blankArray(values.length); let sum = 0; for (let i = 0; i < values.length; i += 1) { sum += values[i]; if (i >= period) sum -= values[i - period]; if (i >= period - 1) out[i] = sum / period; } return out; }
function ema(values, period) { const out = blankArray(values.length); const k = 2 / (period + 1); let value = null; let sum = 0; for (let i = 0; i < values.length; i += 1) { sum += values[i]; if (i < period - 1) continue; if (i === period - 1) value = sum / period; else value = (values[i] * k) + (value * (1 - k)); out[i] = value; } return out; }
function rsi(values, period) { const out = blankArray(values.length); if (values.length <= period) return out; let gains = 0, losses = 0; for (let i = 1; i <= period; i += 1) { const diff = values[i] - values[i - 1]; if (diff >= 0) gains += diff; else losses += Math.abs(diff); } let avgGain = gains / period; let avgLoss = losses / period; out[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss))); for (let i = period + 1; i < values.length; i += 1) { const diff = values[i] - values[i - 1]; const gain = Math.max(diff, 0); const loss = Math.max(-diff, 0); avgGain = ((avgGain * (period - 1)) + gain) / period; avgLoss = ((avgLoss * (period - 1)) + loss) / period; out[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss))); } return out; }
function standardDeviation(values, period) { const out = blankArray(values.length); for (let i = period - 1; i < values.length; i += 1) { const slice = values.slice(i - period + 1, i + 1); const mean = slice.reduce((sum, v) => sum + v, 0) / period; const variance = slice.reduce((sum, v) => sum + (v - mean) ** 2, 0) / period; out[i] = Math.sqrt(variance); } return out; }
function bollingerBands(values, period, stdDev) { const middle = sma(values, period); const dev = standardDeviation(values, period); const upper = blankArray(values.length); const lower = blankArray(values.length); for (let i = 0; i < values.length; i += 1) { if (Number.isFinite(middle[i]) && Number.isFinite(dev[i])) { upper[i] = middle[i] + (dev[i] * stdDev); lower[i] = middle[i] - (dev[i] * stdDev); } } return { middle, upper, lower }; }
function atr(candles, period) { const tr = []; for (let i = 0; i < candles.length; i += 1) { if (i === 0) tr.push(candles[i].high - candles[i].low); else tr.push(Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - candles[i - 1].close), Math.abs(candles[i].low - candles[i - 1].close))); } return sma(tr, period); }
function macd(values, fast, slow, signal) { const fastEma = ema(values, fast); const slowEma = ema(values, slow); const line = blankArray(values.length); for (let i = 0; i < values.length; i += 1) if (Number.isFinite(fastEma[i]) && Number.isFinite(slowEma[i])) line[i] = fastEma[i] - slowEma[i]; const sig = ema(line.map((v) => (Number.isFinite(v) ? v : 0)), signal); const hist = blankArray(values.length); for (let i = 0; i < values.length; i += 1) if (Number.isFinite(line[i]) && Number.isFinite(sig[i])) hist[i] = line[i] - sig[i]; return { macd: line, signal: sig, histogram: hist }; }
function crossesAbove(left, right, i) { return i > 0 && Number.isFinite(left[i - 1]) && Number.isFinite(right[i - 1]) && Number.isFinite(left[i]) && Number.isFinite(right[i]) && left[i - 1] <= right[i - 1] && left[i] > right[i]; }
function crossesBelow(left, right, i) { return i > 0 && Number.isFinite(left[i - 1]) && Number.isFinite(right[i - 1]) && Number.isFinite(left[i]) && Number.isFinite(right[i]) && left[i - 1] >= right[i - 1] && left[i] < right[i]; }
function priorHigh(values, lookback, i) { return i < lookback ? null : Math.max(...values.slice(i - lookback, i)); }
function priorLow(values, lookback, i) { return i < lookback ? null : Math.min(...values.slice(i - lookback, i)); }
function momentum(values, lookback) { const out = blankArray(values.length); for (let i = lookback; i < values.length; i += 1) out[i] = values[i - lookback] ? ((values[i] / values[i - lookback]) - 1) * 100 : null; return out; }
function parseDsl(text) { const lines = String(text || '').trim().split(/\n+/).map((line) => line.trim()).filter(Boolean); const rules = { buy: null, sell: null }; if (!lines.length) return rules; for (const line of lines) { const tokens = tokenizeDsl(line); let pos = 0; const action = expect(tokens[pos++], ['BUY', 'SELL']); expect(tokens[pos++], ['WHEN']); const { node, nextIndex } = parseExpr(tokens.slice(pos)); if (nextIndex !== tokens.length - pos) throw new Error(`Ungültige DSL: ${line}`); const key = action.value.toLowerCase(); if (rules[key]) throw new Error(`Nur eine ${action.value}-Regel pro DSL-Block erlaubt.`); rules[key] = { action: key, ast: node }; } return rules; }
function tokenizeDsl(text) { const tokens = []; const input = String(text || ''); let i = 0; while (i < input.length) { const ch = input[i]; if (/\s/.test(ch)) { i += 1; continue; } if (ch === '(' || ch === ')' || ch === ',') { tokens.push({ type: 'symbol', value: ch }); i += 1; continue; } const two = input.slice(i, i + 2); if (['>=', '<=', '==', '!='].includes(two)) { tokens.push({ type: 'operator', value: two }); i += 2; continue; } if (ch === '>' || ch === '<') { tokens.push({ type: 'operator', value: ch }); i += 1; continue; } const opWord = ['crosses_above', 'crosses_below'].find((word) => input.slice(i, i + word.length).toLowerCase() === word); if (opWord) { tokens.push({ type: 'operator', value: opWord }); i += opWord.length; continue; } const num = /^\d+(?:\.\d+)?/.exec(input.slice(i)); if (num) { tokens.push({ type: 'number', value: Number(num[0]) }); i += num[0].length; continue; } const word = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(input.slice(i)); if (word) { const raw = word[0]; const upper = raw.toUpperCase(); tokens.push({ type: ['BUY', 'SELL', 'WHEN', 'AND', 'OR'].includes(upper) ? 'keyword' : 'identifier', value: ['BUY', 'SELL', 'WHEN', 'AND', 'OR'].includes(upper) ? upper : raw }); i += raw.length; continue; } throw new Error(`Unerwartetes Zeichen: ${ch}`); } return tokens; }
function parseExpr(tokens) { let pos = 0; const peek = () => tokens[pos]; const consume = () => tokens[pos++]; const expectOne = (allowed) => { const token = consume(); if (!token || !allowed.includes(token.value)) throw new Error(`Erwartet: ${allowed.join(' oder ')}`); return token; }; const parseOr = () => { let node = parseAnd(); while (peek()?.value === 'OR') { consume(); node = { type: 'logical', op: 'OR', left: node, right: parseAnd() }; } return node; }; const parseAnd = () => { let node = parseComparison(); while (peek()?.value === 'AND') { consume(); node = { type: 'logical', op: 'AND', left: node, right: parseComparison() }; } return node; }; const parseComparison = () => { if (peek()?.value === '(') { consume(); const node = parseOr(); expectOne([')']); return node; } const left = parseValue(); const op = consume(); if (!op || !['>', '<', '>=', '<=', '=', '==', '!=', 'crosses_above', 'crosses_below'].includes(op.value)) throw new Error('Vergleichsoperator erwartet.'); const right = parseValue(); return { type: 'comparison', operator: op.value, left, right }; }; const parseValue = () => { const token = consume(); if (!token) throw new Error('Wert erwartet.'); if (token.type === 'number') return { type: 'number', value: token.value }; if (token.type === 'identifier') { if (peek()?.value === '(') { consume(); const args = []; while (peek() && peek().value !== ')') { args.push(parseValue()); if (peek()?.value === ',') consume(); } expectOne([')']); return { type: 'call', name: token.value.toLowerCase(), args }; } return { type: 'field', name: token.value.toLowerCase() }; } if (token.value === '(') { const node = parseOr(); expectOne([')']); return node; } throw new Error(`Unerwartetes Token: ${token.value}`); }; const node = parseOr(); return { node, nextIndex: pos }; }
function evalRule(rule, index, candles, cache) { return rule ? Boolean(evalNode(rule.ast, index, candles, cache)) : false; }
function evalNode(node, index, candles, cache) { if (!node) return false; if (node.type === 'logical') return node.op === 'AND' ? evalNode(node.left, index, candles, cache) && evalNode(node.right, index, candles, cache) : evalNode(node.left, index, candles, cache) || evalNode(node.right, index, candles, cache); if (node.type === 'comparison') { const left = evalValue(node.left, index, candles, cache); const right = evalValue(node.right, index, candles, cache); if (!Number.isFinite(left) || !Number.isFinite(right)) return false; if (node.operator === '>') return left > right; if (node.operator === '<') return left < right; if (node.operator === '>=') return left >= right; if (node.operator === '<=') return left <= right; if (node.operator === '=' || node.operator === '==') return left === right; if (node.operator === '!=') return left !== right; if (node.operator === 'crosses_above') return crossesAbove(nodeSeries(node.left, candles, cache), nodeSeries(node.right, candles, cache), index); if (node.operator === 'crosses_below') return crossesBelow(nodeSeries(node.left, candles, cache), nodeSeries(node.right, candles, cache), index); } if (node.type === 'number') return node.value; if (node.type === 'field') return fieldValue(node.name, candles[index]); if (node.type === 'call') return seriesForCall(node, candles, cache)[index]; return false; }
function evalValue(node, index, candles, cache) { return node.type === 'number' ? node.value : node.type === 'field' ? fieldValue(node.name, candles[index]) : node.type === 'call' ? seriesForCall(node, candles, cache)[index] : evalNode(node, index, candles, cache) ? 1 : 0; }
function nodeSeries(node, candles, cache) { return node.type === 'number' ? candles.map(() => node.value) : node.type === 'field' ? candles.map((c) => fieldValue(node.name, c)) : node.type === 'call' ? seriesForCall(node, candles, cache) : candles.map((_, i) => (evalNode(node, i, candles, cache) ? 1 : 0)); }
function seriesForCall(node, candles, cache) { if (!cache.dsl) cache.dsl = new Map(); const key = serialize(node); if (cache.dsl.has(key)) return cache.dsl.get(key); const src = node.args[0] ? nodeSeries(node.args[0], candles, cache) : candles.map((c) => c.close); let series = blankArray(candles.length); if (node.name === 'sma') series = sma(src, Math.max(2, Math.round(evalValue(node.args[1], 0, candles, cache)) || 20)); else if (node.name === 'ema') series = ema(src, Math.max(2, Math.round(evalValue(node.args[1], 0, candles, cache)) || 20)); else if (node.name === 'rsi') series = rsi(src, Math.max(2, Math.round(evalValue(node.args[1], 0, candles, cache)) || 14)); else if (node.name === 'highest') series = rollingMax(src, Math.max(2, Math.round(evalValue(node.args[1], 0, candles, cache)) || 20)); else if (node.name === 'lowest') series = rollingMin(src, Math.max(2, Math.round(evalValue(node.args[1], 0, candles, cache)) || 20)); else if (node.name === 'macd') series = macd(src, Math.round(evalValue(node.args[1], 0, candles, cache)) || 12, Math.round(evalValue(node.args[2], 0, candles, cache)) || 26, Math.round(evalValue(node.args[3], 0, candles, cache)) || 9).macd; else if (node.name === 'atr') series = atr(candles, Math.max(2, Math.round(evalValue(node.args[1], 0, candles, cache)) || 14)); else throw new Error(`Nicht erlaubte Funktion: ${node.name}`); cache.dsl.set(key, series); return series; }
function serialize(node) { if (!node) return 'null'; if (node.type === 'number') return `n:${node.value}`; if (node.type === 'field') return `f:${node.name}`; if (node.type === 'call') return `c:${node.name}(${node.args.map(serialize).join(',')})`; if (node.type === 'comparison') return `cmp:${serialize(node.left)}${node.operator}${serialize(node.right)}`; if (node.type === 'logical') return `log:${serialize(node.left)}${node.op}${serialize(node.right)}`; return 'x'; }
function fieldValue(name, candle) { return name === 'open' ? candle.open : name === 'high' ? candle.high : name === 'low' ? candle.low : name === 'close' ? candle.close : name === 'volume' ? candle.volume : NaN; }
function rollingMax(values, period) { const out = blankArray(values.length); for (let i = period - 1; i < values.length; i += 1) out[i] = Math.max(...values.slice(i - period + 1, i + 1)); return out; }
function rollingMin(values, period) { const out = blankArray(values.length); for (let i = period - 1; i < values.length; i += 1) out[i] = Math.min(...values.slice(i - period + 1, i + 1)); return out; }
function sliceByRange(candles, range) { const days = RANGE_DAYS[range] ?? RANGE_DAYS['6m']; if (!Number.isFinite(days)) return candles; const cutoff = new Date(candles.at(-1).date); cutoff.setDate(cutoff.getDate() - days); return candles.filter((c) => c.date >= cutoff); }
async function fetchYahooSeries(symbol) { const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5y`; const res = await fetch(url, { method: 'GET', mode: 'cors', cache: 'no-store' }); if (!res.ok) throw new Error(`Yahoo API antwortete mit ${res.status}`); const payload = await res.json(); const result = payload?.chart?.result?.[0]; const ts = result?.timestamp || []; const quote = result?.indicators?.quote?.[0] || {}; const series = ts.map((timestamp, index) => ({ date: new Date(timestamp * 1000), open: quote.open?.[index], high: quote.high?.[index], low: quote.low?.[index], close: quote.close?.[index], volume: quote.volume?.[index] ?? 0 })).filter((p) => Number.isFinite(p.close) && Number.isFinite(p.high) && Number.isFinite(p.low)); if (series.length < 20) throw new Error('Zu wenige Datenpunkte aus der API.'); return series.map((p) => ({ date: p.date, open: Number.isFinite(p.open) ? p.open : p.close, high: p.high, low: p.low, close: p.close, volume: p.volume })); }
function buildDemoSeries(symbol, points) { const seed = Array.from(symbol).reduce((sum, char) => sum + char.charCodeAt(0), 0) || 1; const rand = seededRandom(seed); const start = new Date(); start.setFullYear(start.getFullYear() - 5); const series = []; let price = 70 + (seed % 160); for (let day = 0; series.length < points; day += 1) { const date = new Date(start); date.setDate(start.getDate() + day); if (date.getDay() === 0 || date.getDay() === 6) continue; const open = price; price = Math.max(10, price * (1 + 0.00025 + ((rand() - 0.5) * 0.03))); const close = Number(price.toFixed(2)); const high = Number((Math.max(open, close) * (1 + rand() * 0.018)).toFixed(2)); const low = Number((Math.min(open, close) * (1 - rand() * 0.018)).toFixed(2)); series.push({ date, open: Number(open.toFixed(2)), high, low, close, volume: Math.floor(1000000 + rand() * 4000000) }); } return series; }
function seededRandom(seed) { let value = seed % 2147483647; if (value <= 0) value += 2147483646; return () => { value = (value * 16807) % 2147483647; return (value - 1) / 2147483646; }; }
function getChartColors() { const s = getComputedStyle(document.body); const dark = document.body.dataset.theme === 'dark'; return { accent: s.getPropertyValue('--accent').trim() || '#2f6bff', fill: dark ? 'rgba(122, 162, 255, 0.12)' : 'rgba(47, 107, 255, 0.12)', muted: s.getPropertyValue('--muted').trim() || '#667085', border: s.getPropertyValue('--border').trim() || '#dfe6f2', grid: dark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(223, 230, 242, 0.8)', tooltipBg: dark ? 'rgba(2, 6, 23, 0.96)' : 'rgba(15, 23, 42, 0.96)', tooltipBorder: dark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(255,255,255,0.08)', tooltipTitle: '#fff', tooltipBody: dark ? '#dbeafe' : '#e2e8f0' }; }
function formatNumber(v) { return Number.isFinite(v) ? fmt.num.format(v) : '—'; }
function formatSignedNumber(v) { return Number.isFinite(v) ? `${v >= 0 ? '+' : ''}${fmt.num.format(v)}` : '—'; }
function formatPercent(v) { return Number.isFinite(v) ? `${fmt.pct.format(v)} %` : '—'; }
function formatSignedPercent(v) { return Number.isFinite(v) ? `${v >= 0 ? '+' : ''}${fmt.pct.format(v)} %` : '—'; }
function formatRatio(v) { return v === null ? '—' : v === Infinity ? '∞' : fmt.num.format(v); }
function formatDate(v) { return fmt.date.format(v); }
function formatAxisValue(v) { const n = Number(v); return Number.isFinite(n) ? fmt.num.format(n) : '—'; }
function parseNum(v, fallback) { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : fallback; }
function normalizeSymbol(value) { return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9.^-]/g, '').slice(0, 12); }
function safeGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function safeSet(key, value) { try { localStorage.setItem(key, value); } catch {} }
function escapeHtml(value) { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }
function getNowString() { return new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date()); }
function setStatus(text) { if (ui.loadStatus) ui.loadStatus.textContent = text; }
function setSource(text, demo) { if (ui.dataSource) { ui.dataSource.textContent = text; ui.dataSource.classList.toggle('demo', demo); } if (ui.summarySource) ui.summarySource.textContent = text; }
function clearDslMessage() { if (ui.dslError) { ui.dslError.textContent = ''; ui.dslError.classList.remove('error', 'success'); } }
function showDslMessage(text, kind = 'error') { if (!ui.dslError) return; ui.dslError.textContent = text; ui.dslError.classList.toggle('error', kind === 'error'); ui.dslError.classList.toggle('success', kind === 'success'); }
function setLoading(isLoading, message) { [ui.loadButton, ui.runStrategyButton, ui.symbolInput].forEach((el) => { if (el) el.disabled = isLoading; }); if (message) setStatus(message); }
function blankOverlays(length) { return { fast: blankArray(length), slow: blankArray(length), middle: blankArray(length), upper: blankArray(length), lower: blankArray(length), signal: blankArray(length), trend: blankArray(length) }; }
function blankArray(length) { return Array.from({ length }, () => null); }
function returns(series) { const out = []; for (let i = 1; i < series.length; i += 1) { const prev = series[i - 1].value; const cur = series[i].value; if (prev) out.push((cur / prev) - 1); } return out; }
function drawdowns(series) { let peak = series[0]?.value || 0; return series.map((p) => { if (p.value > peak) peak = p.value; return { date: p.date, value: peak > 0 ? ((p.value - peak) / peak) * 100 : 0 }; }); }
