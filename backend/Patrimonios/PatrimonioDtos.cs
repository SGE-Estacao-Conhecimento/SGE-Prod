namespace Sge.Api.Patrimonios;

public sealed record PatrimonioCatalogoDto(
    int Id,
    string Nome,
    string Categoria,
    string? Marca,
    string? Modelo,
    string? Descricao,
    bool Ativo,
    int TotalExemplares
);

public sealed record SalvarPatrimonioCatalogoRequest(
    string? Nome,
    string? Categoria,
    string? Marca,
    string? Modelo,
    string? Descricao
);

public sealed record PatrimonioItemDto(
    int Id,
    int PatrimonioId,
    string NomePatrimonio,
    string Categoria,
    string? Marca,
    string? Modelo,
    string NumeroPatrimonio,
    string? NumeroSerie,
    int? AmbienteId,
    string? NomeAmbiente,
    int? ResponsavelId,
    string? NomeResponsavel,
    string EstadoConservacao,
    string Status,
    string? DataAquisicao,
    string? Observacoes,
    string DataCadastro
);

public sealed record SalvarPatrimonioItemRequest(
    int? PatrimonioId,
    string? NovoPatrimonioNome,
    string? Categoria,
    string? Marca,
    string? Modelo,
    string? NumeroPatrimonio,
    string? NumeroSerie,
    int? AmbienteId,
    int? ResponsavelUsuarioId,
    string? EstadoConservacao,
    string? Status,
    string? DataAquisicao,
    string? Observacoes
);

public sealed record TransferirItemRequest(
    int? NovoAmbienteId,
    int? NovoResponsavelId,
    string? Observacoes
);

