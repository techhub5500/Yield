function aaMetricValueText(metric) {
  if (!metric || metric.value === null || metric.value === undefined || Number.isNaN(Number(metric.value))) return '—';
  const value = Number(metric.value);
  switch (metric.type) {
    case 'percent':
      return `${value.toFixed(2)}%`;
    case 'multiple':
      return `${value.toFixed(2)}x`;
    case 'currency_per_share':
      return `R$ ${value.toFixed(2)}`;
    case 'currency':
      return window.aaFmtCompactCurrency(value);
    default:
      return value.toLocaleString('pt-BR');
  }
}

function aaMetricClass(metric) {
  if (!metric || metric.value === null || metric.value === undefined || Number.isNaN(Number(metric.value))) return '';
  if (metric.type === 'percent') {
    return Number(metric.value) >= 0 ? 'pos' : 'neg';
  }
  return 'neu';
}

const AA_BENCHMARK_KEYS = new Set([
  'PL', 'PVP', 'EVEBITDA', 'DY', 'ROE', 'ROIC', 'ROA', 'MEBITDA', 'ML',
  'CREC', 'CLL', 'LPA', 'PAYOUT', 'ALAV', 'DPL',
]);

function aaFormatBenchmark(benchmark = {}) {
  const value = benchmark?.value;
  const unit = String(benchmark?.unit || '').trim();
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return benchmark?.text || 'Benchmark setorial indisponível';
  }

  const num = Number(value);
  if (unit === '%' || unit === 'percent') return `${num.toFixed(2)}%`;
  if (unit === 'x' || unit === 'multiple') return `${num.toFixed(2)}x`;
  if (unit === 'R$') return window.aaFmtCompactCurrency(num);
  return `${num.toFixed(2)}${unit ? ` ${unit}` : ''}`.trim();
}

function aaEnsureBenchmarkNode(cell) {
  let node = cell.querySelector('.mbenchmark');
  if (node) return node;

  node = document.createElement('div');
  node.className = 'save-card-meta mbenchmark';
  node.style.marginTop = '4px';
  node.textContent = 'Benchmark setorial: carregando...';

  const anchor = cell.querySelector('.msub');
  if (anchor && anchor.parentNode) {
    anchor.parentNode.insertBefore(node, anchor.nextSibling);
  } else {
    cell.appendChild(node);
  }

  return node;
}

async function aaLoadBenchmarksForVisibleCards() {
  const ticker = window.AA?.state?.ticker;
  const sector = window.AA?.state?.core?.asset?.sector || '';
  if (!ticker) return;

  if (!window.AA.state.benchmarks) window.AA.state.benchmarks = {};
  if (!window.AA.state.benchmarks[ticker]) window.AA.state.benchmarks[ticker] = {};

  const visibleCells = [...document.querySelectorAll('.metric-cell[data-key]')]
    .filter((cell) => cell.style.display !== 'none')
    .filter((cell) => AA_BENCHMARK_KEYS.has(cell.dataset.key));

  await Promise.all(visibleCells.map(async (cell) => {
    const key = cell.dataset.key;
    const cacheKey = `${ticker}:${key}`;
    const benchmarkNode = aaEnsureBenchmarkNode(cell);

    const cached = window.AA.state.benchmarks[ticker][cacheKey];
    if (cached) {
      benchmarkNode.textContent = `Benchmark setorial: ${aaFormatBenchmark(cached)}`;
      return;
    }

    benchmarkNode.textContent = 'Benchmark setorial: carregando...';

    try {
      const res = await fetch(`${window.AA.apiBase}/api/analise-ativos/benchmark/${encodeURIComponent(ticker)}/${encodeURIComponent(key)}?sector=${encodeURIComponent(sector)}`, {
        headers: window.AA.authHeaders,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Falha ao carregar benchmark');

      const benchmark = data.benchmark || {};
      window.AA.state.benchmarks[ticker][cacheKey] = benchmark;
      benchmarkNode.textContent = `Benchmark setorial: ${aaFormatBenchmark(benchmark)}`;
    } catch (_) {
      benchmarkNode.textContent = 'Benchmark setorial: indisponível';
    }
  }));
}

function aaRenderUnavailable(segment) {
  const sec = document.getElementById('sec-indisponivel');
  if (!sec) return;
  const grid = sec.querySelector('.ind-grid');
  if (!grid) return;

  const unavailable = Array.isArray(segment?.unavailable) ? segment.unavailable : [];
  if (!unavailable.length) {
    grid.innerHTML = `
      <div class="ind-card">
        <div class="ind-card-top"><span class="ind-status ind-status-partial">Dados suficientes neste segmento</span></div>
        <div class="ind-card-name">Sem indicadores indisponíveis críticos mapeados</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = unavailable.map((item) => `
    <div class="ind-card">
      <div class="ind-card-top">
        <span class="ind-status ind-status-no">Indisponível</span>
      </div>
      <div class="ind-card-name">${item.name}</div>
      <div class="ind-card-search"><span class="ind-search-label">Observação:</span> ${item.note}</div>
    </div>
  `).join('');
}

function aaRenderIndices() {
  const core = window.AA.state.core;
  if (!core || !core.indices) return;

  const hidden = new Set(core.segment?.hiddenMetrics || []);
  const compare = window.AA.state.compareCore?.indices || null;
  const compareTicker = window.AA.state.compareTicker;

  document.querySelectorAll('.metric-cell[data-key]').forEach((cell) => {
    const key = cell.dataset.key;
    const metric = core.indices[key];
    if (!metric) return;

    if (hidden.has(key)) {
      cell.style.display = 'none';
      return;
    }

    cell.style.display = '';

    const mval = cell.querySelector('.mval');
    const msub = cell.querySelector('.msub');
    const mtrend = cell.querySelector('.mtrend');
    const cmpWrap = document.getElementById(`cmp-${key}`);
    const cmpTicker = document.getElementById(`ct-${key}`);

    if (mval) {
      if (key === 'DPL' && Number.isFinite(Number(metric.value)) && Number(metric.value) < 0) {
        mval.textContent = `${Number(metric.value).toFixed(2)}x (PL negativo)`;
      } else {
        mval.textContent = aaMetricValueText(metric);
      }
      mval.classList.remove('pos', 'neg', 'neu');
      const cls = aaMetricClass(metric);
      if (cls) mval.classList.add(cls);
    }

    if (msub) {
      if (key === 'DPL' && (metric.value === null || metric.value === undefined || !Number.isFinite(Number(metric.value)))) {
        msub.textContent = 'Sem cálculo: patrimônio líquido zero/indisponível';
      } else if (metric.yoy !== null && metric.yoy !== undefined && Number.isFinite(Number(metric.yoy))) {
        const yoy = Number(metric.yoy);
        msub.textContent = `${yoy >= 0 ? '▲' : '▼'} ${Math.abs(yoy).toFixed(2)}% vs mesmo tri ano anterior`;
      } else {
        msub.textContent = '—';
      }
    }

    if (mtrend) {
      mtrend.classList.remove('up', 'dn', 'neu');
      if (metric.yoy === null || metric.yoy === undefined || !Number.isFinite(Number(metric.yoy))) {
        mtrend.classList.add('neu');
        mtrend.textContent = 'Sem comparação YoY';
      } else {
        const yoy = Number(metric.yoy);
        mtrend.classList.add(yoy >= 0 ? 'up' : 'dn');
        mtrend.textContent = `${yoy >= 0 ? '▲' : '▼'} ${Math.abs(yoy).toFixed(2)}% YoY`;
      }
    }

    if (cmpWrap) {
      if (compare && compare[key] && compare[key].value !== null && compare[key].value !== undefined) {
        cmpWrap.classList.add('visible');
        cmpWrap.innerHTML = `<span class="mval-compare-ticker">${compareTicker}</span> ${aaMetricValueText(compare[key])}`;
      } else {
        cmpWrap.classList.remove('visible');
      }
    }

    if (cmpTicker) {
      cmpTicker.textContent = compareTicker || '';
    }
  });

  aaRenderUnavailable(core.segment);
  aaLoadBenchmarksForVisibleCards().catch(() => {});
}

window.aaRenderIndices = aaRenderIndices;

// ─── INFO DATABASE ───
const infoDB={
  PL:{title:'P/L — Preço/Lucro',sub:'Indicador de Valuation',what:'Relaciona o preço de mercado da ação com o lucro por ação gerado pela empresa. Indica quanto o mercado paga por cada R$ 1 de lucro.',how:'P/L baixo pode indicar subvalorização ou expectativa de queda nos lucros. P/L alto pode indicar crescimento esperado ou sobrevalorização. Compare sempre com o histórico da empresa e com o setor.',limit:'Não funciona bem para empresas com lucro negativo. Em setores cíclicos, um P/L aparentemente baixo pode ocorrer no pico do ciclo.'},
  PVP:{title:'P/VP — Preço/Valor Patrimonial',sub:'Indicador de Valuation',what:'Compara o preço de mercado com o valor patrimonial por ação (patrimônio líquido ÷ ações). Indica se o mercado valora a empresa acima ou abaixo do seu patrimônio contábil.',how:'P/VP < 1 pode indicar desconto sobre o valor dos ativos. P/VP > 1 indica ágio — o mercado reconhece valor além do balanço. Essencial para bancos e seguradoras.',limit:'O valor patrimonial contábil pode não refletir o valor real dos ativos, especialmente em empresas intensivas em intangíveis.'},
  EVEBITDA:{title:'EV/EBITDA',sub:'Indicador de Valuation',what:'Razão entre o Valor da Empresa (Enterprise Value) e o EBITDA. O EV inclui dívida líquida + valor de mercado, representando o "preço total" da empresa.',how:'Permite comparar empresas com estruturas de capital diferentes. Valores abaixo da média histórica ou do setor podem indicar desconto. Amplamente usado em M&A.',limit:'Ignora variações no capital de giro e capex. Empresas com alto capex recorrente (como Petrobras) podem parecer mais baratas do que realmente são.'},
  DY:{title:'Dividend Yield',sub:'Indicador de Retorno',what:'Percentual do preço da ação distribuído em dividendos nos últimos 12 meses. Mede a renda passiva gerada pelo investimento.',how:'DY elevado pode ser atrativo para renda, mas verifique se é sustentável. Calcule o payout ratio e verifique se o lucro e o fluxo de caixa suportam a distribuição.',limit:'DY alto pode resultar de queda no preço da ação (mau sinal) ou de lucro extraordinário não recorrente.'},
  ROE:{title:'ROE — Retorno sobre o Patrimônio',sub:'Indicador de Rentabilidade',what:'Mede o lucro gerado pela empresa em relação ao patrimônio líquido dos acionistas. ROE = Lucro Líquido ÷ Patrimônio Líquido.',how:'ROE acima de 15% é geralmente considerado bom. Tendência de alta é sinal positivo. Compare com o custo de capital: se ROE > Ke, a empresa gera valor.',limit:'Alavancagem financeira elevada pode inflar artificialmente o ROE. Use em conjunto com ROIC para uma visão mais completa.'},
  ROIC:{title:'ROIC — Retorno sobre o Capital Investido',sub:'Indicador de Rentabilidade',what:'Mede a eficiência com que a empresa usa todo o capital investido (dívida + equity) para gerar lucro operacional. ROIC = NOPAT ÷ Capital Investido.',how:'ROIC > WACC (custo médio do capital) indica geração de valor. É o indicador preferido por analistas focados em qualidade de negócios.',limit:'Exige ajustes contábeis para ser calculado corretamente. Pode variar muito em setores com ativos intangíveis relevantes.'},
  ROA:{title:'ROA — Retorno sobre os Ativos',sub:'Indicador de Rentabilidade',what:'Mede o lucro gerado em relação ao total de ativos da empresa. ROA = Lucro Líquido ÷ Ativo Total.',how:'Útil para comparar eficiência entre empresas do mesmo setor. Para bancos, um ROA de 1-2% já é considerado bom. Para industriais, espera-se mais.',limit:'Ativos intangíveis não contabilizados (marcas, patentes) podem distorcer o indicador.'},
  MEBITDA:{title:'Margem EBITDA',sub:'Indicador de Rentabilidade',what:'Percentual da receita que se converte em EBITDA. Mede a eficiência operacional antes de juros, impostos, depreciação e amortização.',how:'Margem alta e crescente indica poder de precificação e controle de custos. Compare com concorrentes e com o histórico da empresa.',limit:'Ignora capex e variações de capital de giro. Uma empresa pode ter margem EBITDA alta mas queimar caixa se o capex for muito elevado.'},
  RL:{title:'Receita Líquida',sub:'Indicador de Resultado',what:'Total das vendas deduzidas de impostos, devoluções e descontos. É a linha de partida da demonstração de resultados.',how:'Crescimento consistente da receita indica demanda sólida. Analise junto com as margens para entender se o crescimento é rentável.',limit:'Crescimento de receita sem crescimento de lucro pode indicar deterioração das margens ou aumento de custos.'},
  LB:{title:'Lucro Bruto',sub:'Indicador de Resultado',what:'Receita Líquida menos o Custo dos Produtos Vendidos (CPV). Representa a rentabilidade antes das despesas operacionais.',how:'A margem bruta (Lucro Bruto ÷ Receita) indica o poder de precificação da empresa. Margens estáveis ou crescentes são positivas.',limit:'Varia muito por setor. Varejistas têm margens brutas menores que empresas de software, por exemplo.'},
  EBITDA:{title:'EBITDA',sub:'Indicador de Resultado',what:'Lucro antes de juros, impostos, depreciação e amortização. Aproxima a geração de caixa operacional da empresa.',how:'Permite comparar empresas com diferentes estruturas de capital e regimes fiscais. Crescimento consistente é sinal positivo.',limit:'Não é fluxo de caixa livre. Ignora necessidades de reinvestimento (capex). Warren Buffett é crítico do uso isolado deste indicador.'},
  LL:{title:'Lucro Líquido',sub:'Indicador de Resultado',what:'Resultado final após todas as despesas, juros e impostos. É a base para o cálculo do LPA (Lucro por Ação) e do ROE.',how:'Analise a tendência plurianual, não um resultado isolado. Verifique itens não recorrentes que possam distorcer o resultado.',limit:'Pode ser influenciado por eventos não recorrentes, variações cambiais e diferimentos contábeis.'},
  DB:{title:'Dívida Bruta',sub:'Indicador de Endividamento',what:'Total de obrigações financeiras da empresa com credores, incluindo empréstimos, debêntures e financiamentos de curto e longo prazo.',how:'Analise em relação ao EBITDA e ao Patrimônio Líquido. Tendência de crescimento acima da geração de caixa é sinal de alerta.',limit:'Nem toda dívida é igual — verifique custo, prazo e moeda da dívida para avaliar o real risco.'},
  DL:{title:'Dívida Líquida',sub:'Indicador de Endividamento',what:'Dívida Bruta menos o Caixa e Equivalentes. Representa a dívida efetiva caso a empresa usasse todo o caixa disponível para quitá-la.',how:'DL negativa (caixa > dívida) indica posição de caixa líquida — geralmente positivo. DL/EBITDA > 3x é considerado alto para a maioria dos setores.',limit:'O caixa pode ser restrito ou destinado a obrigações específicas. Dívida com garantias ou covenants exige análise adicional.'},
  ALAV:{title:'Alavancagem (DL/EBITDA)',sub:'Indicador de Endividamento',what:'Quantos anos de EBITDA seriam necessários para quitar a Dívida Líquida. É o principal indicador de risco financeiro de crédito.',how:'< 1x: muito conservador. 1-2x: saudável. 2-3x: razoável. > 3x: alto para a maioria dos setores. Agências de rating usam este indicador extensamente.',limit:'Setores intensivos em ativos (energia, telecom, utilities) naturalmente operam com alavancagens mais altas por conta de fluxos de caixa previsíveis.'},
  DPL:{title:'Dívida / Patrimônio Líquido',sub:'Indicador de Endividamento',what:'Relação entre a dívida total e o patrimônio líquido dos acionistas. Indica quanto a empresa deve para cada R$ 1 de patrimônio dos sócios.',how:'< 1x é geralmente conservador. Valores acima de 2x merecem atenção. Compare com o histórico e com o setor.',limit:'Em períodos de juros baixos, empresas alavancadas podem superar desalavancadas. A análise de qualidade da dívida é essencial.'},
  EV:{title:'EV — Enterprise Value',sub:'Indicador de Valuation',what:'Valor de Mercado + Dívida Líquida. Representa o preço teórico para comprar a empresa inteira e quitar suas dívidas.',how:'É o numerador do cálculo de EV/EBITDA. Reflete melhor o custo real de aquisição do negócio do que apenas o valor de mercado.',limit:'Depende da precisão do cálculo da dívida líquida e do valor das participações em coligadas.'},
  PSR:{title:'P/Receita (PSR) — Price-to-Sales Ratio',sub:'Indicador de Valuation',what:'Preço da ação dividido pela receita por ação. Indica quanto o mercado paga por cada R$ 1 de venda gerada.',how:'Útil para empresas em crescimento que ainda não geram lucro. PSR baixo em relação aos pares pode indicar desconto.',limit:'Não considera a lucratividade. Uma empresa pode ter receita alta mas margens negativas.'},
  ML:{title:'Margem Líquida',sub:'Indicador de Rentabilidade',what:'Percentual da receita que sobra como lucro líquido após todas as despesas e impostos. ML = Lucro Líquido ÷ Receita Líquida.',how:'Indica a eficiência final da operação. Margens líquidas acima de 10-15% costumam indicar negócios resilientes ou com vantagens competitivas.',limit:'Pode ser distorcida por itens não recorrentes ou resultados financeiros (juros e câmbio).'},
  CREC:{title:'Crescimento de Receita (YoY)',sub:'Indicador de Crescimento',what:'Variação percentual da receita líquida em relação ao mesmo período do ano anterior (Year-over-Year).',how:'Crescimento acima da inflação indica ganho de mercado ou aumento de volume/preço. Essencial para avaliar o "top-line" do negócio.',limit:'Crescimento acelerado pode esconder queima de caixa ou perda de margens para ganhar market share.'},
  CLL:{title:'Crescimento de Lucro Líquido (YoY)',sub:'Indicador de Crescimento',what:'Variação percentual do lucro líquido em relação ao mesmo período do ano anterior.',how:'Indica se a empresa está conseguindo transformar crescimento de receita em retorno real para o acionista.',limit:'Altamente volátil. Itens não recorrentes em um ano podem fazer o crescimento parecer artificialmente alto ou baixo no ano seguinte.'},
  LPA:{title:'LPA — Lucro por Ação',sub:'Indicador de Resultado',what:'Lucro Líquido total dividido pelo número de ações da empresa. Representa a parcela do lucro que pertence a cada ação.',how:'É a base para o cálculo do P/L. Crescimento do LPA ao longo dos anos é um dos principais drivers de valorização das ações.',limit:'Pode ser manipulado por recompra de ações (que diminui a base de ações) ou emissões (que dilui o lucro).'},
  PAYOUT:{title:'Payout Ratio',sub:'Indicador de Proventos',what:'Percentual do lucro líquido que foi distribuído aos acionistas na forma de dividendos ou JCP.',how:'Indica a política de dividendos. Payout alto (>70%) sugere empresa madura; Payout baixo (<30%) sugere retenção para crescimento.',limit:'Payout acima de 100% é insustentável no longo prazo, indicando que a empresa está distribuindo reservas ou se endividando para pagar dividendos.'},
};
function showInfo(key, e){
  e.stopPropagation();
  const d=infoDB[key];
  if(!d)return;
  document.getElementById('infoTitle').textContent=d.title;
  document.getElementById('infoSubtitle').textContent=d.sub;
  document.getElementById('infoWhat').textContent=d.what;
  document.getElementById('infoHow').textContent=d.how;
  document.getElementById('infoLimit').textContent=d.limit;
  openModal('info');
}

// ─── DADOS NÃO DISPONÍVEIS — info tooltip ───
function _closeAllIndPopups() {
  document.querySelectorAll('.ind-popup.open').forEach(p => {
    p.classList.remove('open');
    const b = p.closest('.ind-card')?.querySelector('.ind-info-btn');
    if (b) b.classList.remove('active');
  });
}
function toggleIndInfo(btn) {
  const card = btn.closest('.ind-card');
  const popup = card.querySelector('.ind-popup');
  const isOpen = popup.classList.contains('open');
  _closeAllIndPopups();
  if (!isOpen) {
    popup.classList.add('open');
    btn.classList.add('active');
  }
}
function closeIndInfo(closeBtn) {
  const popup = closeBtn.closest('.ind-popup');
  popup.classList.remove('open');
  const b = popup.closest('.ind-card')?.querySelector('.ind-info-btn');
  if (b) b.classList.remove('active');
}
document.addEventListener('DOMContentLoaded', function() {
  // Hover: show on mouseenter btn. Popup stays open until X or click outside.
  document.querySelectorAll('.ind-info-btn').forEach(btn => {
    const card = btn.closest('.ind-card');
    const popup = card.querySelector('.ind-popup');
    btn.addEventListener('mouseenter', () => {
      _closeAllIndPopups();
      popup.classList.add('open');
      btn.classList.add('active');
    });
  });
  // Click outside to close
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.ind-card')) _closeAllIndPopups();
  });
});

