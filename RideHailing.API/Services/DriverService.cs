// File path in project: RideHailing.API/Services/DriverService.cs
// ============================================================
// Services/DriverService.cs
// Driver assignment, availability, and management logic
// Separate from TripService to keep each service focused
// ============================================================
using RideHailing.API.Models;
using RideHailing.API.Repositories;

namespace RideHailing.API.Services;

public interface IDriverService
{
    Task<Driver?>                    GetProfileAsync(Guid userId);
    Task<DriverStatusResponse?>      GetStatusAsync(Guid driverId);
    Task<bool>                       SetAvailabilityAsync(Guid userId, bool available);
    Task<bool>                       SuspendAsync(Guid driverId, Guid adminId);
    Task<bool>                       ReinstateAsync(Guid driverId, Guid adminId);
    Task<PagedResult<Driver>>        GetAllAsync(string? status, int page, int pageSize);
    Task<List<NearbyDriverResponse>> GetNearbyAsync(double lat, double lng);
    Task<DriverStrike?>              IssueStrikeAsync(Guid driverId, Guid adminId, string reason);
    Task<List<DriverStrike>>         GetStrikesAsync(Guid driverId);
    Task<bool> UpdateLocationAsync(Guid userId, double lat, double lng);
    Task<DriverEarningsResponse?> GetEarningsAsync(Guid userId);
    Task<Driver?> CompleteProfileAsync(Guid userId, CompleteDriverProfileRequest request);
}

public class DriverService(
    IDriverRepository  driverRepo,
    ISettingsService   settings) : IDriverService
{
    // If a strike-2 (7-day) suspension has expired, auto-lift it before
    // returning the driver — so a stale "suspended" status doesn't linger
    // just because nobody happened to hit an admin endpoint to clear it.
    // Permanent bans (strike 3, SuspendedUntil == null) are untouched here.
    private async Task<Driver> AutoLiftIfExpired(Driver driver)
    {
        if (driver.Status == "suspended" && driver.SuspendedUntil.HasValue && driver.SuspendedUntil.Value <= DateTime.UtcNow)
        {
            await driverRepo.LiftSuspensionAsync(driver.Id);
            driver.Status = "offline";
            driver.SuspendedUntil = null;
        }
        return driver;
    }

    // ── Profile ───────────────────────────────────────────────
    public async Task<Driver?> GetProfileAsync(Guid userId)
    {
        var driver = await driverRepo.GetByUserIdAsync(userId);
        if (driver == null) return null;

        driver = await AutoLiftIfExpired(driver);

        // Attach vehicle to the driver object
        driver.Vehicle = await driverRepo.GetVehicleAsync(driver.Id);
        return driver;
    }

    public async Task<DriverStatusResponse?> GetStatusAsync(Guid driverId)
    {
        var driver = await driverRepo.GetByIdAsync(driverId);
        if (driver == null) return null;

        driver = await AutoLiftIfExpired(driver);

        return new DriverStatusResponse(
            DriverId:        driver.Id,
            Status:          driver.Status,
            Latitude:        driver.Latitude,
            Longitude:       driver.Longitude,
            Rating:          driver.Rating,
            TotalTrips:      driver.TotalTrips,
            DpiReviewFlag:   driver.DpiReviewFlag,
            StrikeCount:     driver.StrikeCount,
            SuspendedUntil:  driver.SuspendedUntil
        );
    }

    // ── Availability toggle ───────────────────────────────────
    public async Task<bool> SetAvailabilityAsync(Guid userId, bool available)
    {
        var driver = await driverRepo.GetByUserIdAsync(userId);
        if (driver == null) return false;

        driver = await AutoLiftIfExpired(driver);

        // Can't go available while suspended or banned
        if (driver.Status is "suspended" or "banned") return false;

        var newStatus = available ? "available" : "offline";
        await driverRepo.UpdateStatusAsync(driver.Id, newStatus);
        return true;
    }

    // ── Admin actions ─────────────────────────────────────────
    public async Task<bool> SuspendAsync(Guid driverId, Guid adminId)
    {
        var driver = await driverRepo.GetByIdAsync(driverId);
        if (driver == null) return false;

        await driverRepo.UpdateStatusAsync(driverId, "suspended");
        return true;
    }

    public async Task<bool> ReinstateAsync(Guid driverId, Guid adminId)
    {
        var driver = await driverRepo.GetByIdAsync(driverId);
        if (driver == null || driver.Status != "suspended") return false;

        await driverRepo.UpdateStatusAsync(driverId, "offline");
        return true;
    }

    // ── Driver Performance Index / Three-Strike Policy (BP §VI, §IX) ──
    public async Task<DriverStrike?> IssueStrikeAsync(Guid driverId, Guid adminId, string reason)
        => await driverRepo.AddStrikeAsync(driverId, reason, adminId);

    public async Task<List<DriverStrike>> GetStrikesAsync(Guid driverId)
        => await driverRepo.GetStrikesAsync(driverId);

    // ── Queries ───────────────────────────────────────────────
    public async Task<PagedResult<Driver>> GetAllAsync(string? status, int page, int pageSize)
        => await driverRepo.GetAllAsync(status, page, pageSize);

    public async Task<List<NearbyDriverResponse>> GetNearbyAsync(double lat, double lng)
    {
        var radiusKm = await settings.GetIntAsync(SettingKeys.OpsDriverRadius, 5);
        return await driverRepo.GetNearbyAsync(lat, lng, radiusKm);
    }

    public async Task<bool> UpdateLocationAsync(Guid userId, double lat, double lng)
{
    var driver = await driverRepo.GetByUserIdAsync(userId);
    if (driver == null) return false;

    await driverRepo.UpdateLocationAsync(driver.Id, lat, lng);
    return true;
}

    public async Task<DriverEarningsResponse?> GetEarningsAsync(Guid userId)
    {
        var driver = await driverRepo.GetByUserIdAsync(userId);
        if (driver == null) return null;
        return await driverRepo.GetEarningsSummaryAsync(driver.Id);
    }

    public async Task<Driver?> CompleteProfileAsync(Guid userId, CompleteDriverProfileRequest request)
    {
        if (request.VehicleType is not ("motorcycle" or "motorcab") || request.Year < 1900 || request.Year > DateTime.UtcNow.Year + 1)
            return null;

        return await driverRepo.SaveProfileAsync(userId, request.LicenseNumber.Trim(), request.LicenseExpiry,
            request.PlateNumber.Trim(), request.Make.Trim(), request.Model.Trim(), request.Color.Trim(),
            request.Year, request.VehicleType);
    }
}