using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Dapper;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using Sge.Api.Ambientes;
using Sge.Api.Auth;
using Sge.Api.Dashboard;
using Sge.Api.DevSeed;
using Sge.Api.Estoque;
using Sge.Api.Favoritos;
using Sge.Api.Infrastructure;
using Sge.Api.Infrastructure.Armazenamento;
using Sge.Api.Materiais;
using Sge.Api.Notificacoes;
using Sge.Api.Patrimonios;
using Sge.Api.Pedidos;
using Sge.Api.Remessas;
using Sge.Api.Setores;
using Sge.Api.Usuarios;

var builder = WebApplication.CreateBuilder(args);

// ---------- Configuração obrigatória (falha cedo, sem revelar segredos) ----------
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connectionString))
    throw new InvalidOperationException("Configuração ausente: ConnectionStrings:DefaultConnection.");

var jwt = builder.Configuration.GetSection("Jwt").Get<JwtOptions>() ?? new JwtOptions();
if (Encoding.UTF8.GetByteCount(jwt.Key) < 32)
    throw new InvalidOperationException("Configuração ausente ou curta: Jwt:Key (mínimo de 32 caracteres).");

var fusoHorario = builder.Configuration["App:FusoHorario"] ?? "America/Sao_Paulo";
var origensCors = builder.Configuration.GetSection("Cors:Origens").Get<string[]>() ?? [];

// Armazenamento de arquivos (MinIO): variáveis S3_* do guia-minIO-conexao-sql.md.
var isCliSeedCommand = args.Contains("seed-dev") || args.Contains("reset-dev");
var armazenamento = isCliSeedCommand ? null : ArmazenamentoOpcoes.Ler(builder.Configuration);

// Colunas snake_case do banco -> propriedades PascalCase.
DefaultTypeMap.MatchNamesWithUnderscores = true;

// ---------- Serviços ----------
builder.Services.AddSingleton(jwt);
builder.Services.AddSingleton(new DbConnectionFactory(connectionString));
builder.Services.AddSingleton(new AppClock(fusoHorario));
builder.Services.AddSingleton<PasswordService>();
builder.Services.AddSingleton<TokenService>();

builder.Services.AddScoped<AuthRepository>();
builder.Services.AddScoped<MaterialRepository>();
builder.Services.AddScoped<FavoritoRepository>();
builder.Services.AddScoped<PedidoRepository>();
builder.Services.AddScoped<PedidoService>();
builder.Services.AddScoped<NotificacaoService>();
builder.Services.AddScoped<MaterialService>();
builder.Services.AddScoped<EstoqueRepository>();
builder.Services.AddScoped<MovimentacaoService>();
builder.Services.AddScoped<AtendimentoPedidoService>();
builder.Services.AddScoped<UsuarioRepository>();
builder.Services.AddScoped<UsuarioService>();
builder.Services.AddScoped<SetorRepository>();
builder.Services.AddScoped<AmbienteRepository>();
builder.Services.AddScoped<AmbienteService>();
builder.Services.AddScoped<PatrimonioRepository>();
builder.Services.AddScoped<PatrimonioService>();
builder.Services.AddScoped<DashboardRepository>();
builder.Services.AddScoped<RemessaRepository>();
if (armazenamento is not null)
{
    builder.Services.AddScoped<RemessaService>();
    builder.Services.AddSingleton(armazenamento);
    builder.Services.AddSingleton<ArmazenamentoArquivosBase, ArmazenamentoMinio>();
}
builder.Services.AddScoped<DevSeeder>();

builder.Services
    .AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull)
    .ConfigureApiBehaviorOptions(o => o.InvalidModelStateResponseFactory = ctx =>
    {
        var erros = ctx.ModelState
            .Where(e => e.Value?.Errors.Count > 0)
            .ToDictionary(e => e.Key, e => e.Value!.Errors.Select(x => x.ErrorMessage).ToArray());
        return new BadRequestObjectResult(new ErrorResponse("Dados inválidos na requisição.", erros));
    });

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.MapInboundClaims = false;
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = jwt.ChaveAssinatura(),
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1),
            NameClaimType = "name",
            RoleClaimType = "role"
        };
        o.Events = new JwtBearerEvents
        {
            OnChallenge = async ctx =>
            {
                ctx.HandleResponse();
                ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await ctx.Response.WriteAsJsonAsync(new ErrorResponse("Sessão expirada ou inválida. Faça login novamente."));
            },
            OnForbidden = async ctx =>
            {
                ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
                await ctx.Response.WriteAsJsonAsync(new ErrorResponse("Seu perfil não tem permissão para esta operação."));
            }
        };
    });

// Por padrão todo endpoint exige login; os públicos usam [AllowAnonymous].
builder.Services.AddAuthorization(o =>
    o.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());

builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
{
    if (builder.Environment.IsDevelopment())
    {
        p.SetIsOriginAllowed(origin =>
        {
            if (origensCors.Contains(origin, StringComparer.OrdinalIgnoreCase))
                return true;
            if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri))
                return false;
            if (uri.Scheme != Uri.UriSchemeHttp || (uri.Port != 5173 && uri.Port != 5174))
                return false;
            if (!System.Net.IPAddress.TryParse(uri.Host, out var ip) ||
                ip.AddressFamily != System.Net.Sockets.AddressFamily.InterNetwork)
                return false;
            var b = ip.GetAddressBytes();
            // Aceita sub-redes privadas RFC 1918 (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) e loopback (127.0.0.0/8)
            return b[0] == 10
                || (b[0] == 172 && b[1] >= 16 && b[1] <= 31)
                || (b[0] == 192 && b[1] == 168)
                || b[0] == 127;
        }).AllowAnyHeader().AllowAnyMethod();
    }
    else
    {
        p.WithOrigins(origensCors).AllowAnyHeader().AllowAnyMethod();
    }
}));

// Limita tentativas de login por IP (proteção contra força bruta).
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.AddPolicy("login", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "desconhecido",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) }));
    o.OnRejected = async (ctx, ct) =>
        await ctx.HttpContext.Response.WriteAsJsonAsync(
            new ErrorResponse("Muitas tentativas de login. Aguarde um minuto e tente novamente."), ct);
});

builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddProblemDetails();

var app = builder.Build();

// ---------- Comandos de inicialização e reset de desenvolvimento ----------
if (args.Contains("reset-dev"))
{
    if (!app.Environment.IsDevelopment())
        throw new InvalidOperationException("reset-dev só pode ser executado com ASPNETCORE_ENVIRONMENT=Development.");
    if (!args.Contains("--confirm"))
        throw new InvalidOperationException("O comando reset-dev exige o parâmetro explícito '--confirm' para evitar execução acidental.");
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<DevSeeder>().ResetarAmbienteLocalAsync();
    return;
}

if (args.Contains("seed-dev"))
{
    if (!app.Environment.IsDevelopment())
        throw new InvalidOperationException("seed-dev só pode ser executado com ASPNETCORE_ENVIRONMENT=Development.");
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<DevSeeder>().ExecutarAsync();
    return;
}

if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<DevSeeder>().ExecutarAsync();
}

app.UseExceptionHandler();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.Use(async (ctx, next) =>
{
    if (ctx.User.Identity?.IsAuthenticated == true &&
        ctx.User.FindFirst(UsuarioAtual.ClaimTrocaSenhaObrigatoria)?.Value == "1")
    {
        var path = ctx.Request.Path.Value ?? string.Empty;
        var permitido = path.Equals("/api/auth/alterar-senha", StringComparison.OrdinalIgnoreCase)
                     || path.Equals("/api/auth/logout", StringComparison.OrdinalIgnoreCase);
        if (!permitido)
        {
            ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
            await ctx.Response.WriteAsJsonAsync(
                new ErrorResponse("É obrigatório definir uma nova senha antes de acessar o sistema."));
            return;
        }
    }
    await next();
});
app.UseRateLimiter();

app.MapControllers();
app.MapGet("/api/health", () => Results.Ok(new { status = "ok" })).AllowAnonymous();

app.Run();
