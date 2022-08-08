<script context="module" lang="ts">
  import { type Readable, derived } from "svelte/store";
  import { user } from "../pages/UserInfo.svelte";

  export const units: Readable<"imperial" | "metric"> = derived(
    user,
    (pms, set) => {
      pms.then((user) => {
        if (user) set(user.metadata.units);
        else set("imperial");
      });
    },
    "imperial" as "imperial" | "metric"
  );

  export function convertTemperature(
    kelvin: number,
    units: "imperial" | "metric"
  ): string {
    let celsius = kelvin - 273.15;
    if (units === "metric") return celsius.toFixed(1) + "°C";
    if (units === "imperial") return (celsius * 1.8 + 32).toFixed(1) + "°F";
  }

  export function convertSpeed(
    mps: number,
    units: "imperial" | "metric"
  ): string {
    if (units === "metric") return mps.toFixed(1) + " m/s";
    if (units === "imperial") return (mps * 2.237).toFixed(1) + " mph";
  }

  const fmt = new Intl.DateTimeFormat([...navigator.languages], {
    weekday: "long",
    hour: "numeric",
  });

  export function formatDate(date: Date): string {
    return fmt.format(date);
  }
</script>

<script lang="ts">
  import type { Weather } from "../models";

  export let weather: Weather;
</script>

<h3>
  <slot>
    {formatDate(new Date(weather.time))}
  </slot>:
  {convertTemperature(weather.temperature, $units)}
</h3>
<ul>
  <li>{weather.weather_description}</li>
  <li>
    Feels like: {convertTemperature(weather.feels_like, $units)}
  </li>
  <li>humidity: {weather.humidity.toFixed(1)}%</li>
  <li>pressure: {weather.pressure.toFixed(1)} hPa</li>
  <li>wind: {convertSpeed(weather.wind_speed, $units)}</li>
  <li>cloudiness: {weather.cloudiness.toFixed(1)}%</li>
</ul>
