<script context="module" lang="ts">
  import { type Readable, derived } from "svelte/store";
  import { user } from "../stores";

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

  const fmtOptions: Intl.DateTimeFormatOptions = {
    weekday: "long",
    hour: "numeric",
    timeZoneName: "short",
  };

  export function formatDate(date: Date | number, timeZone?: string): string {
    return new Intl.DateTimeFormat([...navigator.languages], {
      timeZone,
      ...fmtOptions,
    }).format(date);
  }
</script>

<script lang="ts">
  import type { Weather } from "../models";
  import Expandable from "./Expandable.svelte";

  export let weather: Weather;
  export let timezone: string;
  export let expanded = false;
</script>

<Expandable {expanded}>
  <span class="title" slot="title">
    <slot>
      {formatDate(weather.time, timezone)}
    </slot>:
    {convertTemperature(weather.temperature, $units)}
  </span>
  <ul slot="content">
    <li>{weather.weather_description}</li>
    <li>
      Feels like: {convertTemperature(weather.feels_like, $units)}
    </li>
    <li>humidity: {weather.humidity.toFixed(1)}%</li>
    <li>pressure: {weather.pressure.toFixed(1)} hPa</li>
    <li>wind: {convertSpeed(weather.wind_speed, $units)}</li>
    <li>cloudiness: {weather.cloudiness.toFixed(1)}%</li>
  </ul>
</Expandable>
