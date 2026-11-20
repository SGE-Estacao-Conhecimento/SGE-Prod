using System.Data.Common;
using Dapper;
using MySqlConnector;
using Sge.Api.Infrastructure;

namespace Sge.Api.Notificacoes;

/// <summary>
/// Acesso a dados para a entidade notificacoes.
/// Segue PADROES_DESENVOLVIMENTO.md: herda de RepositorioBase, SQL parametrizado via Dapper.
/// Possui fallback transparente para pedido_logs caso a tabela notificacoes ainda não tenha sido criada.
/// </summary>
public sealed class NotificacaoRepository(DbConnectionFactory db) : RepositorioBase(db)
{
    public sealed class NotificacaoLinha
    {
        public long NotificacaoId { get; set; }
        public int UsuarioId { get; set; }
        public string PerfilDestino { get; set; } = string.Empty;
        public string Categoria { get; set; } = string.Empty;
        public string Tipo { get; set; } = string.Empty;
        public string Titulo { get; set; } = string.Empty;
        public string Mensagem { get; set; } = string.Empty;
        public string? LinkAcao { get; set; }
        public string? TextoAcao { get; set; }
        public bool Lida { get; set; }
        public DateTime CriadaEm { get; set; }
        public DateTime? LidaEm { get; set; }
    }

    public async Task<IReadOnlyList<NotificacaoLinha>> ListarPorUsuarioAsync(int usuarioId, int limite = 50, CancellationToken ct = default)
    {
        await using var con = await AbrirAsync(ct);
        const string sql = """
            SELECT notificacao_id, usuario_id, perfil_destino, categoria, tipo,
                   titulo, mensagem, link_acao, texto_acao, lida, criada_em, lida_em
              FROM notificacoes
             WHERE usuario_id = @usuarioId
             ORDER BY criada_em DESC, notificacao_id DESC
             LIMIT @limite
            """;

        try
        {
            var resultado = await con.QueryAsync<NotificacaoLinha>(sql, new { usuarioId, limite });
            return resultado.ToList();
        }
        catch (MySqlException ex) when (ex.Number == 1146)
        {
            // Tabela notificacoes ainda não foi criada no banco: fallback transparente para pedido_logs
            const string sqlFallback = """
                SELECT l.log_id AS notificacao_id,
                       u.usuario_id,
                       'funcionario' AS perfil_destino,
                       'pedido' AS categoria,
                       CASE WHEN p.urgencia = 'alta' OR l.status_novo = 'pronto_retirada' THEN 'urgente'
                            WHEN l.status_novo = 'atendido' THEN 'sucesso'
                            ELSE 'info' END AS tipo,
                       CONCAT('Pedido #', l.pedido_id, ' Atualizado') AS titulo,
                       COALESCE(l.descricao, CONCAT('Situação: ', l.status_novo)) AS mensagem,
                       CONCAT('/pedidos?id=', l.pedido_id) AS link_acao,
                       'Ver Detalhes' AS texto_acao,
                       FALSE AS lida,
                       l.data_log AS criada_em,
                       NULL AS lida_em
                  FROM pedido_logs l
                  JOIN pedidos p ON p.pedido_id = l.pedido_id
                  JOIN usuarios u ON u.funcionario_id = p.funcionario_solicitante_id
                 WHERE u.usuario_id = @usuarioId
                 ORDER BY l.data_log DESC, l.log_id DESC
                 LIMIT @limite
                """;
            var fallback = await con.QueryAsync<NotificacaoLinha>(sqlFallback, new { usuarioId, limite });
            return fallback.ToList();
        }
    }

    public async Task<int> ContarNaoLidasAsync(int usuarioId, CancellationToken ct = default)
    {
        await using var con = await AbrirAsync(ct);
        const string sql = """
            SELECT COUNT(*)
              FROM notificacoes
             WHERE usuario_id = @usuarioId
               AND lida = FALSE
            """;

        try
        {
            return await con.ExecuteScalarAsync<int>(sql, new { usuarioId });
        }
        catch (MySqlException ex) when (ex.Number == 1146)
        {
            return 0;
        }
    }

    public async Task<bool> MarcarComoLidaAsync(long notificacaoId, int usuarioId, CancellationToken ct = default)
    {
        await using var con = await AbrirAsync(ct);
        const string sql = """
            UPDATE notificacoes
               SET lida = TRUE,
                   lida_em = UTC_TIMESTAMP(6)
             WHERE notificacao_id = @notificacaoId
               AND usuario_id = @usuarioId
            """;

        try
        {
            var afetados = await con.ExecuteAsync(sql, new { notificacaoId, usuarioId });
            return afetados > 0;
        }
        catch (MySqlException ex) when (ex.Number == 1146)
        {
            return true;
        }
    }

    public async Task<int> MarcarTodasComoLidasAsync(int usuarioId, CancellationToken ct = default)
    {
        await using var con = await AbrirAsync(ct);
        const string sql = """
            UPDATE notificacoes
               SET lida = TRUE,
                   lida_em = UTC_TIMESTAMP(6)
             WHERE usuario_id = @usuarioId
               AND lida = FALSE
            """;

        try
        {
            return await con.ExecuteAsync(sql, new { usuarioId });
        }
        catch (MySqlException ex) when (ex.Number == 1146)
        {
            return 0;
        }
    }

    public async Task<bool> ExcluirAsync(long notificacaoId, int usuarioId, CancellationToken ct = default)
    {
        await using var con = await AbrirAsync(ct);
        const string sql = """
            DELETE FROM notificacoes
             WHERE notificacao_id = @notificacaoId
               AND usuario_id = @usuarioId
            """;

        try
        {
            var afetados = await con.ExecuteAsync(sql, new { notificacaoId, usuarioId });
            return afetados > 0;
        }
        catch (MySqlException ex) when (ex.Number == 1146)
        {
            return true;
        }
    }

    public async Task InserirAsync(
        int usuarioId,
        string perfilDestino,
        string categoria,
        string tipo,
        string titulo,
        string mensagem,
        string? linkAcao,
        string? textoAcao,
        DbConnection? conExterna = null,
        DbTransaction? txExterna = null,
        CancellationToken ct = default)
    {
        const string sql = """
            INSERT INTO notificacoes (
                usuario_id, perfil_destino, categoria, tipo, titulo, mensagem, link_acao, texto_acao, lida, criada_em
            ) VALUES (
                @usuarioId, @perfilDestino, @categoria, @tipo, @titulo, @mensagem, @linkAcao, @textoAcao, FALSE, UTC_TIMESTAMP(6)
            )
            """;

        var parametros = new
        {
            usuarioId,
            perfilDestino,
            categoria,
            tipo,
            titulo,
            mensagem,
            linkAcao,
            textoAcao
        };

        try
        {
            if (conExterna is not null)
            {
                await conExterna.ExecuteAsync(sql, parametros, txExterna);
                return;
            }

            await using var con = await AbrirAsync(ct);
            await con.ExecuteAsync(sql, parametros);
        }
        catch (MySqlException ex) when (ex.Number == 1146)
        {
            // Tabela notificacoes ainda não existe: degrada silenciosamente até a migração ser aplicada
        }
    }

    public async Task InserirParaPerfilAsync(
        string perfilBanco,
        string categoria,
        string tipo,
        string titulo,
        string mensagem,
        string? linkAcao,
        string? textoAcao,
        DbConnection? conExterna = null,
        DbTransaction? txExterna = null,
        CancellationToken ct = default)
    {
        const string sqlUsuarios = """
            SELECT usuario_id
              FROM usuarios
             WHERE perfil = @perfilBanco
               AND ativo = TRUE
            """;

        const string sqlInsert = """
            INSERT INTO notificacoes (
                usuario_id, perfil_destino, categoria, tipo, titulo, mensagem, link_acao, texto_acao, lida, criada_em
            ) VALUES (
                @usuarioId, @perfilDestino, @categoria, @tipo, @titulo, @mensagem, @linkAcao, @textoAcao, FALSE, UTC_TIMESTAMP(6)
            )
            """;

        var executor = async (DbConnection conn, DbTransaction? tran) =>
        {
            try
            {
                var usuarios = (await conn.QueryAsync<int>(sqlUsuarios, new { perfilBanco }, tran)).ToList();
                if (usuarios.Count == 0) return;

                var batch = usuarios.Select(uid => new
                {
                    usuarioId = uid,
                    perfilDestino = perfilBanco,
                    categoria,
                    tipo,
                    titulo,
                    mensagem,
                    linkAcao,
                    textoAcao
                });

                await conn.ExecuteAsync(sqlInsert, batch, tran);
            }
            catch (MySqlException ex) when (ex.Number == 1146)
            {
                // Tabela notificacoes ainda não existe: degrada silenciosamente
            }
        };

        if (conExterna is not null)
        {
            await executor(conExterna, txExterna);
            return;
        }

        await using var con = await AbrirAsync(ct);
        await executor(con, null);
    }

    public async Task<int?> ObterUsuarioIdPorFuncionarioAsync(int funcionarioId, CancellationToken ct = default)
    {
        await using var con = await AbrirAsync(ct);
        const string sql = "SELECT usuario_id FROM usuarios WHERE funcionario_id = @funcionarioId AND ativo = TRUE LIMIT 1";
        return await con.QueryFirstOrDefaultAsync<int?>(sql, new { funcionarioId });
    }
}
