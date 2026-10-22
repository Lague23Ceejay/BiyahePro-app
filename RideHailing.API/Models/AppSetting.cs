// File path in project: RideHailing.API/Models/AppSetting.cs
// ============================================================
// Models/AppSetting.cs
// App settings domain model — maps to app_settings DB table
// Every configurable value in the system lives here
// ============================================================
namespace RideHailing.API.Models;

// ── Domain Model ──────────────────────────────────────────────
public class AppSetting
{
    public Guid     Id          { get; set; }
    public string   Key         { get; set; } = string.Empty;
    public string   Value       { get; set; } = string.Empty;

    // string | number | boolean | json
    public string   DataType    { get; set; } = "string";

    // fare | surge | operations | features | notifications | general
    public string   Category    { get; set; } = "general";

    // Human-readable label shown in admin dashboard
    public string   Label       { get; set; } = string.Empty;
    public string?  Description { get; set; }

    // true = safe to expose to mobile app (e.g. surge multiplier, feature flags)
    public bool     IsPublic    { get; set; } = false;

    public Guid?    UpdatedBy   { get; set; }
    public DateTime UpdatedAt   { get; set; }
}

// ── Grouped response for admin dashboard ─────────────────────
public class SettingsCategoryGroup
{
    public string           Category { get; set; } = string.Empty;
    public List<AppSetting> Settings { get; set; } = [];
}

// ── Typed helpers — used internally by SettingsService ────────
// These constants match the keys in 06_seed.sql exactly
// so there are no magic strings scattered around the codebase
public static class SettingKeys
{
    // Fare
    public const string FareCancellationFee  = "fare.cancellation_fee";
    public const string FareBookingFee       = "fare.booking_fee";

    // Surge
    public const string SurgeEnabled         = "surge.enabled";
    public const string SurgeMultiplier      = "surge.multiplier";
    public const string SurgeMaxMultiplier   = "surge.max_multiplier";
    public const string SurgeTrigger         = "surge.trigger_threshold";

    // Operations
    public const string OpsDriverRadius      = "ops.driver_search_radius_km";
    public const string OpsCancelWindow      = "ops.cancel_window_minutes";
    public const string OpsDriverTimeout     = "ops.driver_arrival_timeout";
    public const string OpsPingInterval      = "ops.location_ping_seconds";
    public const string OpsMaxTripsPerDriver = "ops.max_active_trips_driver";
    public const string OpsScheduledMinLeadMins = "ops.scheduled_min_lead_minutes";

    // Features
    public const string FeatureCash          = "feature.cash_payment";
    public const string FeatureGcash         = "feature.gcash_payment";
    public const string FeatureCard          = "feature.card_payment";
    public const string FeatureScheduled     = "feature.scheduled_rides";
    public const string FeatureRideSharing   = "feature.ride_sharing";
    public const string FeatureRatingRequired= "feature.driver_rating_required";

    // Notifications
    public const string NotifDriverAccepted  = "notif.driver_accepted_msg";
    public const string NotifDriverArrived   = "notif.driver_arrived_msg";
    public const string NotifTripCompleted   = "notif.trip_completed_msg";
}