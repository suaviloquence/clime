<script lang="ts">
  import WeatherInfo from "../components/WeatherInfo.svelte";
  import { isAuthed, authedFetch, user } from "./UserInfo.svelte";
  import { path } from "../Router.svelte";
  import type { Consideration, University, Weather } from "../models";

  enum Tab {
    Weather,
    Stats,
    Admissions,
    Costs,
  }

  export let id: number;

  let university: Promise<University> = fetch(`/api/university/${id}`).then(
    (res) => res.json()
  );
  let weather: Promise<Weather[]> = fetch(`/api/university/${id}/weather`).then(
    (res) => res.json()
  );

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
  <h1>{university.name}</h1>
  <h3>
    <a href={normalizeUrl(university.website)} target="_blank"
      >Official website</a
    >
  </h3>
  {#if $isAuthed}
    {#await $user then user}
      <div>
        {#if user.universities.includes(id)}
          <button on:click={updateDashboard}>Remove from dashboard</button>
        {:else}
          <button on:click={updateDashboard}>Add to dashboard</button>
        {/if}
      </div>
    {/await}
  {/if}

  <div>
    <button on:click={() => (tab = Tab.Weather)}>Weather</button>
    <button on:click={() => (tab = Tab.Stats)}>Statistics</button>
    <button on:click={() => (tab = Tab.Admissions)}>Admissions Info</button>
    <button on:click={() => (tab = Tab.Costs)}>Costs</button>
  </div>

  {#if tab === Tab.Weather}
    <div>
      <p>{university.street_address}</p>
      <p>{university.city}, {university.state} {university.zip_code}</p>
    </div>
    <h2>Weather</h2>
    {#await weather}
      <p>Loading weather...</p>
    {:then weather}
      <ol>
        {#each weather as weather}
          <li>
            <WeatherInfo {weather} />
          </li>
        {/each}
      </ol>
    {/await}
  {:else if tab === Tab.Stats}
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
  {:else if tab === Tab.Admissions}
    {#if university.admissions_website}
      <p>
        <a href={normalizeUrl(university.admissions_website)} target="_blank"
          >Admissions office website</a
        >
      </p>
    {/if}
    {#if university.application_fee}
      <p>Application fee: ${university.application_fee}</p>
    {/if}
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
    <h4>SAT</h4>
    <ul>
      {#if university.submitted_sat}
        <li>
          (Enrolled) students who submitted SAT scores: {university.submitted_sat}%
        </li>
      {/if}
      {#if university.sat_english_1q && university.sat_english_3q}
        <li>
          English: first quartile: {university.sat_english_1q}, third quartile: {university.sat_english_3q}
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
          English: first quartile: {university.act_english_1q}, third quartile: {university.act_english_3q}
        </li>
      {/if}
      {#if university.act_math_1q && university.act_math_3q}
        <li>
          Math: first quartile: {university.act_math_1q}, third quartile: {university.act_math_3q}
        </li>
      {/if}
    </ul>
  {:else if tab === Tab.Costs}
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
  {/if}
{/await}
