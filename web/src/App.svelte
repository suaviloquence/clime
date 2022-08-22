<script lang="ts">
  import Link from "./components/Link.svelte";
  import UniversitySearch from "./components/UniversitySearch.svelte";
  import Dashboard from "./pages/Dashboard.svelte";

  import Router from "./Router.svelte";
  import { isAuthed, isDay, path } from "./stores";

  // if prefers dark scheme, use that, otherwise it's up to the pages
  // TODO
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (evt) => {
      if (evt.matches) {
        $isDay = false;
      }
    });

  function updateClass(day: boolean) {
    if (day) {
      document.body.classList.add("day");
      document.body.classList.remove("night");
    } else {
      document.body.classList.remove("day");
      document.body.classList.add("night");
    }
  }

  updateClass($isDay);
  isDay.subscribe(updateClass);

  let navToggle = false;

  // close menu if link is clicked
  path.subscribe((_) => (navToggle = false));
</script>

<section id="menu" class="center" class:show={!navToggle}>
  <button on:click={() => (navToggle = true)}>Menu</button>
</section>

<section id="nav" class="full-span" class:show={navToggle}>
  <div id="links">
    <button id="toggle" on:click={() => (navToggle = false)}>Close</button>
    {#if $isAuthed}
      <Link href="/dashboard">Dashboard</Link>
      <Link href="/user/me">Settings</Link>
      <Link href="/user/logout">Log out</Link>
    {:else}
      <Link href="/user/login">Log in</Link>
      <Link href="/user/create">Create account</Link>
    {/if}
  </div>

  <section id="search">
    <UniversitySearch max={3} let:item>
      <span slot="hint" />
      <Link href="/university/{item.id}">
        {item.name}</Link
      >
    </UniversitySearch>
  </section>

  <section id="day-toggle">
    <button on:click={() => ($isDay = !$isDay)}>
      <img
        src="/static/assets/800-{$isDay ? 'night' : 'day'}.svg"
        alt="Toggle night mode"
      />
    </button>
  </section>
</section>
<Router defaultComponent={Dashboard} />

<style>
  #nav {
    display: flex;
    flex-direction: row;
    align-items: center;
  }

  #links {
    display: flex;
    flex-basis: 70%;
    gap: 5vmin 5vmin;
    justify-content: space-evenly;
  }

  #search :global(input) {
    width: 10em;
  }

  #day-toggle {
    flex-basis: auto;
    padding: 0;
    margin-block: 0;
  }

  #day-toggle button {
    background: transparent;
  }

  #menu {
    display: none;
  }

  #toggle {
    display: none;
  }

  @media (max-aspect-ratio: 1 / 1) {
    #menu.show {
      display: block;
    }

    #toggle {
      display: inline;
    }

    #nav.show {
      display: flex;
    }

    #nav {
      display: none;
      flex-direction: column;
      height: 98vh;
      margin: 0;
      gap: 10vmin;
    }

    #nav.show ~ :global(*) {
      display: none !important;
    }

    #links {
      flex-basis: auto;
      flex-direction: column;
    }
  }
</style>
