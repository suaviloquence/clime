<script lang="ts">
  import WeatherInfo, {
    convertTemperature,
    units,
  } from "../components/WeatherInfo.svelte";
  import { isAuthed, authedFetch, user, path, isDay } from "../stores";
  import type { Consideration, Forecast, University, Weather } from "../models";
  import ForecastInfo from "../components/ForecastInfo.svelte";

  enum Tab {
    Weather = "Weather",
    Stats = "Statistics",
    Admissions = "Admissions Info",
    Costs = "Costs",
  }

  export let id: number;

  let university: Promise<University>;
  let weather: Promise<Weather[]>;
  let forecasts: Promise<Forecast[]>;

  function update(id: number) {
    university = fetch(`/api/university/${id}`)
      .then((res) => res.json())
      .then((univ) => {
        document.title = `${univ.name} | Clime`;

        return univ;
      });
    weather = fetch(`/api/university/${id}/weather`).then((res) => res.json());
    forecasts = fetch(`/api/university/${id}/forecast`).then((res) =>
      res.json()
    );
  }

  $: update(id);

  let tab = Tab.Weather;

  function considerationString(consideration: Consideration): string {
    switch (consideration) {
      case 0:
        return "Unspecified";
      case 1:
        return "Required";
      case 2:
        return "Recommended";
      case 3:
        return "Considered but not required";
      case 4:
        return "Neither required nor recommended";
    }
  }

  function normalizeUrl(url: string): string {
    if (url.startsWith("http")) return url;
    return "https://" + url;
  }

  async function updateDashboard() {
    await $authedFetch("/api/user/me/universities", {
      method: (await $user).universities.includes(id) ? "DELETE" : "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id }),
    });

    $path = "/dashboard";
  }
</script>

{#await university}
  <p>Loading university info...</p>
{:then university}
  <section class="full-span">
    <h1>{university.name}</h1>
    <section>
      <h3>
        <a href={normalizeUrl(university.website)} target="_blank"
          >Official website</a
        >
      </h3>
      <p>{university.street_address}</p>
      <p>{university.city}, {university.state} {university.zip_code}</p>
    </section>
    <section id="tabs">
      {#if $isAuthed}
        {#await $user then user}
          {#if user.universities.includes(id)}
            <button on:click={updateDashboard}>Remove from dashboard</button>
          {:else}
            <button on:click={updateDashboard}>Add to dashboard</button>
          {/if}
          <span class="divider"> | </span>
        {/await}
      {/if}

      {#each Object.values(Tab) as name}
        <button on:click={() => (tab = name)} class:selected={tab === name}
          >{name}</button
        >
      {/each}
    </section>
  </section>

  {#if tab === Tab.Weather}
    <section id="weather">
      <h2>Weather</h2>
      {#await weather}
        <p>Loading weather...</p>
      {:then weather}
        <section>
          <img
            src="/static/assets/{weather[0].weather_type}-{$isDay
              ? 'day'
              : 'night'}.svg"
            alt={weather[0].weather_description}
          />
          {convertTemperature(weather[0].temperature, $units)}
        </section>
        {#each weather as weather, i}
          <section class="weather">
            <WeatherInfo
              {weather}
              timezone={university.timezone}
              expanded={i === 0}
            />
          </section>
        {/each}
      {/await}
    </section>
    <section id="forecasts" class="full-span">
      <h2>Forecasts</h2>
      {#await forecasts}
        <p>Loading forecasts...</p>
      {:then forecasts}
        <ForecastInfo {forecasts} timezone={university.timezone} />
      {/await}
    </section>
  {:else if tab === Tab.Stats}
    <section>
      <ul>
        {#if university.total_enrollment}
          <li>{university.total_enrollment} total students</li>
        {/if}
        {#if university.undergrad_enrollment}
          <li>{university.undergrad_enrollment} undergraduates</li>
        {/if}
        {#if university.student_to_faculty}
          <li>Student-to-faculty ratio: {university.student_to_faculty}:1</li>
        {/if}
        {#if university.graduation_rate}
          <li>Total graduation rate: {university.student_to_faculty}%</li>
        {/if}
      </ul>
    </section>
  {:else if tab === Tab.Admissions}
    <section>
      {#if university.admissions_website}
        <h3>
          <a href={normalizeUrl(university.admissions_website)} target="_blank"
            >Admissions office website</a
          >
        </h3>
      {/if}
      {#if university.application_fee}
        <p>Application fee: ${university.application_fee}</p>
      {/if}
    </section>
    <section id="admission-factors">
      <h2>Admission Factors</h2>
      <ul>
        <li>GPA: {considerationString(university.considers_gpa)}</li>
        <li>
          Class rank: {considerationString(university.considers_class_rank)}
        </li>
        <li>
          Transcript: {considerationString(university.considers_transcript)}
        </li>
        <li>
          Recommendations: {considerationString(
            university.considers_recommendations
          )}
        </li>
        <li>
          Test scores: {considerationString(university.considers_test_scores)}
        </li>
        <li>TOEFL: {considerationString(university.considers_toefl)}</li>
      </ul>
    </section>
    <section id="admission-stats">
      <h2>Admission statistics</h2>
      <ul>
        {#if university.total_applicants}
          <li>Total applicants: {university.total_applicants}</li>
        {/if}
        {#if university.total_admissions}
          <li>Total admitted: {university.total_admissions}</li>
        {/if}
        {#if university.total_applicants && university.total_admissions}
          <li>
            Acceptance rate: {(
              (100 * university.total_admissions) /
              university.total_applicants
            ).toFixed(1)}%
          </li>
        {/if}
        {#if university.total_enrolled_applicants}
          <li>Total enrolled: {university.total_enrolled_applicants}</li>
        {/if}
        {#if university.admissions_yield}
          <li>Yield rate: {university.admissions_yield}%</li>
        {/if}
      </ul>
      <h3>Test scores</h3>
      <section>
        <h4>SAT</h4>
        <ul>
          {#if university.submitted_sat}
            <li>
              (Enrolled) students who submitted SAT scores: {university.submitted_sat}%
            </li>
          {/if}
          {#if university.sat_english_1q && university.sat_english_3q}
            <li>
              English: first quartile: {university.sat_english_1q}, third
              quartile: {university.sat_english_3q}
            </li>
          {/if}
          {#if university.sat_math_1q && university.sat_math_3q}
            <li>
              Math: first quartile: {university.sat_math_1q}, third quartile: {university.sat_math_3q}
            </li>
          {/if}
          {#if university.sat_english_1q && university.sat_english_3q && university.sat_math_1q && university.sat_math_3q}
            <li>
              Total: first quartile: {university.sat_english_1q +
                university.sat_math_1q}, third quartile: {university.sat_english_3q +
                university.sat_math_3q}
            </li>
          {/if}
        </ul>
      </section>
      <section>
        <h4>ACT</h4>
        <ul>
          {#if university.submitted_act}
            <li>
              (Enrolled) students who submitted ACT scores: {university.submitted_act}%
            </li>
          {/if}
          {#if university.act_composite_1q && university.act_composite_3q}
            <li>
              Composite: first quartile: {university.act_composite_1q}, third
              quartile: {university.act_composite_3q}
            </li>
          {/if}
          {#if university.act_english_1q && university.act_english_3q}
            <li>
              English: first quartile: {university.act_english_1q}, third
              quartile: {university.act_english_3q}
            </li>
          {/if}
          {#if university.act_math_1q && university.act_math_3q}
            <li>
              Math: first quartile: {university.act_math_1q}, third quartile: {university.act_math_3q}
            </li>
          {/if}
        </ul>
      </section>
    </section>
  {:else if tab === Tab.Costs}
    <section id="costs">
      <p>
        Note: the following costs represent the total cost of attendance (i.e.,
        without financial aid)
      </p>
      <ul>
        {#if university.price_in_district}
          <li>In-district price: ${university.price_in_district}</li>
        {/if}
        {#if university.price_in_state}
          <li>In-state price: ${university.price_in_state}</li>
        {/if}
        {#if university.price_out_of_state}
          <li>
            Out-of-state price (or price of a private school): ${university.price_out_of_state}
          </li>
        {/if}
      </ul>
    </section>
  {/if}
{/await}

<style>
  #weather {
    display: flex;
    flex-wrap: wrap;
  }

  #weather h2 {
    flex-basis: 100%;
  }

  #weather > section:first-of-type {
    flex-basis: content;
    font-size: 2rem;
    display: flex;
    align-items: center;
  }

  #weather > section:first-of-type img {
    flex-grow: 1;
  }

  #weather section {
    flex-basis: auto;
  }

  .selected {
    background-color: var(--accent-alt);
  }

  #tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 1vmin;
    align-items: center;
  }
</style>
