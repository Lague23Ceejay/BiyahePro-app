using Dapper;
using Npgsql;
using RideHailing.API.Models;

namespace RideHailing.API.Repositories;

public interface IBrandingRepository
{
    Task<AppIconAsset?> GetAppIconAsync();
    Task SaveAppIconAsync(byte[] content, string contentType, Guid adminId);
}

public class BrandingRepository(IConfiguration config) : IBrandingRepository
{
    private NpgsqlConnection Connection() => new(config.GetConnectionString("DefaultConnection"));

    public async Task<AppIconAsset?> GetAppIconAsync()
    {
        using var db = Connection();
        return await db.QuerySingleOrDefaultAsync<AppIconAsset>(
            "SELECT content, content_type AS ContentType, updated_at AS UpdatedAt FROM app_brand_assets WHERE asset_key = 'app_icon'");
    }

    public async Task SaveAppIconAsync(byte[] content, string contentType, Guid adminId)
    {
        using var db = Connection();
        await db.OpenAsync();
        await using var transaction = await db.BeginTransactionAsync();

        var oldSize = await db.QuerySingleOrDefaultAsync<int?>(
            "SELECT octet_length(content) FROM app_brand_assets WHERE asset_key = 'app_icon' FOR UPDATE",
            transaction: transaction);

        await db.ExecuteAsync("""
            INSERT INTO app_brand_assets (asset_key, content, content_type, updated_by, updated_at)
            VALUES ('app_icon', @Content, @ContentType, @AdminId, NOW())
            ON CONFLICT (asset_key) DO UPDATE
            SET content = EXCLUDED.content,
                content_type = EXCLUDED.content_type,
                updated_by = EXCLUDED.updated_by,
                updated_at = NOW()
            """, new { Content = content, ContentType = contentType, AdminId = adminId }, transaction);

        await db.ExecuteAsync("""
            INSERT INTO admin_audit_log
                (admin_id, action, entity_type, entity_id, old_value, new_value)
            VALUES
                (@AdminId, 'UPDATE_APP_ICON', 'app_brand_assets', 'app_icon',
                 to_jsonb(@OldValue::text), to_jsonb(@NewValue::text))
            """, new
        {
            AdminId = adminId,
            OldValue = oldSize.HasValue ? $"image/png ({oldSize.Value} bytes)" : "not set",
            NewValue = $"image/png ({content.Length} bytes)",
        }, transaction);

        await transaction.CommitAsync();
    }
}
