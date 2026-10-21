const MOJIBAKE_REPLACEMENTS = {
  'Ã¡': 'á', 'Ã©': 'é', 'Ã­': 'í', 'Ã³': 'ó', 'Ãº': 'ú', 'Ã£': 'ã', 'Ãµ': 'õ',
  'Ã§': 'ç', 'Ãª': 'ê', 'Ã´': 'ô', 'Ã ': 'à', 'Ã‰': 'É', 'Ã': 'Á', 'Ã': ''
};

export const corrigirTexto = (value = '') => String(value).replace(/Ã¡|Ã©|Ã­|Ã³|Ãº|Ã£|Ãµ|Ã§|Ãª|Ã´|Ã |Ã‰|Ã|Ã/g, match => MOJIBAKE_REPLACEMENTS[match] ?? match);

export const normalizarTextoBusca = (value = '') => corrigirTexto(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();
