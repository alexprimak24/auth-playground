let accessToken = null;
let refreshPromise = null;
// current authentication state
let sessionVersion = 0;

const output = document.querySelector("#output");

async function refreshAccessToken() {
  // if a refresh is already running, reuse its promise.
  if (refreshPromise) {
    return refreshPromise;
  }

  const version = sessionVersion;

  const promise = (async () => {
    const response = await fetch("/refresh", {
      method: "POST",
    });

    if (!response.ok) {
      if (version === sessionVersion) {
        accessToken = null;
      }

      return false;
    }

    const data = await response.json();

    // ignore responses belonging to an older session
    if (version !== sessionVersion) {
      return false;
    }

    accessToken = data.accessToken;
    return true;
  })();

  refreshPromise = promise;

  try {
    return await promise;
  } finally {
    // set to null, so on refresh, we can refresh again
    refreshPromise = null;
  }
}

const sessionReady = refreshAccessToken();

function show(data) {
  output.textContent = JSON.stringify(data, null, 2);
}

async function request(path, options = {}, requiresAuth = false) {
  if (requiresAuth) {
    // wait until initial session restoration finishes
    await sessionReady;
  }

  async function sendRequest() {
    // this is like a snapshot
    const tokenUsed = accessToken;

    const response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
        ...(requiresAuth && tokenUsed
          ? { Authorization: `Bearer ${tokenUsed}` }
          : {}),
      },
    });

    return { response, tokenUsed };
  }
  // we call sendReques
  let { response, tokenUsed } = await sendRequest();
  // in case we receive 401, we check whether the token we did request with is the same, if not - we treat that accessToken as already rotated , and therefore without refreshing we are trying again
  if (response.status === 401 && requiresAuth) {
    //another request may have already refreshed out token
    if (accessToken !== tokenUsed && accessToken !== null) {
      // a newer token exists, no need to refresh
    } else {
      const refreshed = await refreshAccessToken();

      if (!refreshed) {
        show({ status: 401, error: "Session expired" });
        return null;
      }
    }
    // retry with the latest access token
    // () are needed to tell that this is not a code block, it is object destructuring assignment
    ({ response } = await sendRequest());
  }

  const data = await response.json().catch(() => null);

  show({
    status: response.status,
    data,
  });

  return data;
}

function credentials() {
  return {
    email: document.querySelector("#email").value,
    password: document.querySelector("#password").value,
  };
}

document.querySelector("#register").onclick = () =>
  request("/register", {
    method: "POST",
    body: JSON.stringify(credentials()),
  });

document.querySelector("#login").onclick = async () => {
  const version = ++sessionVersion;

  const data = await request("/login", {
    method: "POST",
    body: JSON.stringify(credentials()),
  });

  if (version === sessionVersion && data?.accessToken) {
    accessToken = data.accessToken;
  }
};

document.querySelector("#profile").onclick = () => request("/me", {}, true);

document.querySelector("#refresh").onclick = async () => {
  const refreshed = await refreshAccessToken();

  show({ refreshed });
};

document.querySelector("#logout").onclick = async () => {
  // invalidate pending refresh results immidiately
  ++sessionVersion;
  accessToken = null;

  await request("/logout", {
    method: "POST",
  });
};
