<script lang="ts">
  import type { Forecast } from "../models";
  import {
    convertSpeed,
    convertTemperature,
    units,
  } from "./WeatherInfo.svelte";

  export let forecasts: Forecast[];
  export let timezone: string;

  let buckets = generateBuckets(forecasts);

  $: buckets = generateBuckets(forecasts);

  function generateBuckets(forecasts: Forecast[]): Forecast[][] {
    let buckets = [];
    let bucket = [];

    const fmt = Intl.DateTimeFormat([...navigator.languages], {
      day: "numeric",
      timeZone: timezone,
    });

    for (const forecast of forecasts) {
      if (
        bucket.length > 0 &&
        fmt.format(forecast.time) !== fmt.format(bucket[bucket.length - 1].time)
      ) {
        buckets.push(bucket);
        bucket = [];
      }
      bucket.push(forecast);
    }

    buckets.push(bucket);

    return buckets;
  }

  const dayFmt = Intl.DateTimeFormat([...navigator.languages], {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: timezone,
  });

  const hourFmt = Intl.DateTimeFormat([...navigator.languages], {
    hour: "numeric",
    timeZone: timezone,
    // timeZoneName: "short",
  });

  let open = 0;

  let min = Math.min(...buckets[open].map((x) => x.temperature));
  let max = Math.max(...buckets[open].map((x) => x.temperature));

  $: {
    min = Math.min(...buckets[open].map((x) => x.temperature));
    max = Math.max(...buckets[open].map((x) => x.temperature));
  }

  let detailedView: Forecast | null = null;

  let radius = 20;

  let height = radius * 5;
  // 8 sections - extra 10px for padding
  let width = 8 * (2.5 * radius) - 0.5 * radius;

  function x(i: number): number {
    return i * (2.5 * radius) + radius;
  }

  function y(forecast: Forecast): number {
    if (max === min) return (height - 2 * radius) * 0.5 + radius;
    return (
      ((height - 2 * radius) * (max - forecast.temperature)) / (max - min) +
      radius
    );
  }

  function range(n: number): number[] {
    const arr = new Array(n);

    for (let i = 0; i < n; i++) {
      arr[i] = i;
    }

    return arr;
  }

  function toggleView(forecast: Forecast): () => void {
    return () => {
      if (detailedView === forecast) detailedView = null;
      else detailedView = forecast;
    };
  }
</script>

<div id="forecast">
  <div id="map">
    <div id="day-selection">
      {#each buckets as day, i}
        <button on:click={() => (open = i)} class:selected={open === i}
          >{dayFmt.format(day[0].time)}
        </button>
      {/each}
    </div>
    <svg
      viewBox="{radius * -3} {-radius} {width + radius * 4} {height +
        3 * radius}"
    >
      {#each buckets[open] as forecast, i}
        <rect
          x={x(i) - radius * 1.5}
          y={-radius / 2}
          width={radius * 3}
          height={height + radius / 2}
          class:day={forecast.is_day}
          class:night={!forecast.is_day}
        />
      {/each}
      {#if max === min}
        <text
          x={-radius * 3}
          y={height / 2}
          width={3 * radius}
          dominant-baseline="middle">{convertTemperature(max, $units)}</text
        >
        <line x1={0} x2={width} y1={height / 2} y2={height / 2} class="grid" />
      {:else}
        <line x1={0} x2={width} y1={radius} y2={radius} class="grid" />
        <line
          x1={0}
          x2={width}
          y1={height - radius}
          y2={height - radius}
          class="grid"
        />
        <text
          x={-radius * 3}
          y={radius}
          width={3 * radius}
          dominant-baseline="middle">{convertTemperature(max, $units)}</text
        >
        <text
          x={-radius * 3}
          y={height - radius}
          width={3 * radius}
          dominant-baseline="middle">{convertTemperature(min, $units)}</text
        >
      {/if}
      {#each range(buckets[open].length - 1) as i}
        <line
          x1={x(i)}
          y1={y(buckets[open][i])}
          x2={x(i + 1)}
          y2={y(buckets[open][i + 1])}
          stroke="#88f"
          stroke-width="3"
        />
      {/each}

      {#each buckets[open] as forecast, i}
        <line
          x1={x(i)}
          x2={x(i)}
          y1={0}
          y2={height}
          stroke="#888"
          stroke-dasharray={4}
        />
        <!-- NOTE: before adding icons, the root <svg> tag has to have id "svg" -->
        <use
          href="/static/assets/{forecast.weather_id}-{forecast.is_day
            ? 'day'
            : 'night'}.svg#svg"
          on:click={toggleView(forecast)}
          x={x(i) - radius}
          y={y(forecast) - radius}
          width={2 * radius}
          height={2 * radius}
          class:selected={detailedView === forecast}
          class="icon"
        >
          <title
            >{convertTemperature(forecast.temperature, $units)}, {forecast.weather_description}</title
          >
        </use>
        <text
          x={x(i)}
          y={height + 1.5 * radius}
          text-anchor="middle"
          width={2 * radius}>{hourFmt.format(forecast.time)}</text
        >
      {/each}
    </svg>
  </div>

  <div id="detailed-view">
    {#if detailedView}
      <button on:click={() => (detailedView = null)}>Close</button>
      <h3>
        {hourFmt.format(detailedView.time)}: {convertTemperature(
          detailedView.temperature,
          $units
        )}
      </h3>
      <ul>
        <li>{detailedView.weather_description}</li>
        <li>
          feels like: {convertTemperature(detailedView.feels_like, $units)}
        </li>
        <li>humidity: {detailedView.humidity.toFixed(1)}%</li>
        <li>pressure: {detailedView.pressure.toFixed(1)} HPa</li>
        <li>wind speed: {convertSpeed(detailedView.wind_speed, $units)}</li>
        <li>
          chance of precipitation: {Math.round(
            detailedView.precipitation_chance * 100
          )}%
        </li>
      </ul>
    {/if}
  </div>
</div>

<style>
  /* HACK: this allows highlighting on click/hover */
  :global(svg *:not(use, line, .keep-stroke)) {
    stroke: inherit !important;
  }

  use:hover {
    stroke: #7e7;
    stroke-width: 20;
  }

  .selected {
    border-color: blue;
    stroke: #8f8;
    stroke-width: 20;
  }

  #forecast {
    display: flex;
    flex-direction: row;
    justify-content: space-around;
  }

  #map {
    flex-basis: 60%;
  }

  #detailed-view {
    flex-basis: 30%;
  }

  #day-selection {
    display: flex;
    flex-direction: row;
    justify-content: space-around;
  }

  .grid {
    stroke: #888;
    stroke-dasharray: 4;
  }

  .day {
    fill: #8af;
  }

  .night {
    fill: #55a;
  }

  .icon {
    cursor: pointer;
  }
</style>
