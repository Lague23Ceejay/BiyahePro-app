// File path in project: RideHailing.API/Program.cs
// ============================================================
// Program.cs — Entry point, DI registration, middleware pipeline
// ============================================================
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using RideHailing.API.Hubs;
using RideHailing.API.Middleware;
using RideHailing.API.Repositories;
using RideHailing.API.Services;

// Our SQL uses snake_case columns (full_name, password_hash, is_active, ...)
// while our C# models use PascalCase (FullName, PasswordHash, IsActive, ...).
// Dapper does NOT bridge that gap by default — without this line every
// "SELECT * FROM ..." silently leaves those properties null instead of
// throwing, which is how a null PasswordHash reached BCrypt.Verify and
// crashed login with an unhandled 500. This must run before any Dapper
// query executes, so it goes at the very top of Program.cs.
Dapper.DefaultTypeMap.MatchNamesWithUnderscores = true;

var builder = WebApplication.CreateBuilder(args);

// ── Controllers ───────────────────────────────────────────────
builder.Services.AddControllers();

// ── Memory cache (SettingsService uses this) ──────────────────
builder.Services.AddMemoryCache();

// ── JWT Authentication ────────────────────────────────────────
var jwtSecret = builder.Configuration["Jwt:Secret"]
    ?? throw new InvalidOperationException("Jwt:Secret is required in appsettings.json");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer           = true,
            ValidateAudience         = true,
            ValidateLifetime         = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer              = builder.Configuration["Jwt:Issuer"],
            ValidAudience            = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey         = new SymmetricSecurityKey(
                                           Encoding.UTF8.GetBytes(jwtSecret)),
            ClockSkew                = TimeSpan.Zero
        };

        // Allow JWT from SignalR query string
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var token = ctx.Request.Query["access_token"];
                var path  = ctx.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(token) && path.StartsWithSegments("/hubs"))
                    ctx.Token = token;
                return Task.CompletedTask;
            }
        };
    });

// ── Authorization policies ────────────────────────────────────
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly",    p => p.RequireRole("admin"));
    options.AddPolicy("DriverOnly",   p => p.RequireRole("driver"));
    options.AddPolicy("CustomerOnly", p => p.RequireRole("customer"));
    options.AddPolicy("CanEditFares", p => p.RequireRole("admin"));
});

// ── SignalR ───────────────────────────────────────────────────
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = builder.Environment.IsDevelopment();
    options.KeepAliveInterval   = TimeSpan.FromSeconds(15);
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(60);
});

// ── CORS ──────────────────────────────────────────────────────
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader());
});

// ── Repositories (Scoped = one per HTTP request) ──────────────
builder.Services.AddScoped<IUserRepository,     UserRepository>();
builder.Services.AddScoped<IDriverRepository,   DriverRepository>();
builder.Services.AddScoped<ITripRepository,     TripRepository>();
builder.Services.AddScoped<ISettingsRepository, SettingsRepository>();

// ── Services ──────────────────────────────────────────────────
builder.Services.AddScoped<IAuthService,    AuthService>();
builder.Services.AddScoped<ITripService,    TripService>();
builder.Services.AddScoped<IFareService,    FareService>();
builder.Services.AddScoped<IDriverService,  DriverService>();

// Singleton: SettingsService has a shared in-memory cache
builder.Services.AddScoped<ISettingsService, SettingsService>();
builder.Services.AddHostedService<ScheduledTripActivationService>();

// ── Build ─────────────────────────────────────────────────────
var app = builder.Build();

// ── Middleware pipeline (ORDER MATTERS) ───────────────────────
if (app.Environment.IsDevelopment())
    app.UseDeveloperExceptionPage();

app.UseCors("AllowAll");
app.UseAuthentication();    // 1. Validate JWT
app.UseAuthorization();     // 2. Check roles/policies
app.UseAuditLogging();      // 3. Log admin writes AFTER auth so we know who the user is

app.MapControllers();
app.MapHub<RideHub>("/hubs/ride");

app.Run();