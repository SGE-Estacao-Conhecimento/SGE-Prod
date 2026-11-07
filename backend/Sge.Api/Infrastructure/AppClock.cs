namespace Sge.Api.Infrastructure;

/// <summary>
/// Conversão das datas do banco (UTC) para o fuso local usado na exibição (padrão: America/Sao_Paulo).
/// </summary>
public sealed class AppClock(string fusoHorario)
{
    private readonly TimeZoneInfo _fuso = TimeZoneInfo.FindSystemTimeZoneById(fusoHorario);

    public static DateTime ComoUtc(DateTime valor) => DateTime.SpecifyKind(valor, DateTimeKind.Utc);

    public DateTime ParaLocal(DateTime utc) => TimeZoneInfo.ConvertTimeFromUtc(ComoUtc(utc), _fuso);

    /// <summary>Data no formato exibido pelo front-end (dd/MM/yyyy).</summary>
    public string DataCurta(DateTime utc) => ParaLocal(utc).ToString("dd/MM/yyyy");
}
