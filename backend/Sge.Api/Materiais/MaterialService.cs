using System.Security.Claims;
using Sge.Api.Auth;
using Sge.Api.Estoque;
using Sge.Api.Infrastructure;

namespace Sge.Api.Materiais;

/// <summary>Cadastro e edição de materiais pela equipe.</summary>
public sealed class MaterialService(DbConnectionFactory db, MaterialRepository materiais, EstoqueRepository estoque)
{
    /// <summary>
    /// Cadastra o material. O saldo inicial informado é registrado como ajuste de entrada
    /// ("Saldo inicial cadastrado"), na mesma transação do cadastro.
    /// </summary>
    public async Task<MaterialDto> CriarAsync(SalvarMaterialRequest req, ClaimsPrincipal usuario)
    {
        var permiteFracao = req.PermiteFracao ?? false;
        var dados = Validar(req, codigoAtual: null, bemDuravelAtual: false, permiteFracaoAtual: permiteFracao);
        var saldoInicial = req.QuantidadeInicial ?? 0;
        if (saldoInicial < 0)
            throw ApiException.BadRequest("A quantidade inicial não pode ser negativa.");
        ValidarFracao(dados.PermiteFracao, saldoInicial, "A quantidade inicial");

        await using var t = await Transacao.IniciarAsync(db);

        // Sem código informado, o sistema gera MAT-<id> (mesmo padrão da tela).
        var codigoInformado = dados.Codigo.Length > 0;
        var id = await materiais.InserirAsync(t, codigoInformado ? dados : dados with { Codigo = $"TMP-{Guid.NewGuid():N}" });
        if (!codigoInformado)
            await materiais.DefinirCodigoAsync(t, id, $"MAT-{id:000}");

        if (saldoInicial > 0)
        {
            var saldo = await estoque.CreditarAsync(t, id, saldoInicial);
            await estoque.RegistrarAsync(t, new EstoqueRepository.NovaMovimentacao(
                id, TipoMovimentacao.Ajuste, "entrada", saldoInicial, saldo, usuario.UsuarioId(),
                TipoMovimentacao.MotivoSaldoInicial));
        }

        var criado = await materiais.ObterAsync(t, id);
        await t.ConfirmarAsync();
        return criado!;
    }

    /// <summary>Edita os dados cadastrais. O saldo só muda por movimentação (entrada, entrega ou balanço).</summary>
    public async Task<MaterialDto> EditarAsync(int produtoId, SalvarMaterialRequest req)
    {
        await using var t = await Transacao.IniciarAsync(db);
        var atual = await materiais.ObterAsync(t, produtoId) ?? throw ApiException.NotFound("Material não encontrado.");

        var dados = Validar(req, atual.Codigo, atual.BemDuravel, atual.PermiteFracao);
        await materiais.AtualizarAsync(t, produtoId, dados);

        var editado = await materiais.ObterAsync(t, produtoId);
        await t.ConfirmarAsync();
        return editado!;
    }

    private static MaterialRepository.DadosMaterial Validar(
        SalvarMaterialRequest req, string? codigoAtual, bool bemDuravelAtual, bool permiteFracaoAtual)
    {
        var erros = new Dictionary<string, string[]>();
        string? Texto(string? valor, string campo, int maximo, bool obrigatorio, string rotulo)
        {
            var texto = string.IsNullOrWhiteSpace(valor) ? null : valor.Trim();
            if (texto is null && obrigatorio) erros[campo] = [$"Informe {rotulo}."];
            else if (texto?.Length > maximo) erros[campo] = [$"{char.ToUpper(rotulo[0])}{rotulo[1..]} pode ter no máximo {maximo} caracteres."];
            return texto;
        }

        var codigo = Texto(req.Codigo, "codigo", 50, false, "o código")?.ToUpperInvariant();
        var nome = Texto(req.Nome, "nome", 100, true, "o nome do material");
        var categoria = Texto(req.Categoria, "categoria", 100, false, "a categoria");
        var unidade = Texto(req.Unidade, "unidade", 20, true, "a unidade de medida");
        var localizacao = Texto(req.Localizacao, "localizacao", 150, false, "a localização");
        var descricao = Texto(req.Descricao, "descricao", 500, false, "a descrição");
        var minimo = req.EstoqueMinimo ?? 0;
        if (minimo < 0) erros["estoqueMinimo"] = ["O estoque mínimo não pode ser negativo."];

        if (erros.Count > 0)
            throw ApiException.BadRequest(erros.First().Value[0], erros);

        var permiteFracao = req.PermiteFracao ?? permiteFracaoAtual;
        ValidarFracao(permiteFracao, minimo, "O estoque mínimo");

        return new MaterialRepository.DadosMaterial(
            codigo ?? codigoAtual ?? string.Empty, nome!, categoria, unidade!, minimo,
            localizacao, descricao, req.BemDuravel ?? bemDuravelAtual, permiteFracao);
    }

    private static void ValidarFracao(bool permiteFracao, decimal valor, string rotulo)
    {
        if (!permiteFracao && valor != decimal.Truncate(valor))
            throw ApiException.BadRequest($"{rotulo} deve ser um número inteiro para este material.");
    }
}
