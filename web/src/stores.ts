import { writable, type Writable, type Readable, derived } from "svelte/store";
import type { JwtInfo, User } from "./models";

export const path: Writable<string> = writable(window.location.pathname);

let jwt: string | null = localStorage.getItem("jwt");
let exps = localStorage.getItem("exp");
let exp: number | null = exps ? Number.parseInt(exps) : null;

export const auth: Writable<JwtInfo | null> = writable(
  jwt ? { jwt, exp } : null
);

export const isAuthed: Readable<boolean> = derived(auth, (val) => !!val, !!jwt);

auth.subscribe((val) => {
  if (val) {
    localStorage.setItem("jwt", val.jwt);
    localStorage.setItem("exp", val.exp.toString());
  } else {
    localStorage.removeItem("jwt");
    localStorage.removeItem("exp");
  }
});

export const authedFetch: Readable<
  (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>
> = derived(auth, (val) => {
  if (val) {
    return async (url: RequestInfo | URL, init: RequestInit = {}) => {
      if (!init.headers) init.headers = {};
      init.headers["Authorization"] = `Bearer ${val.jwt}`;
      let res = await fetch(url, init);

      if (res.status === 401) {
        auth.set(null);
      }

      return res;
    };
  } else {
    return (_: RequestInfo | URL, __: RequestInit = {}) => {
      throw new Error("not authed");
    };
  }
});

let setUser: (user: Promise<User | null>) => void = (user) => void user;
export const user: Readable<Promise<User | null>> = derived(
  auth,
  (val, set) => {
    setUser = set;
    if (!val) return null;
    updateUser(val.jwt);
  },
  Promise.resolve(null)
);

async function fetchUser(jwt: string | null): Promise<User | null> {
  if (!jwt) return null;
  let res = await fetch("/api/user/me", {
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
  });

  if (res.status === 401) {
    auth.set(null);
    return null;
  }

  return res.json();
}

export function updateUser(jwt: string | null) {
  setUser(fetchUser(jwt));
}

export const isDay = writable<boolean>(true);
