<script lang="ts">
  let name = "";

  let options: Promise<{ id: number; name: string }[]>;

  $: options = search(name);

  async function search(
    search: string
  ): Promise<{ id: number; name: string }[]> {
    if (search.length < 3) return [];
    return await (
      await fetch(
        `/api/university/search?${new URLSearchParams({ search: name })}`
      )
    ).json();
  }
</script>

<div><input bind:value={name} type="text" /></div>

{#if name.length < 3}
  <p>Type more to load options.</p>
{:else}
  {#await options}
    Loading...
  {:then options}
    <ol>
      {#each options as item}
        <li>
          <slot {item} />
        </li>
      {/each}
    </ol>
  {/await}
{/if}
