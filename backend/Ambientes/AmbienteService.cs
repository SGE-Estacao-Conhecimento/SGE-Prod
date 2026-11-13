using Sge.Api.Infrastructure;

namespace Sge.Api.Ambientes;

public sealed class AmbienteService(AmbienteRepository repo)
{
    public Task<IReadOnlyList<AmbienteDto>> ListarAsync(bool apenasAtivos = false) => repo.ListarTodosAsync(apenasAtivos);

    public async Task<AmbienteDto> ObterPorIdAsync(int id)
    {
        var amb = await repo.ObterPorIdAsync(id);
        return amb ?? throw ApiException.NotFound("Ambiente não encontrado.");
    }

    public async Task<AmbienteDto> SalvarAsync(int? id, SalvarAmbienteRequest req)
    {
        var nome = string.IsNullOrWhiteSpace(req.Nome) ? null : req.Nome.Trim();
        if (nome is null)
            throw ApiException.BadRequest("Informe o nome do ambiente.");
        if (nome.Length > 100)
            throw ApiException.BadRequest("O nome do ambiente pode ter no máximo 100 caracteres.");

        var setor = string.IsNullOrWhiteSpace(req.Setor) ? null : req.Setor.Trim();
        var descricao = string.IsNullOrWhiteSpace(req.Descricao) ? null : req.Descricao.Trim();

        if (id is null or 0)
        {
            var novoId = await repo.CriarAsync(nome, setor, descricao);
            return (await repo.ObterPorIdAsync(novoId))!;
        }

        var ok = await repo.AtualizarAsync(id.Value, nome, setor, descricao);
        if (!ok)
            throw ApiException.NotFound("Ambiente não encontrado para atualização.");

        return (await repo.ObterPorIdAsync(id.Value))!;
    }

    public async Task AlternarStatusAsync(int id)
    {
        var ok = await repo.AlternarStatusAsync(id);
        if (!ok) throw ApiException.NotFound("Ambiente não encontrado.");
    }

    public async Task ExcluirAsync(int id)
    {
        var ok = await repo.ExcluirAsync(id);
        if (!ok) throw ApiException.NotFound("Ambiente não encontrado.");
    }
}

