# File path in project: RideHailing.API/Dockerfile
# Build context is this folder — on Render, set "Root Directory" to
# RideHailing.API so this Dockerfile is found without a custom context path.

# ── Build stage ────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore first, on just the csproj, so a rebuild only re-runs restore
# when dependencies actually change, not on every code edit.
COPY RideHailing.API.csproj ./
RUN dotnet restore RideHailing.API.csproj

COPY . .
RUN dotnet publish RideHailing.API.csproj -c Release -o /app/publish --no-restore

# ── Runtime stage ──────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

# Render injects its own PORT env var at container start (it is NOT fixed
# at build time), so ASPNETCORE_URLS must be resolved at runtime, not baked
# in with a plain ENV line. Defaulting to 8080 keeps `docker compose up`
# working unchanged for local dev (docker-compose.yml maps 5000 -> 8080).
ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["sh", "-c", "ASPNETCORE_URLS=http://+:${PORT} dotnet RideHailing.API.dll"]