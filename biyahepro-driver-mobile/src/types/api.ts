export type DriverSession = { accessToken: string; refreshToken?: string; userId: string; fullName: string; role: string; driverId?: string };
export type LoginResponse = DriverSession;
export type RegisterPayload = { fullName: string; email: string; phone: string; password: string; role: 'driver' };
export type DriverTrip = { id: string; customerName: string; vehicleType: string; pickup: string; destination: string; fare: number; distance: string; eta: string; status: string };
