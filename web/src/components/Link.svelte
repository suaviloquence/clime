<script lang="ts">
  import { path } from "../stores";

  export let href: string;
</script>

<button class="link" on:click={() => ($path = href)}><slot /></button>
