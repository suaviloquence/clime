<script lang="ts">
  import { isAuthed, authedFetch, user, path } from "../stores";
  import { onMount } from "svelte";
  import type { University, Weather } from "../models";
  import WeatherInfo from "../components/WeatherInfo.svelte";
  import Link from "../components/Link.svelte";

  $: if (!$isAuthed) {
    $path = "/user/login";
  }

  let universities: (University & { weather: Weather })[] | null = null;

  onMount(async () => {
    let univs: University[] = await (
      await $authedFetch("/api/user/me/universities")
    ).json();

    universities = await Promise.all(
      univs.map(async (university) => ({
        weather: (
          await (await fetch(`/api/university/${university.id}/weather`)).json()
        )[0],
        ...university,
      }))
    );
  });
</script>

{#await $user}
  Loading dashboard...
{:then user}
  <h2>Good morning, {user.metadata.name}</h2>
  <div>
    <Link href="/user/me">Settings</Link>
  </div>
  {#if !universities}
    Loading universities...
  {:else}
    <ul>
      <li>
        <Link href="/university/add">Add</Link>
      </li>
      {#each universities as university, i}
        <li>
          <WeatherInfo
            weather={university.weather}
            timezone={university.timezone}
            >{university.name}
            <Link href={`/university/${university.id}`}>Info</Link>
          </WeatherInfo>
        </li>
      {/each}
    </ul>
  {/if}
{/await}
