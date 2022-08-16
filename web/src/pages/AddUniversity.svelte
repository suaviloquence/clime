<script lang="ts">
  import { isAuthed, user, authedFetch, path } from "../stores";
  import UniversitySearch from "../components/UniversitySearch.svelte";
  import Link from "../components/Link.svelte";

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
  <Link href={`/university/${id}`}>Info</Link>
  {#await $user then user}
    <button on:click={() => swap(id)}
      >{user.universities.includes(id) ? "Remove" : "Add"}</button
    >
  {/await}
</UniversitySearch>
