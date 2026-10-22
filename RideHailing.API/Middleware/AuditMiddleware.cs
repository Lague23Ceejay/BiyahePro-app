// ============================================================
// Middleware/AuditMiddleware.cs
// Intercepts every mutating HTTP request (POST/PATCH/PUT/DELETE)
// made by an admin and writes to admin_audit_log in the DB.
// Registered in Program.cs AFTER UseAuthentication().
// ============================================================
using System.Security.Claims;
using System.Text;
using Dapper;
using Npgsql;

namespace RideHailing.API.Middleware;

public class AuditMiddleware(RequestDelegate next, IConfiguration config)
{
    // Only audit write methods from admin users
    private static readonly HashSet<string> AuditedMethods =
        ["POST", "PUT", "PATCH", "DELETE"];

    // Skip noisy routes and binary icon uploads, which are audited in the branding repository.
    private static readonly string[] SkippedPrefixes =
        ["/api/auth", "/api/settings/public", "/api/branding/app-icon", "/hubs"];

    public async Task InvokeAsync(HttpContext context)
    {
        var method = context.Request.Method;
        var path   = context.Request.Path.Value ?? "";

        bool shouldAudit =
            AuditedMethods.Contains(method) &&
            !SkippedPrefixes.Any(p => path.StartsWith(p, StringComparison.OrdinalIgnoreCase));

        if (!shouldAudit)
        {
            await next(context);
            return;
        }

        // Only log if the user is an admin
        var role = context.User.FindFirst(ClaimTypes.Role)?.Value;
        if (role != "admin")
        {
            await next(context);
            return;
        }

        var adminIdClaim = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (adminIdClaim == null)
        {
            await next(context);
            return;
        }

        // Read request body (we need to buffer it so it can still be read downstream)
        context.Request.EnableBuffering();
        var requestBody = string.Empty;
        if (context.Request.ContentLength > 0)
        {
            using var reader = new StreamReader(
                context.Request.Body,
                Encoding.UTF8,
                leaveOpen: true);
            requestBody = await reader.ReadToEndAsync();
            context.Request.Body.Position = 0; // rewind for the controller
        }

        // Capture the response too
        var originalBody    = context.Response.Body;
        using var respBuffer = new MemoryStream();
        context.Response.Body = respBuffer;

        await next(context); // Run the actual controller

        var statusCode = context.Response.StatusCode;

        respBuffer.Position = 0;
        var responseBody = await new StreamReader(respBuffer).ReadToEndAsync();
        respBuffer.Position = 0;
        await respBuffer.CopyToAsync(originalBody);
        context.Response.Body = originalBody;

        // Only audit successful writes (2xx)
        if (statusCode < 200 || statusCode >= 300) return;

        // Extract entity type from URL: /api/drivers/xxx → "drivers"
        var segments   = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
        var entityType = segments.Length >= 2 ? segments[1] : path;
        var entityId   = segments.Length >= 3 ? segments[2] : null;

        try
        {
            using var db = new NpgsqlConnection(config.GetConnectionString("DefaultConnection"));
            await db.ExecuteAsync("""
                INSERT INTO admin_audit_log
                    (admin_id, action, entity_type, entity_id, old_value, new_value)
                VALUES
                    (@AdminId, @Action, @EntityType, @EntityId,
                     NULL,
                     @NewValue::jsonb)
                """,
                new
                {
                    AdminId    = Guid.Parse(adminIdClaim),
                    Action     = $"{method}_{entityType.ToUpper()}",
                    EntityType = entityType,
                    EntityId   = entityId,
                    NewValue   = string.IsNullOrWhiteSpace(requestBody) ? "{}" : requestBody
                });
        }
        catch (Exception ex)
        {
            // Never let audit logging crash the request — just log to console
            Console.WriteLine($"[AuditMiddleware] Failed to write audit log: {ex.Message}");
        }
    }
}

// ── Extension method for clean registration in Program.cs ────
public static class AuditMiddlewareExtensions
{
    public static IApplicationBuilder UseAuditLogging(this IApplicationBuilder app)
        => app.UseMiddleware<AuditMiddleware>();
}