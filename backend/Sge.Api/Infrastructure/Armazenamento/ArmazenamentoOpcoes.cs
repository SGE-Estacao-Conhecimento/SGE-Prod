namespace Sge.Api.Infrastructure.Armazenamento;

/// <summary>
/// Configuração do armazenamento S3 compatível (MinIO), lida das variáveis de ambiente
/// definidas no guia-minIO-conexao-sql.md. Credenciais nunca ficam no repositório.
/// </summary>
public sealed record ArmazenamentoOpcoes(
    string Endpoint, string Bucket, string Regiao, bool ForcarPathStyle, string ChaveAcesso, string Segredo)
{
    public static ArmazenamentoOpcoes Ler(IConfiguration config)
    {
        string Obrigatoria(string nome) => string.IsNullOrWhiteSpace(config[nome])
            ? throw new InvalidOperationException($"Configuração ausente: {nome}.")
            : config[nome]!.Trim();

        return new ArmazenamentoOpcoes(
            Endpoint: Obrigatoria("S3_ENDPOINT"),
            Bucket: Obrigatoria("S3_BUCKET"),
            Regiao: string.IsNullOrWhiteSpace(config["S3_REGION"]) ? "us-east-1" : config["S3_REGION"]!.Trim(),
            ForcarPathStyle: !string.Equals(config["S3_FORCE_PATH_STYLE"], "false", StringComparison.OrdinalIgnoreCase),
            ChaveAcesso: Obrigatoria("S3_ACCESS_KEY_ID"),
            Segredo: Obrigatoria("S3_SECRET_ACCESS_KEY"));
    }
}
