// File path in project: RideHailing.API/Controllers/AuthController.cs
using Microsoft.AspNetCore.Mvc;
using RideHailing.API.Models;
using RideHailing.API.Services;

namespace RideHailing.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(IAuthService authService) : ControllerBase
{
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        var (result, error) = await authService.RegisterAsync(request);
        if (result == null) return BadRequest(new { message = error ?? "Registration failed." });
        return Ok(result);
    }

    // POST: api/auth/register-driver (Creates the user, driver profile, and vehicle together)
    [HttpPost("register-driver")]
    public async Task<IActionResult> RegisterDriver([FromBody] RegisterDriverRequest request)
    {
        var (result, error) = await authService.RegisterDriverAsync(request);
        if (result == null) return BadRequest(new { message = error ?? "Driver registration failed." });
        return Ok(result);
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var result = await authService.LoginAsync(request);
        if (result == null) return Unauthorized();
        return Ok(result);
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] string refreshToken)
    {
        var result = await authService.RefreshTokenAsync(refreshToken);
        if (result == null) return Unauthorized();
        return Ok(result);
    }

    [HttpPost("revoke")]
    public async Task<IActionResult> Revoke([FromBody] string refreshToken)
    {
        await authService.RevokeRefreshTokenAsync(refreshToken);
        return NoContent();
    }
}