namespace RideHailing.API.Services;

public sealed record OfficialFareRoute(
    string ZoneId,
    string PlaceId,
    string Name,
    decimal RegularFare,
    double Latitude,
    double Longitude);

public static class OfficialFareSchedule
{
    public const decimal SpScDiscount = 0.20m;

    private static readonly IReadOnlyDictionary<(string ZoneId, string PlaceId), OfficialFareRoute> Routes =
        new Dictionary<(string ZoneId, string PlaceId), OfficialFareRoute>
        {
            [("zone-1", "within-poblacion")] = new("zone-1", "within-poblacion", "Within the Dapitan Island Poblacion", 15m, 8.6549, 123.4243),
            [("zone-2", "polo")] = new("zone-2", "polo", "Polo", 20m, 8.6319, 123.4104),
            [("zone-2", "sulangon")] = new("zone-2", "sulangon", "Sulangon", 15m, 8.6124, 123.4179),
            [("zone-2", "oyan")] = new("zone-2", "oyan", "Oyan", 22m, 8.5849, 123.4105),
            [("zone-2", "burgos")] = new("zone-2", "burgos", "Burgos", 30m, 8.5602, 123.4207),
            [("zone-2", "ilaya")] = new("zone-2", "ilaya", "Ilaya", 35m, 8.5448, 123.4313),
            [("zone-2", "barcelona")] = new("zone-2", "barcelona", "Barcelona", 40m, 8.5316, 123.4493),
            [("zone-2", "opao")] = new("zone-2", "opao", "Opao", 45m, 8.5354, 123.4768),
            [("zone-2", "potungan")] = new("zone-2", "potungan", "Potungan", 50m, 8.5411, 123.4932),
            [("zone-2", "dampalan")] = new("zone-2", "dampalan", "Dampalan", 60m, 8.5222, 123.4962),
            [("zone-3", "san-pedro")] = new("zone-3", "san-pedro", "San Pedro", 12m, 8.6246, 123.3912),
            [("zone-3", "san-vicente")] = new("zone-3", "san-vicente", "San Vicente", 20m, 8.6351, 123.3819),
            [("zone-3", "owaon")] = new("zone-3", "owaon", "Owaon", 20m, 8.6189, 123.3863),
            [("zone-3", "liyang")] = new("zone-3", "liyang", "Liyang", 20m, 8.6301, 123.3680),
            [("zone-3", "larayan")] = new("zone-3", "larayan", "Larayan", 26m, 8.6173, 123.3750),
            [("zone-4", "talisay")] = new("zone-4", "talisay", "Talisay", 16m, 8.6663, 123.4194),
            [("zone-4", "santo-nino")] = new("zone-4", "santo-nino", "Sto. Niño", 20m, 8.6815, 123.4275),
            [("zone-4", "taguilon")] = new("zone-4", "taguilon", "Taquilon", 35m, 8.6977, 123.4047),
            [("zone-4", "canlucani")] = new("zone-4", "canlucani", "Canlucan", 60m, 8.7106, 123.3806),
            [("zone-4", "tag-ulo")] = new("zone-4", "tag-ulo", "Tag-ulo", 60m, 8.7187, 123.3817),
            [("zone-4", "guimputlan-60")] = new("zone-4", "guimputlan-60", "Guimputlan (₱60 fare listing)", 60m, 8.7232, 123.3994),
            [("zone-4", "guimputlan-70")] = new("zone-4", "guimputlan-70", "Guimputlan (₱70 fare listing)", 70m, 8.7232, 123.3994),
            [("zone-4", "banbanan")] = new("zone-4", "banbanan", "Banganan", 60m, 8.7177, 123.4239),
            [("zone-4", "carang")] = new("zone-4", "carang", "Carang", 40m, 8.7069, 123.4309),
            [("zone-5-6", "sinonoc")] = new("zone-5-6", "sinonoc", "Binonoc", 20m, 8.6688, 123.4392),
            [("zone-5-6", "oro")] = new("zone-5-6", "oro", "Oro", 30m, 8.6753, 123.4588),
            [("zone-5-6", "napo")] = new("zone-5-6", "napo", "Napo", 40m, 8.6839, 123.4841),
            [("zone-5-6", "baylimango")] = new("zone-5-6", "baylimango", "Baylimango", 40m, 8.6983, 123.4403),
            [("zone-5-6", "kauswagan")] = new("zone-5-6", "kauswagan", "Kauswagan", 40m, 8.6679, 123.4652),
            [("zone-5-6", "daro")] = new("zone-5-6", "daro", "Daro", 60m, 8.6627, 123.4770)
        };

    public static OfficialFareRoute GetNearestDestinationFare(
        string? dropoffZoneId,
        string? dropoffPlaceId,
        double dropoffLatitude,
        double dropoffLongitude)
    {
        if (!double.IsFinite(dropoffLatitude) || !double.IsFinite(dropoffLongitude))
            throw new InvalidOperationException("Choose a valid destination on the map.");

        if (Routes.TryGetValue((dropoffZoneId ?? "", dropoffPlaceId ?? ""), out var selectedRoute) &&
            DistanceKm(dropoffLatitude, dropoffLongitude, selectedRoute.Latitude, selectedRoute.Longitude) <= 1.5)
            return selectedRoute;

        return Routes.Values
            .MinBy(route => DistanceKm(dropoffLatitude, dropoffLongitude, route.Latitude, route.Longitude))!;
    }

    private static double DistanceKm(double lat1, double lon1, double lat2, double lon2)
    {
        if (!double.IsFinite(lat2) || !double.IsFinite(lon2)) return double.PositiveInfinity;
        const double earthRadiusKm = 6371;
        var latDifference = (lat2 - lat1) * Math.PI / 180;
        var lonDifference = (lon2 - lon1) * Math.PI / 180;
        var a = Math.Sin(latDifference / 2) * Math.Sin(latDifference / 2)
            + Math.Cos(lat1 * Math.PI / 180) * Math.Cos(lat2 * Math.PI / 180)
            * Math.Sin(lonDifference / 2) * Math.Sin(lonDifference / 2);
        return earthRadiusKm * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }
}
