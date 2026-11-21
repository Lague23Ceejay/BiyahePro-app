namespace RideHailing.API.Models;

public record AppIconAsset(byte[] Content, string ContentType, DateTime UpdatedAt);

public record WebsiteImageAsset(byte[] Content, string ContentType, DateTime UpdatedAt);
