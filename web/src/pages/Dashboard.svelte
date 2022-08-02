<script lang="ts">
  import { isAuthed, authedFetch, user } from "./UserInfo.svelte";
  import { path } from "../Router.svelte";
  import { onMount } from "svelte";
  import type { University, Weather } from "../models";
  import WeatherInfo from "../components/WeatherInfo.svelte";

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
  <h2>Good morning, {user.name}</h2>
  {#if !universities}
    Loading universities...
  {:else}
    <ul>
      <li>
        <button on:click={() => ($path = "/university/add")}>Add</button>
      </li>
      {#each universities as university}
        <li>
          <WeatherInfo weather={university.weather} name={university.name} />
          <button on:click={() => ($path = `/university/${university.id}`)}
            >Info</button
          >
        </li>
      {/each}
    </ul>
  {/if}
{/await}
