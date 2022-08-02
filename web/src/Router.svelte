<script context="module" lang="ts">
  import { type Writable, writable } from "svelte/store";

  export const path: Writable<string> = writable(window.location.pathname);
</script>

<script lang="ts">
  import type { SvelteComponent } from "svelte";
  import AddUniversity from "./pages/AddUniversity.svelte";
  import Login from "./pages/Login.svelte";
  import UniversityInfo from "./pages/UniversityInfo.svelte";
  import UserInfo from "./pages/UserInfo.svelte";
  import Dashboard from "./pages/Dashboard.svelte";

  /// e.g., set to /app so /home corresponds to example.com/app/home
  const PREFIX = "";

  type Component = typeof SvelteComponent;
  interface Options {
    component: Component;
    transform?: (props: Record<string, string>) => Record<string, any>;
  }

  const routes: Record<string, Component | Options> = {
    "/university/add": AddUniversity,
    "/university/(?<id>\\d+)": {
      component: UniversityInfo,
      transform: ({ id }) => ({ id: Number.parseInt(id) }),
    },
    "/user/me": UserInfo,
    "/user/(?<mode>(login)|(create))": Login,
    "/(dashboard)?": Dashboard,
  };

  function isOptions(component: Component | Options): component is Options {
    return Object.hasOwn(component, "component");
  }

  const compiled: [RegExp, Options][] = Object.entries(routes).map(
    ([route, component]) => [
      new RegExp("^" + PREFIX + route + "$"),
      isOptions(component) ? component : { component },
    ]
  );

  export let defaultComponent: Component;

  let currentComponent = defaultComponent;
  let props: Record<string, any> = {};

  window.onpopstate = () => {
    updateRoute(window.location.pathname);
  };

  path.subscribe((path) => {
    history.pushState({}, "", path);
    updateRoute(path);
  });

  function updateRoute(path: string) {
    for (const [route, component] of compiled) {
      let match = path.match(route);
      if (match) {
        props = match.groups;

        if (component.transform) props = component.transform(props);

        currentComponent = component.component;
        return;
      }
    }
    props = {};
    currentComponent = defaultComponent;
  }

  updateRoute(window.location.pathname);
</script>

<svelte:component this={currentComponent} {...props} />
