using System.Text.Json;
using System.Text.Json.Serialization;

namespace Sge.Api.Common;

/// <summary>
/// Fonte unica de configuracao de serializacao JSON para toda a aplicacao e testes.
/// </summary>
public static class JsonDefaults
{
    private static readonly JsonSerializerOptions _options = CriarOpcoes();

    public static JsonSerializerOptions Options => _options;

    public static JsonSerializerOptions Configure(JsonSerializerOptions o)
    {
        o.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        o.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
        return o;
    }

    private static JsonSerializerOptions CriarOpcoes()
    {
        var o = new JsonSerializerOptions();
        Configure(o);
        return o;
    }
}
