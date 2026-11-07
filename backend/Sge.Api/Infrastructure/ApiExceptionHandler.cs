using Microsoft.AspNetCore.Diagnostics;
using MySqlConnector;

namespace Sge.Api.Infrastructure;

/// <summary>
/// Converte exceções em respostas JSON padronizadas, sem expor detalhes internos.
/// </summary>
public sealed class ApiExceptionHandler(ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        var (status, body) = exception switch
        {
            ApiException api => (api.Status, new ErrorResponse(api.Message, api.Errors)),

            // SIGNAL SQLSTATE '45000' disparado pelos triggers do banco (regras de integridade).
            MySqlException { Number: 1644 } sql => (422, new ErrorResponse(sql.Message)),
            MySqlException { ErrorCode: MySqlErrorCode.DuplicateKeyEntry } =>
                (409, new ErrorResponse("Já existe um registro com estes dados.")),
            MySqlException { Number: 3819 } =>
                (422, new ErrorResponse("Os dados informados violam uma regra de integridade do banco.")),
            MySqlException { ErrorCode: MySqlErrorCode.RowIsReferenced2 or MySqlErrorCode.NoReferencedRow2 } =>
                (409, new ErrorResponse("A operação conflita com registros relacionados.")),

            _ => (500, new ErrorResponse("Erro interno no servidor. Tente novamente mais tarde."))
        };

        if (status >= 500)
            logger.LogError(exception, "Erro não tratado em {Method} {Path}", context.Request.Method, context.Request.Path);
        else if (exception is MySqlException)
            logger.LogWarning("Regra do banco recusou a operação em {Path}: {Message}", context.Request.Path, exception.Message);

        context.Response.StatusCode = status;
        await context.Response.WriteAsJsonAsync(body, cancellationToken);
        return true;
    }
}
