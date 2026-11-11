export const limparCpf = (valor) => (valor ? String(valor).replace(/\D/g, '') : '');

export const formatarCpf = (valor) => {
  const digitos = limparCpf(valor).slice(0, 11);
  if (!digitos) return '';
  if (digitos.length <= 3) return digitos;
  if (digitos.length <= 6) return `${digitos.slice(0, 3)}.${digitos.slice(3)}`;
  if (digitos.length <= 9) return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6)}`;
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
};

/**
 * Valida matematicamente o CPF (11 dígitos, rejeição de sequências repetidas e módulo 11).
 */
export const validarCpf = (valor) => {
  const digitos = limparCpf(valor);
  if (digitos.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digitos)) return false;

  for (let j = 9; j < 11; j += 1) {
    let soma = 0;
    for (let i = 0; i < j; i += 1) {
      soma += Number(digitos[i]) * (j + 1 - i);
    }
    const resto = soma % 11;
    const esperado = resto < 2 ? 0 : 11 - resto;
    if (Number(digitos[j]) !== esperado) return false;
  }

  return true;
};

