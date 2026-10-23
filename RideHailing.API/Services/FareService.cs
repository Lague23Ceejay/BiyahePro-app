using RideHailing.API.Models;

namespace RideHailing.API.Services;

public interface IFareService
{
    Task<FareEstimateResponse> EstimateAsync(FareEstimateRequest request);
}

public class FareService(ISettingsService settings) : IFareService
{
    public async Task<FareEstimateResponse> EstimateAsync(FareEstimateRequest req)
    {
        if (!double.IsFinite(req.PickupLatitude) || req.PickupLatitude is < -90 or > 90 ||
            !double.IsFinite(req.PickupLongitude) || req.PickupLongitude is < -180 or > 180 ||
            !double.IsFinite(req.DropoffLatitude) || req.DropoffLatitude is < -90 or > 90 ||
            !double.IsFinite(req.DropoffLongitude) || req.DropoffLongitude is < -180 or > 180)
            throw new InvalidOperationException("Choose valid pickup and destination coordinates.");

        var serviceLatitude = (double)await settings.GetDecimalAsync(SettingKeys.ServiceAreaLatitude, 8.6549m);
        var serviceLongitude = (double)await settings.GetDecimalAsync(SettingKeys.ServiceAreaLongitude, 123.4243m);
        var serviceRadiusKm = (double)await settings.GetDecimalAsync(SettingKeys.ServiceAreaRadiusKm, 20m);
        if (!double.IsFinite(serviceLatitude) || serviceLatitude is < -90 or > 90 ||
            !double.IsFinite(serviceLongitude) || serviceLongitude is < -180 or > 180 ||
            !double.IsFinite(serviceRadiusKm) || serviceRadiusKm <= 0 || serviceRadiusKm > 1000)
            throw new InvalidOperationException("The booking service area is not configured correctly. Please contact support.");

        EnsureWithinServiceArea(req.PickupLatitude, req.PickupLongitude, serviceLatitude, serviceLongitude, serviceRadiusKm, "Pickup");
        EnsureWithinServiceArea(req.DropoffLatitude, req.DropoffLongitude, serviceLatitude, serviceLongitude, serviceRadiusKm, "Destination");

        var destinationFare = OfficialFareSchedule.GetNearestDestinationFare(
            req.DropoffZoneId, req.DropoffPlaceId, req.DropoffLatitude, req.DropoffLongitude);
        var regularBaseFare = destinationFare.RegularFare;
        var discountedBaseFare = Math.Round(
            regularBaseFare * (1m - OfficialFareSchedule.SpScDiscount), 2, MidpointRounding.AwayFromZero);
        var bookingFee = await settings.GetDecimalAsync(SettingKeys.FareBookingFee, 5m);
        var distKm = HaversineKm(req.PickupLatitude, req.PickupLongitude,
                                 req.DropoffLatitude, req.DropoffLongitude);
        var estimatedMinutes = (int)(distKm / 25.0 * 60);
        return new FareEstimateResponse(
            BaseFare: regularBaseFare,
            EstimatedDistanceFare: 0m,
            BookingFee: bookingFee,
            EstimatedTotal: regularBaseFare + bookingFee,
            DiscountedBaseFare: req.SpScRequested ? discountedBaseFare : null,
            DiscountedTotal: req.SpScRequested ? discountedBaseFare + bookingFee : null,
            SpScRequested: req.SpScRequested,
            SurgeMultiplier: 1.0m,
            EstimatedDistanceKm: Math.Round(distKm, 2),
            EstimatedMinutes: estimatedMinutes,
            FareBasis: destinationFare.Name
        );
    }

    private static void EnsureWithinServiceArea(
        double latitude,
        double longitude,
        double centerLatitude,
        double centerLongitude,
        double radiusKm,
        string pointName)
    {
        if (HaversineKm(latitude, longitude, centerLatitude, centerLongitude) > radiusKm)
            throw new InvalidOperationException($"{pointName} is outside the service area. Move the pin inside the orange circle on the map.");
    }

    private static double HaversineKm(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6371; // Earth's radius in kilometers
        var dLat = ToRad(lat2 - lat1);
        var dLon = ToRad(lon2 - lon1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
              + Math.Cos(ToRad(lat1)) * Math.Cos(ToRad(lat2))
              * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return R * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }

    private static double ToRad(double deg) => deg * Math.PI / 180;
}