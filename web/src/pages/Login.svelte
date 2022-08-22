<script lang="ts">
  import type { JwtInfo } from "../models";
  import { isAuthed, auth, path } from "../stores";

  if ($isAuthed) {
    $path = "/dashboard";
  }

  export let mode: "login" | "create";

  let name: string;
  let username: string;
  let password: string;
  let units: "imperial" | "metric" = "imperial";

  let disabled = false;

  let error: string | null = null;

  async function submit(evt: SubmitEvent) {
    evt.preventDefault();
    disabled = true;

    let body =
      mode === "login"
        ? { username, password }
        : { metadata: { name, username, units }, password };

    let res = await fetch(`/api/user/${mode}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      error = await res.text();
      disabled = false;
      return;
    }

    $auth = (await res.json()) as JwtInfo;
    $path = "/dashboard";

    disabled = false;
  }

  function swap() {
    mode = mode === "create" ? "login" : "create";
  }

  let available: Promise<boolean>;

  function checkAvailable() {
    available = fetch(
      "/api/user/check?" + new URLSearchParams({ username })
    ).then((res) => res.json());
  }

  $: document.title = `${
    mode === "create" ? "Create account" : "Log in"
  } | Clime`;
</script>

<form on:submit={submit} class="section full-span" id="login">
  {#if mode === "create"}
    <section>
      <label for="name">Name: </label>
      <input type="text" bind:value={name} id="name" required />
    </section>
    <section>
      Units:
      {#each ["imperial", "metric"] as unit}
        <div>
          <input
            type="radio"
            name="units"
            bind:group={units}
            id={unit}
            value={unit}
          />
          <label for={unit}>{unit}</label>
        </div>
      {/each}
    </section>
  {/if}
  <section>
    <label for="username">Username: </label>
    <input
      type="text"
      bind:value={username}
      on:change={checkAvailable}
      id="username"
      required
    />
    {#if mode === "create"}
      {#await available}
        Checking...
      {:then available}
        {#if available}
          Available
        {:else}
          Not available
        {/if}
      {/await}
    {/if}
  </section>
  <section>
    <label for="password">Password: </label>
    <input
      type="password"
      bind:value={password}
      minlength="8"
      id="password"
      required
    />
  </section>

  {#if error}
    <section class="error">{error}</section>
  {/if}

  <section>
    <button type="submit"
      >{mode === "login" ? "Log in" : "Create account"}</button
    >

    , or,
    <button on:click={swap}
      >{mode === "login" ? "Create account" : "Log in"}</button
    >
  </section>
</form>

<style>
  .error {
    color: red;
  }

  #login {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
  }
  #login section {
    flex-basis: 30%;
  }
</style>
