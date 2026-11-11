using System.Net.Mail;

namespace Sge.Api.Infrastructure;

public static class Validadores
{
    public static string SomenteDigitos(string? valor) =>
        new((valor ?? string.Empty).Where(char.IsDigit).ToArray());

    /// <summary>Validação matemática completa do CPF (11 dígitos, rejeição de sequências repetidas e módulo 11).</summary>
    public static bool CpfValido(string? valor)
    {
        var digitos = SomenteDigitos(valor);
        if (digitos.Length != 11)
            return false;

        var primeiro = digitos[0];
        var todosIguais = true;
        for (var i = 1; i < digitos.Length; i++)
        {
            if (digitos[i] != primeiro)
            {
                todosIguais = false;
                break;
            }
        }
        if (todosIguais)
            return false;

        for (var j = 9; j < 11; j++)
        {
            var soma = 0;
            for (var i = 0; i < j; i++)
                soma += (digitos[i] - '0') * (j + 1 - i);

            var resto = soma % 11;
            var esperado = resto < 2 ? 0 : 11 - resto;
            if (digitos[j] - '0' != esperado)
                return false;
        }

        return true;
    }

    public static bool EmailValido(string? email, bool aceitarLoginAdmin = false)
    {
        if (string.IsNullOrWhiteSpace(email))
            return false;

        var normalizado = email.Trim();
        if (aceitarLoginAdmin && string.Equals(normalizado, "admin", StringComparison.OrdinalIgnoreCase))
            return true;

        return MailAddress.TryCreate(normalizado, out var endereco)
            && string.Equals(endereco.Address, normalizado, StringComparison.Ordinal)
            && normalizado.Contains('.');
    }
}

