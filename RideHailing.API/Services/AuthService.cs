// File path in project: RideHailing.API/Services/AuthService.cs
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using RideHailing.API.Models;
using RideHailing.API.Repositories;

namespace RideHailing.API.Services;

public interface IAuthService
{
    Task<(AuthResponse? Response, string? Error)> RegisterAsync(RegisterRequest request);
    Task<AuthResponse?> LoginAsync(LoginRequest request);
    Task<AuthResponse?> RefreshTokenAsync(string refreshToken);
    Task RevokeRefreshTokenAsync(string refreshToken);
    Task<(AuthResponse? Response, string? Error)> RegisterDriverAsync(RegisterDriverRequest request);
}

public class AuthService(
    IUserRepository userRepo,
    IDriverRepository driverRepo,
    IConfiguration config) : IAuthService
{
    public async Task<(AuthResponse? Response, string? Error)> RegisterAsync(RegisterRequest request)
    {
        var email = request.Email.ToLowerInvariant();

        // BUG FIX: this previously only checked email — phone also has a
        // UNIQUE constraint in the database (01_users.sql), but nothing
        // checked it here. A duplicate phone (even under a brand new
        // email) hit the DB constraint directly and threw an unhandled
        // PostgresException, surfacing to the client as a bare 500 with
        // no useful message.
        if (await userRepo.GetByEmailAsync(email) != null)
            return (null, "Email already exists.");
        if (await userRepo.GetByPhoneAsync(request.Phone) != null)
            return (null, "Phone number already registered.");

        var user = new User
        {
            FullName     = request.FullName,
            Email        = email,
            Phone        = request.Phone,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role         = request.Role,
        };

        try
        {
            var created = await userRepo.CreateAsync(user);
            return (BuildAuthResponse(created), null);
        }
        catch (Npgsql.PostgresException ex) when (ex.SqlState == Npgsql.PostgresErrorCodes.UniqueViolation)
        {
            // Defense-in-depth for the race between the checks above and
            // this insert (two concurrent registrations with the same
            // email/phone), and for any unique constraint added later
            // that this method doesn't explicitly check for yet.
            return (null, "Email or phone number already registered.");
        }
    }

    // Driver self-registration — creates the users row, the matching
// drivers row, and the vehicle row together. Previously the driver
// app called the generic RegisterAsync above with role="driver",
// which only ever created a users row: every driver-specific
// endpoint (/api/drivers/me and everything under it) 404'd
// immediately afterward since no drivers row ever existed.
    public async Task<(AuthResponse? Response, string? Error)> RegisterDriverAsync(RegisterDriverRequest request)
    {
        var email = request.Email.ToLowerInvariant();

        if (await userRepo.GetByEmailAsync(email) != null)
            return (null, "Email already exists.");
        if (await userRepo.GetByPhoneAsync(request.Phone) != null)
            return (null, "Phone number already registered.");

        var user = new User
        {
            FullName     = request.FullName,
            Email        = email,
            Phone        = request.Phone,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role         = "driver",
        };

        User created;
        try
        {
            created = await userRepo.CreateAsync(user);
        }
        catch (Npgsql.PostgresException ex) when (ex.SqlState == Npgsql.PostgresErrorCodes.UniqueViolation)
        {
            return (null, "Email or phone number already registered.");
        }

        Driver driver;
        try
        {
            driver = await driverRepo.CreateAsync(created.Id, request.LicenseNumber, request.LicenseExpiry);
        }
        catch (Npgsql.PostgresException ex) when (ex.SqlState == Npgsql.PostgresErrorCodes.UniqueViolation)
        {
            return (null, "License number already registered.");
        }

        try
        {
            await driverRepo.CreateVehicleAsync(driver.Id, request.PlateNumber, request.Make, request.Model, request.Color, request.Year, request.VehicleType);
        }
        catch (Npgsql.PostgresException ex) when (ex.SqlState == Npgsql.PostgresErrorCodes.UniqueViolation)
        {
            return (null, "Plate number already registered.");
        }

        return (BuildAuthResponse(created), null);
    }

    public async Task<AuthResponse?> LoginAsync(LoginRequest request)
    {
        var user = await userRepo.GetByEmailAsync(request.Email.ToLowerInvariant());
        if (user == null || !user.IsActive) return null;
        // Guard against a null/empty hash (e.g. bad mapping, corrupted row) so
        // this fails as "invalid credentials" instead of throwing a 500 —
        // BCrypt.Verify throws on a null/malformed hash rather than returning false.
        if (string.IsNullOrEmpty(user.PasswordHash)) return null;
        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash)) return null;

        var refreshToken = GenerateRefreshToken();
        var expiryDays = config.GetValue<int>("Jwt:RefreshTokenExpiryDays", 7);
        await userRepo.SaveRefreshTokenAsync(user.Id, refreshToken, DateTime.UtcNow.AddDays(expiryDays));

        return BuildAuthResponse(user, refreshToken);
    }

    public async Task<AuthResponse?> RefreshTokenAsync(string refreshToken)
    {
        var userId = await userRepo.ValidateRefreshTokenAsync(refreshToken);
        if (userId == null) return null;

        var user = await userRepo.GetByIdAsync(userId.Value);
        if (user == null || !user.IsActive) return null;

        var newRefreshToken = GenerateRefreshToken();
        var expiryDays = config.GetValue<int>("Jwt:RefreshTokenExpiryDays", 7);
        await userRepo.RevokeRefreshTokenAsync(refreshToken);
        await userRepo.SaveRefreshTokenAsync(user.Id, newRefreshToken, DateTime.UtcNow.AddDays(expiryDays));

        return BuildAuthResponse(user, newRefreshToken);
    }

    public async Task RevokeRefreshTokenAsync(string refreshToken)
        => await userRepo.RevokeRefreshTokenAsync(refreshToken);

    private AuthResponse BuildAuthResponse(User user, string? refreshToken = null)
    {
        var accessToken = GenerateJwt(user);
        refreshToken ??= GenerateRefreshToken();
        return new AuthResponse(accessToken, refreshToken, user.Role, user.Id, user.FullName);
    }

    private string GenerateJwt(User user)
    {
        var secret = config["Jwt:Secret"] ?? throw new InvalidOperationException("JWT secret missing");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiry = config.GetValue<int>("Jwt:AccessTokenExpiryMinutes", 15);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim("full_name", user.FullName),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var token = new JwtSecurityToken(
            issuer: config["Jwt:Issuer"],
            audience: config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expiry),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string GenerateRefreshToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(64);
        return Convert.ToBase64String(bytes);
    }
}