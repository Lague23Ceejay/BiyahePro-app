using Dapper;
using Npgsql;
using RideHailing.API.Models;

namespace RideHailing.API.Repositories;

public interface ISettingsRepository
{
    Task<AppSetting?> GetByKeyAsync(string key);
    Task<IEnumerable<AppSetting>> GetByCategoryAsync(string? category);
    Task UpdateAsync(string key, string value, Guid adminId);
    Task<IEnumerable<object>> GetAuditLogsAsync(int limit = 100);
}

public class SettingsRepository(IConfiguration config) : ISettingsRepository
{
    private NpgsqlConnection Connection() => new(config.GetConnectionString("DefaultConnection"));

    public async Task<AppSetting?> GetByKeyAsync(string key)
    {
        using var db = Connection();
        return await db.QuerySingleOrDefaultAsync<AppSetting>("SELECT id, key, value, data_type, category, label, description, is_public FROM app_settings WHERE key = @Key", new { Key = key });
    }

    public async Task<IEnumerable<AppSetting>> GetByCategoryAsync(string? category)
    {
        using var db = Connection();
        if (category == null)
            return await db.QueryAsync<AppSetting>("SELECT id, key, value, data_type, category, label, description, is_public FROM app_settings");
        return await db.QueryAsync<AppSetting>("SELECT id, key, value, data_type, category, label, description, is_public FROM app_settings WHERE category = @Category", new { Category = category });
    }

    public async Task UpdateAsync(string key, string value, Guid adminId)
    {
        using var db = Connection();
        await db.OpenAsync();
        await using var transaction = await db.BeginTransactionAsync();

        var oldValue = await db.QuerySingleOrDefaultAsync<string>(
            "SELECT value FROM app_settings WHERE key = @Key",
            new { Key = key }, transaction);

        var updated = await db.ExecuteAsync(
            "UPDATE app_settings SET value = @Value, updated_at = NOW(), updated_by = @AdminId WHERE key = @Key",
            new { Key = key, Value = value, AdminId = adminId }, transaction);

        if (updated == 0)
            throw new KeyNotFoundException($"Setting '{key}' was not found.");

        await db.ExecuteAsync("""
            INSERT INTO admin_audit_log
                (admin_id, action, entity_type, entity_id, old_value, new_value)
            VALUES
                (@AdminId, 'UPDATE_SETTING', 'app_settings', @Key,
                 to_jsonb(@OldValue::text), to_jsonb(@NewValue::text))
            """, new { AdminId = adminId, Key = key, OldValue = oldValue ?? string.Empty, NewValue = value }, transaction);

        await transaction.CommitAsync();
    }

    public async Task<IEnumerable<object>> GetAuditLogsAsync(int limit = 100)
    {
        using var db = Connection();
        return await db.QueryAsync("""
            SELECT a.id, a.action, a.entity_type AS "entityType", a.entity_id AS "entityId",
                   a.old_value AS "oldValue", a.new_value AS "newValue", a.created_at AS "createdAt",
                   u.full_name AS "adminName"
            FROM admin_audit_log a
            JOIN users u ON u.id = a.admin_id
            ORDER BY a.created_at DESC
            LIMIT @Limit
            """, new { Limit = Math.Clamp(limit, 1, 500) });
    }
}
