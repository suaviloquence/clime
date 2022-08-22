<script lang="ts">
  let name = "";

  let options: Promise<{ id: number; name: string }[]>;

  export let max: number | null = null;

  $: options = search(name);

  async function search(
    search: string
  ): Promise<{ id: number; name: string }[]> {
    if (search.length < 3) return [];
    let opts = await (
      await fetch(
        `/api/university/search?${new URLSearchParams({ search: name })}`
      )
    ).json();

    return opts.slice(0, max ?? opts.length);
  }
</script>

<div>
  <input bind:value={name} type="text" placeholder="Search for a university" />
</div>

{#if name.length < 3}
  <slot name="hint">Type more to load options.</slot>
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
