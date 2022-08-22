<script lang="ts">
  export let expanded = false;
</script>

<div>
  <slot name="title" />
  <button on:click={() => (expanded = !expanded)}>{expanded ? "-" : "+"}</button
  >
</div>
<div class:hide={!expanded}>
  <slot name="content" />
</div>

<style>
  .hide {
    display: none;
  }

  button {
    width: 1rem;
    cursor: pointer;
  }
</style>
