using Dapper;
using Npgsql;
using RideHailing.API.Models;

namespace RideHailing.API.Repositories;

public interface IBrandingRepository
{
    Task<AppIconAsset?> GetAppIconAsync(string assetKey);
    Task SaveAppIconAsync(string assetKey, byte[] content, string contentType, Guid adminId);
}

public class BrandingRepository(IConfiguration config) : IBrandingRepository
{
    private NpgsqlConnection Connection() => new(config.GetConnectionString("DefaultConnection"));

    public async Task<AppIconAsset?> GetAppIconAsync(string assetKey)
    {
        using var db = Connection();
        return await db.QuerySingleOrDefaultAsync<AppIconAsset>(
            "SELECT content, content_type AS ContentType, updated_at AS UpdatedAt FROM app_brand_assets WHERE asset_key = @AssetKey",
            new { AssetKey = assetKey });
    }

    public async Task SaveAppIconAsync(string assetKey, byte[] content, string contentType, Guid adminId)
    {
        using var db = Connection();
        await db.OpenAsync();
        await using var transaction = await db.BeginTransactionAsync();

        var oldSize = await db.QuerySingleOrDefaultAsync<int?>(
            "SELECT octet_length(content) FROM app_brand_assets WHERE asset_key = @AssetKey FOR UPDATE",
            new { AssetKey = assetKey },
            transaction: transaction);

        await db.ExecuteAsync("""
            INSERT INTO app_brand_assets (asset_key, content, content_type, updated_by, updated_at)
            VALUES (@AssetKey, @Content, @ContentType, @AdminId, NOW())
            ON CONFLICT (asset_key) DO UPDATE
            SET content = EXCLUDED.content,
                content_type = EXCLUDED.content_type,
                updated_by = EXCLUDED.updated_by,
                updated_at = NOW()
            """, new { AssetKey = assetKey, Content = content, ContentType = contentType, AdminId = adminId }, transaction);

        await db.ExecuteAsync("""
            INSERT INTO admin_audit_log
                (admin_id, action, entity_type, entity_id, old_value, new_value)
            VALUES
                (@AdminId, @Action, 'app_brand_assets', @AssetKey,
                 to_jsonb(@OldValue::text), to_jsonb(@NewValue::text))
            """, new
        {
            AdminId = adminId,
            Action = $"UPDATE_{assetKey.ToUpperInvariant()}",
            AssetKey = assetKey,
            OldValue = oldSize.HasValue ? $"image/png ({oldSize.Value} bytes)" : "not set",
            NewValue = $"image/png ({content.Length} bytes)",
        }, transaction);

        await transaction.CommitAsync();
    }
}
