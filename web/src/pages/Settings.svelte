<script lang="ts">
  import { onMount } from "svelte";
  import type { UserMetadata } from "../models";
  import {
    auth,
    authedFetch,
    isAuthed,
    user,
    updateUser,
    path,
  } from "../stores";

  $: if (!$isAuthed) {
    $auth = null;
    $path = "/user/login";
  }

  let metadata: UserMetadata;
  onMount(async () => {
    if (!(await $user)) {
      updateUser($auth.jwt);
    }
  });

  let edit = false;

  async function startEditing() {
    metadata = { ...(await $user).metadata };
    edit = true;
  }

  async function update() {
    await $authedFetch("/api/user/me", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metadata),
    });

    (await $user).metadata = metadata;
    edit = false;
  }

  document.title = "Settings | Clime";
</script>

{#await $user}
  Loading user...
{:then user}
  <section class="full-span">
    <h3>Settings</h3>
  </section>
  <section>
    <label for="username">Username: </label>
    {#if edit}
      <input id="username" required bind:value={metadata.username} />
    {:else}
      <span id="username">{user.metadata.username}</span>
    {/if}
  </section>
  <section>
    <label for="name">Name: </label>
    {#if edit}
      <input id="name" bind:value={metadata.name} />
    {:else}
      <span id="name">{user.metadata.name}</span>
    {/if}
  </section>
  <section>
    <label for="units">Units: </label>
    {#if edit}
      {#each ["imperial", "metric"] as unit}
        <div>
          <input
            type="radio"
            name="units"
            bind:group={metadata.units}
            id={unit}
            value={unit}
          />
          <label for={unit}>{unit}</label>
        </div>
      {/each}
    {:else}
      <span id="units">{user.metadata.units}</span>
    {/if}
  </section>
  <!-- TODO: timezone -->
  <section>
    {#if edit}
      <button on:click={update}>Update</button>
      <button on:click={() => (edit = false)}>Cancel</button>
    {:else}
      <button on:click={startEditing}>Edit</button>
    {/if}
  </section>
{/await}
