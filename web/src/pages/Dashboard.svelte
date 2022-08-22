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

  document.title = "Dashboard | Clime";
</script>

{#await $user}
  Loading dashboard...
{:then user}
  <section class="full-span">
    <h2>Hello, {user.metadata.username}</h2>
    <h4 style="font-style: italic">You can do this!</h4>
  </section>
  {#if !universities}
    Loading universities...
  {:else}
    <section id="dashboard" class="full-span">
      {#each universities as university, i}
        <section class="weather">
          <WeatherInfo
            weather={university.weather}
            timezone={university.timezone}
            let:icon
            let:temp
          >
            <!-- svelte-ignore a11y-missing-attribute -->
            <img {...icon} />
            {university.name}: {temp}
            <Link href={`/university/${university.id}`}>Info</Link>
          </WeatherInfo>
        </section>
      {/each}
      <section class="center">
        <Link href="/university/add">Add Universities</Link>
      </section>
    </section>
  {/if}
{/await}

<style>
  #dashboard {
    display: flex;
    flex-wrap: wrap;
  }
  /* .weather {
    width: auto;
  } */
</style>
