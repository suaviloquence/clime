<script lang="ts">
  import type { JwtInfo } from "../models";
  import { path } from "../Router.svelte";
  import { isAuthed, auth } from "./UserInfo.svelte";

  if ($isAuthed) {
    $path = "/dashboard";
  }

  export let mode: "login" | "create";

  let name: string;
  let username: string;
  let password: string;

  let disabled = false;

  let error: string | null = null;

  async function submit(evt: SubmitEvent) {
    evt.preventDefault();
    disabled = true;

    let body =
      mode === "login"
        ? { username, password }
        : { metadata: { name, username }, password };

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
</script>

<form on:submit={submit}>
  {#if mode === "create"}
    <div>
      <label for="name">Name: </label>
      <input type="text" bind:value={name} id="name" required />
    </div>
  {/if}
  <div>
    <label for="username-username">Username: </label>
    <input
      type="text"
      bind:value={username}
      on:change={checkAvailable}
      id="login-username"
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
  </div>
  <div>
    <label for="password">Password: </label>
    <input
      type="password"
      bind:value={password}
      minlength="8"
      id="login-password"
      required
    />
  </div>

  {#if error}
    <p class="error">{error}</p>
  {/if}

  <button type="submit">{mode === "login" ? "Log in" : "Create account"}</button
  >

  <div>
    Or, <button on:click={swap}
      >{mode === "login" ? "Create account" : "Log in"}</button
    >
  </div>
</form>

<style>
  .error {
    color: red;
  }
</style>
