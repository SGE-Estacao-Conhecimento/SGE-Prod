using Dapper;
using Sge.Api.Auth;
using Sge.Api.Infrastructure;

namespace Sge.Api.DevSeed;

/// <summary>
/// Carga de dados SOMENTE para desenvolvimento e testes: os mesmos setores, usuários e materiais
/// de demonstração do front-end (src/data/demoData.js). Executado com: dotnet run -- seed-dev
/// Exige a variável SGE_SEED_SENHA (senha de todos os usuários de teste) e um banco vazio.
/// CPFs são fictícios (000000000XX) apenas para testar o login por CPF.
/// </summary>
public sealed class DevSeeder(DbConnectionFactory db, PasswordService senhas, ILogger<DevSeeder> logger)
{
    private static readonly string[] Setores =
        ["Educação Infantil", "Ensino Fundamental", "Coordenação", "Apoio / Limpeza", "Almoxarifado Central", "Diretoria / TI"];

    private static readonly (string Nome, string Email, string Perfil, string Setor)[] Usuarios =
    [
        ("Carlos Silva", "carlos.silva@estacao.org.br", Perfis.Funcionario, "Educação Infantil"),
        ("Mariana Costa", "mariana.costa@estacao.org.br", Perfis.Funcionario, "Ensino Fundamental"),
        ("Roberto Souza", "roberto.souza@estacao.org.br", Perfis.Funcionario, "Coordenação"),
        ("Juliana Dias", "juliana.dias@estacao.org.br", Perfis.Funcionario, "Educação Infantil"),
        ("Marcos Andrade", "marcos.andrade@estacao.org.br", Perfis.Funcionario, "Apoio / Limpeza"),
        ("Ana Beatriz", "ana.beatriz@estacao.org.br", Perfis.Almoxarifado, "Almoxarifado Central"),
        ("Arthur Vequi", "arthur.vequi@estacao.org.br", Perfis.Admin, "Diretoria / TI"),
        ("Fernanda Lima", "fernanda.lima@estacao.org.br", Perfis.Funcionario, "Ensino Fundamental")
    ];

    private static readonly (string Codigo, string Nome, string Categoria, string Unidade, int Qtd, int Min, string Descricao, string Localizacao)[] Materiais =
    [
        ("MAT-001", "Papel Sulfite A4", "Escritório", "Resma", 48, 10, "75g/m², resma com 500 folhas", "Armário A - Prateleira 2"),
        ("MAT-002", "Caneta Esferográfica Azul", "Escritório", "UN", 120, 30, "Ponta média 1.0mm", "Gaveteiro 1"),
        ("MAT-003", "Marcador para Quadro Branco", "Material Didático", "UN", 18, 15, "Cores azul e preta", "Prat. 01"),
        ("MAT-004", "Álcool em Gel 70%", "Limpeza e Higiene", "Frasco", 35, 8, "Frasco de 500ml", "Prat. 02"),
        ("MAT-005", "Grampeador de Mesa", "Escritório", "UN", 6, 5, "Modelo metálico para até 25 folhas • Patrimônio", "Prateleira 3"),
        ("MAT-006", "Fita Adesiva Transparente", "Escritório", "Rolo", 0, 10, "45mm x 50 metros", "Caixa de Fitas"),
        ("MAT-007", "Cabo HDMI 2.0 Blindado", "Informática / TI", "UN", 8, 3, "2 metros, compatível com 4K • Equipamento TI", "Armário TI"),
        ("MAT-008", "Apagador para Quadro Branco", "Material Didático", "UN", 0, 6, "Corpo anatômico", "Prat. 02"),
        ("MAT-009", "Giz Escolar Plastificado", "Material Didático", "Caixa", 22, 8, "Caixa com 50 unidades", "Prat. 01"),
        ("MAT-010", "Papel Toalha Interfolhado", "Limpeza e Higiene", "Fardo", 14, 5, "Fardo com 1000 folhas", "Fila B"),
        ("MAT-011", "Protetor Solar FPS 50", "Limpeza e Higiene", "Frasco", 25, 10, "Frasco 120ml proteção UVA/UVB", "Prat. 01"),
        ("PAT-001", "Projetor Multimídia Epson", "Informática / TI", "UN", 3, 1, "Projetor WXGA 3600 Lumens • Patrimônio Educacional", "Armário AV - Prat 1"),
        ("PAT-002", "Furadeira de Impacto Bosch", "Manutenção", "UN", 2, 1, "Furadeira 650W 1/2 Pol • Ferramental de Manutenção", "Painel de Ferramentas")
    ];

    /// <summary>Materiais marcados como bem durável em frontend/src/data/demoData.js.</summary>
    private static readonly HashSet<string> BensDuraveis = ["MAT-005", "MAT-007", "PAT-001", "PAT-002"];

    public async Task ExecutarAsync()
    {
        var senha = Environment.GetEnvironmentVariable("SGE_SEED_SENHA");
        if (string.IsNullOrEmpty(senha) || senha.Length < PasswordService.TamanhoMinimo)
            throw new InvalidOperationException($"Defina SGE_SEED_SENHA (mínimo de {PasswordService.TamanhoMinimo} caracteres).");

        await using var con = await db.AbrirAsync();
        if (await con.ExecuteScalarAsync<long>("SELECT COUNT(*) FROM setores") > 0)
        {
            logger.LogWarning("O banco já possui dados. Carga de desenvolvimento ignorada.");
            return;
        }

        await using var tx = await con.BeginTransactionAsync();
        var setorIds = new Dictionary<string, int>();
        foreach (var nome in Setores)
            setorIds[nome] = await con.ExecuteScalarAsync<int>(
                "INSERT INTO setores (nome) VALUES (@nome); SELECT LAST_INSERT_ID();", new { nome }, tx);

        var hash = senhas.Hash(senha);
        int? adminId = null;
        for (var i = 0; i < Usuarios.Length; i++)
        {
            var u = Usuarios[i];
            var funcionarioId = await con.ExecuteScalarAsync<int>(
                "INSERT INTO funcionarios (nome, setor_id, cpf) VALUES (@Nome, @setorId, @cpf); SELECT LAST_INSERT_ID();",
                new { u.Nome, setorId = setorIds[u.Setor], cpf = $"{i + 1:00000000000}" }, tx);
            var usuarioId = await con.ExecuteScalarAsync<int>(
                "INSERT INTO usuarios (funcionario_id, email, senha_hash, perfil) VALUES (@funcionarioId, @Email, @hash, @Perfil); SELECT LAST_INSERT_ID();",
                new { funcionarioId, u.Email, hash, u.Perfil }, tx);
            if (u.Perfil == Perfis.Admin) adminId = usuarioId;
        }

        foreach (var m in Materiais)
        {
            var produtoId = await con.ExecuteScalarAsync<int>("""
                INSERT INTO produtos (codigo, nome, categoria, unidade_medida, localizacao, descricao, bem_duravel, quantidade, quantidade_minima)
                VALUES (@Codigo, @Nome, @Categoria, @Unidade, @Localizacao, @Descricao, @duravel, @Qtd, @Min);
                SELECT LAST_INSERT_ID();
                """, new { m.Codigo, m.Nome, m.Categoria, m.Unidade, m.Localizacao, m.Descricao, duravel = BensDuraveis.Contains(m.Codigo), m.Qtd, m.Min }, tx);

            // O saldo inicial fica registrado no histórico, como exige o modelo de movimentações.
            if (m.Qtd > 0)
                await con.ExecuteAsync("""
                    INSERT INTO movimentacoes_estoque (produto_id, tipo, sentido, quantidade, saldo_apos, usuario_id, motivo)
                    VALUES (@produtoId, 'ajuste', 'entrada', @Qtd, @Qtd, @adminId, 'Saldo inicial (dados de desenvolvimento)')
                    """, new { produtoId, m.Qtd, adminId }, tx);
        }

        await tx.CommitAsync();
        logger.LogInformation("Carga de desenvolvimento concluída: {Setores} setores, {Usuarios} usuários, {Materiais} materiais.",
            Setores.Length, Usuarios.Length, Materiais.Length);
    }
}
