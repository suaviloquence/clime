<script lang="ts">
  import { path } from "../Router.svelte";

  export let href: string;
</script>

<button class="link" on:click={() => ($path = href)}><slot /></button>
