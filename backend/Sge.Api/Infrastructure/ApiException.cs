namespace Sge.Api.Infrastructure;

/// <summary>
/// Erro de negócio ou de validação com mensagem pronta para o usuário final.
/// Convertido em resposta JSON { message, errors } pelo <see cref="ApiExceptionHandler"/>.
/// </summary>
public sealed class ApiException(int status, string message, IDictionary<string, string[]>? errors = null)
    : Exception(message)
{
    public int Status { get; } = status;
    public IDictionary<string, string[]>? Errors { get; } = errors;

    public static ApiException BadRequest(string message, IDictionary<string, string[]>? errors = null) => new(400, message, errors);
    public static ApiException NotFound(string message) => new(404, message);
    public static ApiException Conflict(string message) => new(409, message);
    public static ApiException Forbidden(string message) => new(403, message);
}

/// <summary>Formato único de erro devolvido pela API. O front lê o campo "message".</summary>
public sealed record ErrorResponse(string Message, IDictionary<string, string[]>? Errors = null);
