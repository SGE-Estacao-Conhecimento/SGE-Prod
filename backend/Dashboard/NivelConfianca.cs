using System.Text.Json.Serialization;

namespace Sge.Api.Dashboard;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum NivelConfianca
{
    [JsonStringEnumMemberName("alta")]
    Alta,

    [JsonStringEnumMemberName("media")]
    Media,

    [JsonStringEnumMemberName("baixa")]
    Baixa
}
