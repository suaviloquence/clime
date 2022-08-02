<script lang="ts">
  import type { Weather } from "../models";

  export let weather: Weather;
  export let name: string | null = null;

  function toFahrenheit(kelvin: number): number {
    return (kelvin - 273.15) * 1.8 + 32;
  }

  function toMph(mps: number): number {
    return mps * 2.237;
  }

  const fmt = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    hour: "numeric",
  });

  function formatDate(date: Date): string {
    return fmt.format(date);
  }
</script>

<h3>
  {#if name}{name}: {/if}
  {formatDate(new Date(weather.time * 1000))}
  {toFahrenheit(weather.temperature).toFixed(1)}°F
</h3>
<ul>
  <li>{weather.weather_description}</li>
  <li>
    Feels like: {toFahrenheit(weather.feels_like).toFixed(1)}°F
  </li>
  <li>humidity: {weather.humidity.toFixed(1)}%</li>
  <li>pressure: {weather.pressure.toFixed(1)} hPa</li>
  <li>wind: {toMph(weather.wind_speed).toFixed(1)} mph</li>
  <li>cloudiess: {weather.cloudiness.toFixed(1)}%</li>
</ul>
