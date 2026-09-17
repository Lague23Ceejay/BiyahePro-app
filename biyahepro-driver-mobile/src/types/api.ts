export type DriverSession = { accessToken: string; refreshToken?: string; userId: string; fullName: string; role: string; driverId?: string; rememberDevice?: boolean };
export type LoginResponse = DriverSession;
export type RegisterPayload = {
	fullName: string;
	email: string;
	phone: string;
	password: string;
	licenseNumber: string;
	licenseExpiry: string;
	plateNumber: string;
	make: string;
	model: string;
	color: string;
	year: number;
	vehicleType: 'motorcycle' | 'motorcab';
};
export type DriverTrip = { id: string; customerName: string; vehicleType: string; pickup: string; destination: string; fare: number; distance: string; eta: string; status: string };
