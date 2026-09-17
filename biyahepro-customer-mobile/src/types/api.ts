// File path in project: biyahepro-customer-mobile/src/types/api.ts
export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  role: 'customer' | 'driver' | 'admin';
  userId: string;
  fullName: string;
  rememberDevice?: boolean;
};

export type RegisterPayload = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role?: 'customer';
};

export type FareEstimateRequest = {
  pickupLatitude: number;
  pickupLongitude: number;
  dropoffLatitude: number;
  dropoffLongitude: number;
};

export type FareEstimate = {
  baseFare: number;
  estimatedDistanceFare: number;
  bookingFee: number;
  estimatedTotal: number;
  surgeMultiplier: number;
  estimatedDistanceKm: number;
  estimatedMinutes: number;
};

export type BookTripRequest = FareEstimateRequest & {
  pickupAddress: string;
  dropoffAddress: string;
  paymentMethod: 'cash' | 'gcash' | 'card';
  scheduledFor?: string | null;
  vehicleType: 'motorcycle' | 'motorcab';
};

export type Trip = {
  id: string;
  customerId: string;
  driverId?: string | null;
  pickupAddress: string;
  dropoffAddress: string;
  status: string;
  fareAmount: number;
  paymentMethod: string;
  vehicleType: 'motorcycle' | 'motorcab';
  scheduledFor?: string | null;
  driverName?: string | null;
  plateNumber?: string | null;
  requestedAt: string;
  completedAt?: string | null;
};

export type RateTripPayload = {
  score: number;
  comment?: string;
};

export type PagedResult<T> = {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
