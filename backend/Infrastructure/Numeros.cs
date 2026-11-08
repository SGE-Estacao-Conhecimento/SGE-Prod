using System.Globalization;

namespace Sge.Api.Infrastructure;

public static class Numeros
{
    /// <summary>Remove zeros à direita de DECIMAL(15,3) (ex.: 3.000 vira 3) para o JSON e para textos.</summary>
    public static decimal Normalizar(decimal valor) => valor / 1.0000000000000000000000000000m;

    public static decimal? Normalizar(decimal? valor) => valor is null ? null : Normalizar(valor.Value);

    /// <summary>Quantidade formatada para textos exibidos ao usuário (ex.: "2,5").</summary>
    public static string Texto(decimal valor) =>
        Normalizar(valor).ToString("0.###", CultureInfo.GetCultureInfo("pt-BR"));
}
