namespace Sge.Api.Ambientes;

public sealed record AmbienteDto(
    int Id,
    string Nome,
    string? Setor,
    string? Descricao,
    bool Ativo,
    long TotalPatrimonios
);

public sealed record SalvarAmbienteRequest(
    string? Nome,
    string? Setor,
    string? Descricao
);

