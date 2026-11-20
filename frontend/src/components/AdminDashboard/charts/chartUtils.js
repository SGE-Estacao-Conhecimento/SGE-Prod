/**
 * chartUtils.js - Utilitários matemáticos e de formatação para gráficos SVG nativos.
 * Funções puras, determinísticas e sem bibliotecas externas.
 *
 * REGRA ESTRITA: Proibido qualquer cálculo, formatação ou menção a moeda/finanças.
 * REGRA ESTRITA: Proibido emojis e caracteres decorativos.
 */

/**
 * Normaliza um ponto de dados para o formato { x, y }.
 * @param {Object|Array} p - Ponto com coordenadas
 * @returns {{ x: number, y: number }|null}
 */
function normalizarPonto(p) {
  if (!p) return null;
  if (Array.isArray(p) && p.length >= 2) {
    const x = Number(p[0]);
    const y = Number(p[1]);
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  } else if (typeof p === 'object' && 'x' in p && 'y' in p) {
    const x = Number(p.x);
    const y = Number(p.y);
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  }
  return null;
}

/**
 * Calcula a escala vertical (Y) para gráficos SVG, mapeando valores numéricos
 * para coordenadas SVG de cima para baixo.
 * Trata arrays vazios com fallback (0..10) e min === max sem divisão por zero.
 *
 * @param {number[]} valores - Array de números a serem plotados
 * @param {number} [altura=220] - Altura total do viewBox SVG
 * @param {number|Object} [padding=20] - Margem interna vertical
 * @returns {Function} Função de mapeamento getY(valor) com propriedades auxiliares
 */
export function calcularEscalaY(valores = [], altura = 220, padding = 20) {
  const padTop = typeof padding === 'object' && padding !== null ? (Number(padding.top) || 0) : (Number(padding) || 0);
  const padBottom = typeof padding === 'object' && padding !== null ? (Number(padding.bottom) || 0) : (Number(padding) || 0);

  const numeros = Array.isArray(valores)
    ? valores
        .map(v => (v !== null && v !== undefined ? Number(v) : null))
        .filter(v => v !== null && Number.isFinite(v))
    : [];

  let min = 0;
  let max = 10;

  if (numeros.length > 0) {
    const rawMin = Math.min(...numeros);
    const rawMax = Math.max(...numeros);

    if (rawMin === rawMax) {
      if (rawMin === 0) {
        min = 0;
        max = 10;
      } else if (rawMin > 0) {
        min = 0;
        max = rawMax * 1.5;
      } else {
        min = rawMin * 1.5;
        max = 0;
      }
    } else {
      min = rawMin > 0 ? 0 : rawMin;
      max = rawMax;
    }
  }

  const range = max - min || 1;
  const disponivel = Math.max(1, altura - padTop - padBottom);

  function getY(valor) {
    if (valor === null || valor === undefined || !Number.isFinite(Number(valor))) {
      return null;
    }
    const num = Number(valor);
    const ratio = (num - min) / range;
    const y = altura - padBottom - ratio * disponivel;
    return Number(y.toFixed(2));
  }

  const numTicks = 4;
  const ticks = [];
  for (let i = 0; i <= numTicks; i++) {
    const tickVal = min + (range * i) / numTicks;
    const tickY = (altura - padBottom) - ((tickVal - min) / range) * disponivel;
    ticks.push({
      valor: Number(tickVal.toFixed(1)),
      y: Number(tickY.toFixed(2))
    });
  }

  getY.min = min;
  getY.max = max;
  getY.range = range;
  getY.ticks = ticks;
  getY.altura = altura;
  getY.getY = getY;

  return getY;
}

/**
 * Calcula a escala horizontal (X) para gráficos SVG, distribuindo pontos
 * uniformemente na largura disponível.
 * Trata total <= 1 com posicionamento centralizado e seguro.
 *
 * @param {number} total - Quantidade total de pontos
 * @param {number} [largura=500] - Largura total do viewBox SVG
 * @param {number|Object} [padding=30] - Margem interna horizontal
 * @returns {Function} Função getX(indice) com propriedades auxiliares
 */
export function calcularEscalaX(total, largura = 500, padding = 30) {
  const padLeft = typeof padding === 'object' && padding !== null ? (Number(padding.left) || 0) : (Number(padding) || 0);
  const padRight = typeof padding === 'object' && padding !== null ? (Number(padding.right) || 0) : (Number(padding) || 0);

  const disponivel = Math.max(1, largura - padLeft - padRight);
  const count = Math.max(0, Number(total) || 0);

  let step = 0;
  if (count > 1) {
    step = disponivel / (count - 1);
  }

  function getX(indice) {
    if (count <= 1) {
      return Number((padLeft + disponivel / 2).toFixed(2));
    }
    const idx = Math.max(0, Math.min(count - 1, Number(indice) || 0));
    const x = padLeft + idx * step;
    return Number(x.toFixed(2));
  }

  getX.step = step;
  getX.largura = largura;
  getX.total = count;
  getX.getX = getX;
  getX.pontos = Array.from({ length: count }, (_, i) => getX(i));

  return getX;
}

/**
 * Gera o atributo `d` para um path SVG de curva suave monotônica (Fritsch-Carlson).
 * Garante que a curva nunca ultrapasse os picos/vales reais dos dados (sem overshoot).
 *
 * @param {Array<{x: number, y: number}>|Array<[number, number]>} pontos - Lista de coordenadas
 * @returns {string} Comando de path SVG válido
 */
export function gerarPathLinhaSuave(pontos) {
  const pts = Array.isArray(pontos)
    ? pontos.map(normalizarPonto).filter(Boolean)
    : [];

  const n = pts.length;
  if (n === 0) return '';
  if (n === 1) return `M ${pts[0].x} ${pts[0].y}`;

  if (n === 2) {
    return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
  }

  // 1. Calcula inclinações das secantes (slopes)
  const dx = new Array(n - 1);
  const dy = new Array(n - 1);
  const slopes = new Array(n - 1);

  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x;
    dy[i] = pts[i + 1].y - pts[i].y;
    slopes[i] = dx[i] !== 0 ? dy[i] / dx[i] : 0;
  }

  // 2. Calcula tangentes iniciais nos pontos
  const tangents = new Array(n);
  tangents[0] = slopes[0];
  tangents[n - 1] = slopes[n - 2];

  for (let i = 1; i < n - 1; i++) {
    if (slopes[i - 1] * slopes[i] <= 0) {
      // Ponto de inflexão ou pico/vale: tangente nula para evitar overshoot
      tangents[i] = 0;
    } else {
      tangents[i] = (slopes[i - 1] + slopes[i]) / 2;
    }
  }

  // 3. Ajuste de monotonicidade Fritsch-Carlson
  for (let i = 0; i < n - 1; i++) {
    if (slopes[i] === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
    } else {
      const alpha = tangents[i] / slopes[i];
      const beta = tangents[i + 1] / slopes[i];

      if (alpha < 0) tangents[i] = 0;
      if (beta < 0) tangents[i + 1] = 0;

      const hipo = alpha * alpha + beta * beta;
      if (hipo > 9) {
        const tau = 3 / Math.sqrt(hipo);
        tangents[i] = tau * alpha * slopes[i];
        tangents[i + 1] = tau * beta * slopes[i];
      }
    }
  }

  // 4. Monta o path cúbico de Bézier com controle de limites
  let d = `M ${pts[0].x} ${pts[0].y}`;

  for (let i = 0; i < n - 1; i++) {
    const deltaX = dx[i];
    const cp1x = pts[i].x + deltaX / 3;
    let cp1y = pts[i].y + tangents[i] * (deltaX / 3);

    const cp2x = pts[i + 1].x - deltaX / 3;
    let cp2y = pts[i + 1].y - tangents[i + 1] * (deltaX / 3);

    // Trava os pontos de controle entre os valores mínimo e máximo do intervalo
    const minY = Math.min(pts[i].y, pts[i + 1].y);
    const maxY = Math.max(pts[i].y, pts[i + 1].y);
    cp1y = Math.max(minY, Math.min(maxY, cp1y));
    cp2y = Math.max(minY, Math.min(maxY, cp2y));

    d += ` C ${Number(cp1x.toFixed(2))} ${Number(cp1y.toFixed(2))}, ${Number(cp2x.toFixed(2))} ${Number(cp2y.toFixed(2))}, ${pts[i + 1].x} ${pts[i + 1].y}`;
  }

  return d;
}

/**
 * Formata uma data ISO ou string de data em pt-BR com UTC estrito.
 *
 * @param {string|Date} iso - Data em formato ISO ou objeto Date
 * @param {Intl.DateTimeFormatOptions} [opcoes] - Opções adicionais do formatador
 * @returns {string} Data formatada ou string vazia se inválida
 */
export function formatarData(iso, opcoes = {}) {
  if (!iso) return '';
  let data;
  if (iso instanceof Date) {
    data = iso;
  } else if (typeof iso === 'string') {
    const str = iso.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      data = new Date(str + 'T00:00:00Z');
    } else {
      data = new Date(str);
    }
  } else {
    data = new Date(iso);
  }

  if (isNaN(data.getTime())) return '';

  const configPadrao = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
    ...opcoes
  };

  return new Intl.DateTimeFormat('pt-BR', configPadrao).format(data);
}

/**
 * Trunca uma string adicionando sufixo ASCII "..." estritamente se ultrapassar o limite.
 * Nunca utiliza caracteres de elipse Unicode ou decorativos.
 *
 * @param {string} texto - Texto de entrada
 * @param {number} max - Comprimento máximo permitido
 * @returns {string}
 */
export function truncarTexto(texto, max) {
  if (texto === null || texto === undefined) return '';
  const str = String(texto);
  const limite = Number(max);
  if (!Number.isFinite(limite) || limite <= 0) return '';
  if (str.length <= limite) {
    return str;
  }
  return str.slice(0, limite) + '...';
}

/**
 * Calcula o percentual de uma parte em relação ao total.
 * Retorna 0 se o total for zero, nulo ou inválido.
 *
 * @param {number} parte - Valor da parte
 * @param {number} total - Valor do total
 * @param {number} [casasDecimais=1] - Casas decimais para arredondamento
 * @returns {number}
 */
export function calcularPorcentagem(parte, total, casasDecimais = 1) {
  const tot = Number(total);
  if (!Number.isFinite(tot) || tot === 0) {
    return 0;
  }
  const p = Number(parte);
  if (!Number.isFinite(p)) {
    return 0;
  }
  const pct = (p / tot) * 100;
  if (casasDecimais === null || casasDecimais === undefined) {
    return pct;
  }
  const fator = Math.pow(10, Math.max(0, casasDecimais));
  return Math.round(pct * fator) / fator;
}

/**
 * Gera o atributo `d` para um path SVG de segmentos de reta simples (M x0 y0 L x1 y1 ...).
 * Ideal para projecoes lineares onde a interpolacao curvilinea e desnecessaria ou indesejada.
 *
 * @param {Array<{x: number, y: number}>} pontos - Lista de coordenadas
 * @returns {string} Comando de path SVG valido
 */
export function gerarPathLinhaReta(pontos) {
  const pts = Array.isArray(pontos)
    ? pontos.map(normalizarPonto).filter(Boolean)
    : [];
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  return pts.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '').trim();
}

/**
 * Formata um numero para padrao brasileiro com controle de casas decimais.
 * Nao adiciona simbolos de moeda (proibicao estrita de informacoes financeiras).
 *
 * @param {number} valor - Numero a ser formatado
 * @param {number} [maxDecimais=2] - Maximo de casas decimais
 * @returns {string} Numero formatado em pt-BR
 */
export function formatarNumero(valor, maxDecimais = 2) {
  if (valor === null || valor === undefined || !Number.isFinite(Number(valor))) return '0';
  const num = Number(valor);
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: maxDecimais,
    minimumFractionDigits: 0
  }).format(num === 0 ? 0 : num);
}
