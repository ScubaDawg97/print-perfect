"use client";

import { useEffect, useState } from "react";
import { usePublicConfig } from "@/lib/publicConfig";

type HumidityLevel = "Low" | "Normal" | "High";

interface WeatherState {
  status: "idle" | "loading" | "success" | "denied" | "error";
  city?: string;
  state?: string;
  tempF?: number;
  humidity?: number;
  humidityLevel?: HumidityLevel;
}

function humidityToLevel(pct: number): HumidityLevel {
  if (pct < 40) return "Low";
  if (pct <= 70) return "Normal";
  return "High";
}

export default function WeatherWidget() {
  const config  = usePublicConfig();
  const [weather, setWeather] = useState<WeatherState>({ status: "idle" });

  useEffect(() => {
    // Feature flag — don't start geo lookup if weather widget is disabled
    if (!config.weatherWidgetEnabled) return;

    if (!navigator.geolocation) {
      setWeather({ status: "error" });
      return;
    }

    setWeather({ status: "loading" });

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lon } = position.coords;

        try {
          // Parallel: weather + reverse geocode
          const [weatherRes, geoRes] = await Promise.allSettled([
            fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
                `&current=relative_humidity_2m,temperature_2m&temperature_unit=fahrenheit`
            ),
            fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
              { headers: { "Accept-Language": "en" } }
            ),
          ]);

          let tempF: number | undefined;
          let humidity: number | undefined;

          if (weatherRes.status === "fulfilled" && weatherRes.value.ok) {
            const weatherData = await weatherRes.value.json();
            tempF    = Math.round(weatherData?.current?.temperature_2m ?? 0);
            humidity = Math.round(weatherData?.current?.relative_humidity_2m ?? 0);
          }

          let city: string | undefined;
          let stateName: string | undefined;

          if (geoRes.status === "fulfilled" && geoRes.value.ok) {
            const geoData = await geoRes.value.json();
            const addr = geoData?.address ?? {};
            city =
              addr.city ??
              addr.town ??
              addr.village ??
              addr.municipality ??
              addr.county ??
              undefined;
            stateName = addr.state ?? addr.region ?? undefined;
            if (stateName && stateName.length > 12) {
              stateName = stateName.slice(0, 10) + "…";
            }
          }

          if (tempF === undefined || humidity === undefined) {
            setWeather({ status: "error" });
            return;
          }

          const humidityLevel = humidityToLevel(humidity);

          setWeather({ status: "success", city, state: stateName, tempF, humidity, humidityLevel });

          // Fire custom event so InputForm can auto-fill humidity
          window.dispatchEvent(
            new CustomEvent("pp-humidity", {
              detail: { level: humidityLevel, temp: tempF, city },
            })
          );
        } catch {
          setWeather({ status: "error" });
        }
      },
      (err) => {
        setWeather({ status: err.code === err.PERMISSION_DENIED ? "denied" : "error" });
      },
      { timeout: 8000, maximumAge: 300_000 }
    );
  }, [config.weatherWidgetEnabled]);

  // Feature flag — return null when disabled (after hooks are safely called)
  if (!config.weatherWidgetEnabled) return null;

  if (weather.status === "idle" || weather.status === "loading" || weather.status === "error") {
    return null;
  }

  if (weather.status === "denied") {
    return (
      <span className="text-xs text-slate-400 dark:text-slate-500 cursor-default select-none" title="Grant location access to auto-fill humidity level">
        📍 Add location for humidity auto-fill
      </span>
    );
  }

  // Success
  const { city, state, tempF, humidity } = weather;

  return (
    <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
      {city && (
        <span className="hidden sm:inline">
          {city}
          {state ? `, ${state}` : ""}
          {" | "}
        </span>
      )}
      <span>{tempF}°F</span>
      {" | "}
      <span>Humidity: {humidity}%</span>
    </span>
  );
}
