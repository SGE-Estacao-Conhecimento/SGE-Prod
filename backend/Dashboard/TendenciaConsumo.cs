using System.Text.Json.Serialization;

namespace Sge.Api.Dashboard;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum TendenciaConsumo
{
    [JsonStringEnumMemberName("crescente")]
    Crescente,

    [JsonStringEnumMemberName("estavel")]
    Estavel,

    [JsonStringEnumMemberName("decrescente")]
    Decrescente,

    [JsonStringEnumMemberName("alta")]
    Alta = Crescente,

    [JsonStringEnumMemberName("baixa")]
    Baixa = Decrescente
}
