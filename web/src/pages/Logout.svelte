<script lang="ts">
  import { onMount } from "svelte";
  import { auth, path } from "../stores";

  onMount(() => {
    $auth = null;
    $path = "/user/login";
  });
</script>
