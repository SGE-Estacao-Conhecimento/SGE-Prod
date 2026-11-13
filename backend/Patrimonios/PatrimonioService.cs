using System.Globalization;
using Sge.Api.Ambientes;
using Sge.Api.Infrastructure;

namespace Sge.Api.Patrimonios;

public sealed class PatrimonioService(
    PatrimonioRepository repo,
    AmbienteRepository ambienteRepo)
{
    public Task<IReadOnlyList<PatrimonioCatalogoDto>> ListarCatalogoAsync(string? categoria = null)
        => repo.ListarCatalogoAsync(categoria);

    public async Task<PatrimonioCatalogoDto> SalvarCatalogoAsync(int? id, SalvarPatrimonioCatalogoRequest req)
    {
        var nome = string.IsNullOrWhiteSpace(req.Nome) ? null : req.Nome.Trim();
        if (nome is null)
            throw ApiException.BadRequest("Informe o nome do modelo de patrimônio.");
        if (nome.Length > 150)
            throw ApiException.BadRequest("O nome do modelo pode ter no máximo 150 caracteres.");

        var categoria = string.IsNullOrWhiteSpace(req.Categoria) ? null : req.Categoria.Trim();
        if (categoria is null)
            throw ApiException.BadRequest("Informe a categoria do patrimônio.");

        var marca = string.IsNullOrWhiteSpace(req.Marca) ? null : req.Marca.Trim();
        var modelo = string.IsNullOrWhiteSpace(req.Modelo) ? null : req.Modelo.Trim();
        var descricao = string.IsNullOrWhiteSpace(req.Descricao) ? null : req.Descricao.Trim();

        if (id is null or 0)
        {
            var novoId = await repo.CriarCatalogoAsync(nome, categoria, marca, modelo, descricao);
            return (await repo.ObterCatalogoPorIdAsync(novoId))!;
        }

        var ok = await repo.AtualizarCatalogoAsync(id.Value, nome, categoria, marca, modelo, descricao);
        if (!ok)
            throw ApiException.NotFound("Modelo de patrimônio não encontrado.");

        return (await repo.ObterCatalogoPorIdAsync(id.Value))!;
    }

    public Task<IReadOnlyList<PatrimonioItemDto>> ListarItensAsync(
        int? ambienteId = null,
        bool semAmbiente = false,
        string? busca = null,
        string? categoria = null,
        string? status = null)
        => repo.ListarItensAsync(ambienteId, semAmbiente, busca, categoria, status);

    public async Task<PatrimonioItemDto> ObterItemPorIdAsync(int id)
    {
        var item = await repo.ObterItemPorIdAsync(id);
        return item ?? throw ApiException.NotFound("Item de patrimônio não encontrado.");
    }

    public async Task<PatrimonioItemDto> SalvarItemAsync(int? id, SalvarPatrimonioItemRequest req)
    {
        var numeroPatrimonio = string.IsNullOrWhiteSpace(req.NumeroPatrimonio) ? null : req.NumeroPatrimonio.Trim();
        if (numeroPatrimonio is null)
            throw ApiException.BadRequest("Informe o número da plaqueta/patrimônio.");

        if (await repo.ExisteNumeroPatrimonioAsync(numeroPatrimonio, id))
            throw ApiException.Conflict($"O número de patrimônio \"{numeroPatrimonio}\" já está em uso.");

        int patrimonioId;
        if (req.PatrimonioId is > 0)
        {
            patrimonioId = req.PatrimonioId.Value;
            var cat = await repo.ObterCatalogoPorIdAsync(patrimonioId);
            if (cat is null)
                throw ApiException.BadRequest("Modelo de patrimônio selecionado não existe.");
        }
        else
        {
            var novoNome = string.IsNullOrWhiteSpace(req.NovoPatrimonioNome) ? null : req.NovoPatrimonioNome.Trim();
            if (novoNome is null)
                throw ApiException.BadRequest("Selecione um modelo existente ou informe o nome do novo modelo de patrimônio.");

            var catNome = string.IsNullOrWhiteSpace(req.Categoria) ? "Geral" : req.Categoria.Trim();
            patrimonioId = await repo.CriarCatalogoAsync(novoNome, catNome, req.Marca?.Trim(), req.Modelo?.Trim(), req.Observacoes?.Trim());
        }

        if (req.AmbienteId is > 0)
        {
            var amb = await ambienteRepo.ObterPorIdAsync(req.AmbienteId.Value);
            if (amb is null)
                throw ApiException.BadRequest("Ambiente selecionado não existe.");
        }

        var estado = string.IsNullOrWhiteSpace(req.EstadoConservacao) ? "bom" : req.EstadoConservacao.Trim().ToLowerInvariant();
        if (estado is not ("novo" or "bom" or "regular" or "danificado" or "em_manutencao"))
            estado = "bom";

        var status = string.IsNullOrWhiteSpace(req.Status) ? "ativo" : req.Status.Trim().ToLowerInvariant();
        if (status is not ("ativo" or "em_manutencao" or "baixado"))
            status = "ativo";

        DateTime? dataAquisicao = null;
        if (!string.IsNullOrWhiteSpace(req.DataAquisicao))
        {
            if (DateTime.TryParseExact(req.DataAquisicao.Trim(), new[] { "yyyy-MM-dd", "dd/MM/yyyy" },
                CultureInfo.InvariantCulture, DateTimeStyles.None, out var d))
            {
                dataAquisicao = d;
            }
        }

        var numSerie = string.IsNullOrWhiteSpace(req.NumeroSerie) ? null : req.NumeroSerie.Trim();
        var obs = string.IsNullOrWhiteSpace(req.Observacoes) ? null : req.Observacoes.Trim();

        if (id is null or 0)
        {
            var novoItemId = await repo.CriarItemAsync(
                patrimonioId,
                numeroPatrimonio,
                numSerie,
                req.AmbienteId,
                req.ResponsavelUsuarioId,
                estado,
                status,
                dataAquisicao,
                obs);
            return (await repo.ObterItemPorIdAsync(novoItemId))!;
        }

        var ok = await repo.AtualizarItemAsync(
            id.Value,
            numeroPatrimonio,
            numSerie,
            req.AmbienteId,
            req.ResponsavelUsuarioId,
            estado,
            status,
            dataAquisicao,
            obs);

        if (!ok)
            throw ApiException.NotFound("Item de patrimônio não encontrado para atualização.");

        return (await repo.ObterItemPorIdAsync(id.Value))!;
    }

    public async Task TransferirAsync(int itemId, TransferirItemRequest req)
    {
        if (req.NovoAmbienteId is > 0)
        {
            var amb = await ambienteRepo.ObterPorIdAsync(req.NovoAmbienteId.Value);
            if (amb is null) throw ApiException.BadRequest("Ambiente de destino não existe.");
        }

        var ok = await repo.TransferirItemAsync(itemId, req.NovoAmbienteId, req.NovoResponsavelId, req.Observacoes?.Trim());
        if (!ok) throw ApiException.NotFound("Item de patrimônio não encontrado.");
    }

    public async Task BaixarItemAsync(int itemId)
    {
        var ok = await repo.BaixarItemAsync(itemId);
        if (!ok) throw ApiException.NotFound("Item de patrimônio não encontrado.");
    }
}

