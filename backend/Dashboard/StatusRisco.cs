using System.Text.Json.Serialization;

namespace Sge.Api.Dashboard;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum StatusRisco
{
    [JsonStringEnumMemberName("critico")]
    Critico,

    [JsonStringEnumMemberName("alerta")]
    Alerta,

    [JsonStringEnumMemberName("alto_risco")]
    AltoRisco,

    [JsonStringEnumMemberName("atencao")]
    Atencao,

    [JsonStringEnumMemberName("estavel")]
    Estavel,

    [JsonStringEnumMemberName("sem_consumo_recente")]
    SemConsumoRecente,

    [JsonStringEnumMemberName("sem_dados_suficientes")]
    SemDadosSuficientes,

    [JsonStringEnumMemberName("sem_giro")]
    SemGiro
}
