using Microsoft.Extensions.Caching.Memory;
using RideHailing.API.Repositories;

namespace RideHailing.API.Services;

public interface ISettingsService
{
    Task<string> GetAsync(string key, string defaultValue = "");
    Task<decimal> GetDecimalAsync(string key, decimal defaultValue = 0);
    Task<int> GetIntAsync(string key, int defaultValue = 0);
    Task<bool> GetBoolAsync(string key, bool defaultValue = false);
    Task InvalidateCacheAsync(string key);
}

public class SettingsService(ISettingsRepository repo, IMemoryCache cache) : ISettingsService
{
    private const string CachePrefix = "setting:";
    private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(60);

    public async Task<string> GetAsync(string key, string defaultValue = "")
    {
        var cacheKey = CachePrefix + key;
        if (cache.TryGetValue(cacheKey, out string? cached))
            return cached ?? defaultValue;

        var setting = await repo.GetByKeyAsync(key);
        var value = setting?.Value ?? defaultValue;
        cache.Set(cacheKey, value, CacheTtl);
        return value;
    }

    public async Task<decimal> GetDecimalAsync(string key, decimal defaultValue = 0)
    {
        var val = await GetAsync(key, defaultValue.ToString());
        return decimal.TryParse(val, out var result) ? result : defaultValue;
    }

    public async Task<int> GetIntAsync(string key, int defaultValue = 0)
    {
        var val = await GetAsync(key, defaultValue.ToString());
        return int.TryParse(val, out var result) ? result : defaultValue;
    }

    public async Task<bool> GetBoolAsync(string key, bool defaultValue = false)
    {
        var val = await GetAsync(key, defaultValue.ToString());
        return bool.TryParse(val, out var result) ? result : defaultValue;
    }

    public Task InvalidateCacheAsync(string key)
    {
        cache.Remove(CachePrefix + key);
        return Task.CompletedTask;
    }
}
