<script lang="ts">
  import type { JwtInfo } from "../models";
  import { path } from "../Router.svelte";
  import { isAuthed, auth } from "./UserInfo.svelte";

  if ($isAuthed) {
    $path = "/dashboard";
  }

  export let mode: "login" | "create";

  let id: string;
  let name: string;

  let disabled = false;

  let error: string | null = null;

  async function submit(evt: SubmitEvent) {
    evt.preventDefault();
    disabled = true;

    let body = mode === "login" ? { id } : { metadata: { name } };

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
</script>

<form on:submit={submit}>
  {#if mode === "login"}
    <div>
      <label for="id">ID: </label>
      <input type="text" bind:value={id} id="id" required />
    </div>
  {:else}
    <div>
      <label for="name">Name: </label>
      <input type="text" bind:value={name} id="name" required />
    </div>
  {/if}

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
