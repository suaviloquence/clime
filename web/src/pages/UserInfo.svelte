<script context="module" lang="ts">
  import {
    writable,
    type Writable,
    type Readable,
    derived,
  } from "svelte/store";

  import type { JwtInfo, User, UserMetadata } from "../models";

  let jwt: string | null = localStorage.getItem("jwt");
  let exps = localStorage.getItem("exp");
  let exp: number | null = exps ? Number.parseInt(exps) : null;

  export const auth: Writable<JwtInfo | null> = writable(
    jwt ? { jwt, exp } : null
  );

  export const isAuthed: Readable<boolean> = derived(
    auth,
    (val) => !!val,
    !!jwt
  );

  auth.subscribe((val) => {
    if (val) {
      localStorage.setItem("jwt", val.jwt);
      localStorage.setItem("exp", val.exp.toString());
    } else {
      localStorage.removeItem("jwt");
      localStorage.removeItem("exp");
    }
  });

  export const authedFetch: Readable<
    (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  > = derived(auth, (val) => {
    if (val) {
      return async (url: RequestInfo | URL, init: RequestInit = {}) => {
        if (!init.headers) init.headers = {};
        init.headers["Authorization"] = `Bearer ${val.jwt}`;
        let res = await fetch(url, init);

        if (res.status === 401) {
          auth.set(null);
        }

        return res;
      };
    } else {
      return (_: RequestInfo | URL, __: RequestInit = {}) => {
        throw new Error("not authed");
      };
    }
  });

  let setUser: (user: Promise<User | null>) => void = (user) => void user;
  export const user: Readable<Promise<User | null>> = derived(
    auth,
    (val, set) => {
      setUser = set;
      if (!val) return null;
      updateUser(val.jwt);
    }
  );

  async function fetchUser(jwt: string | null): Promise<User | null> {
    if (!jwt) return null;
    let res = await fetch("/api/user/me", {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    });

    if (res.status === 401) {
      auth.set(null);
      return null;
    }

    return res.json();
  }

  export function updateUser(jwt: string | null) {
    setUser(fetchUser(jwt));
  }
</script>

<script lang="ts">
  import { onMount } from "svelte";

  import { path } from "../Router.svelte";

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
</script>

{#await $user}
  Loading user...
{:then user}
  Hello, {user.metadata.name}

  <h3>Settings</h3>
  <div>
    <label for="username">Username: </label>
    {#if edit}
      <input id="username" required bind:value={metadata.username} />
    {:else}
      <span id="username">{user.metadata.username}</span>
    {/if}
  </div>
  <div>
    <label for="name">Name: </label>
    {#if edit}
      <input id="name" bind:value={metadata.name} />
    {:else}
      <span id="name">{user.metadata.name}</span>
    {/if}
  </div>
  <div>
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
  </div>
  <!-- TODO: timezone -->
  <div>
    {#if edit}
      <button on:click={update}>Update</button>
      <button on:click={() => (edit = false)}>Cancel</button>
    {:else}
      <button on:click={startEditing}>Edit</button>
    {/if}
  </div>
{/await}
