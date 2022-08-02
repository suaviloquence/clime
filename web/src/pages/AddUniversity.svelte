<script lang="ts">
  import { isAuthed, user, authedFetch } from "./UserInfo.svelte";
  import { path } from "../Router.svelte";
  import UniversitySearch from "../components/UniversitySearch.svelte";

  if (!$isAuthed) $path = "/user/login";

  async function swap(id: number) {
    let u = await $user;
    await $authedFetch("/api/user/me/universities", {
      headers: {
        "Content-Type": "application/json",
      },
      method: u.universities.includes(id) ? "DELETE" : "PUT",
      body: JSON.stringify({ id }),
    });
    $path = "/dashboard";
  }
</script>

<UniversitySearch let:item={{ name, id }}>
  {name}:
  <button on:click={() => ($path = `/university/${id}`)}>Info</button>
  {#await $user then user}
    <button on:click={() => swap(id)}
      >{user.universities.includes(id) ? "Remove" : "Add"}</button
    >
  {/await}
</UniversitySearch>
