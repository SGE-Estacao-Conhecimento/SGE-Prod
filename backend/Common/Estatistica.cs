namespace Sge.Api.Common;

/// <summary>
/// Funcoes estatisticas puras sem efeitos colaterais.
/// Padrao R-7 para percentis com interpolacao linear.
/// </summary>
public static class Estatistica
{
    /// <summary>
    /// Calcula o percentil p (0.0 a 1.0) usando o metodo R-7 (posicao (n - 1) * p com interpolacao linear).
    /// Espera que valoresOrdenados esteja ordenado de forma ascendente.
    /// Retorna null para listas vazias.
    /// </summary>
    public static double? Percentil(IReadOnlyList<double>? valoresOrdenados, double p)
    {
        if (valoresOrdenados is null || valoresOrdenados.Count == 0)
            return null;

        if (p < 0.0 || p > 1.0)
            throw new ArgumentOutOfRangeException(nameof(p), "O percentil p deve estar entre 0.0 e 1.0.");

        var n = valoresOrdenados.Count;
        if (n == 1)
            return valoresOrdenados[0];

        var index = (n - 1) * p;
        var lower = (int)Math.Floor(index);
        var upper = (int)Math.Ceiling(index);

        if (lower == upper)
            return valoresOrdenados[lower];

        var fraction = index - lower;
        return valoresOrdenados[lower] + fraction * (valoresOrdenados[upper] - valoresOrdenados[lower]);
    }

    /// <summary>
    /// Calcula a mediana (percentil 50) de uma colecao de valores.
    /// Ordena os valores internamente se necessario.
    /// Retorna null para listas vazias.
    /// </summary>
    public static double? Mediana(IReadOnlyList<double>? valores)
    {
        if (valores is null || valores.Count == 0)
            return null;

        if (valores.Count == 1)
            return valores[0];

        var ordenados = valores.OrderBy(x => x).ToList();
        return Percentil(ordenados, 0.5);
    }
}
