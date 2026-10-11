let accessToken = null;
let refreshPromise = null;

const output = document.querySelector("#output");

async function refreshAccessToken() {
  // if a refresh is already running, reuse its promise.
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const response = await fetch("/refresh", {
      method: "POST",
    });

    if (!response.ok) {
      accessToken = null;
      return false;
    }

    const data = await response.json();
    accessToken = data.accessToken;

    return true;
  })();

  try {
    return await refreshPromise;
  } finally {
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
    return fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
        ...(requiresAuth && accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : {}),
      },
    });
  }

  let response = await sendRequest();

  // JWT expired? Refresh and retry once.
  if (response.status === 401 && requiresAuth) {
    const refreshed = await refreshAccessToken();

    if (refreshed) {
      response = await sendRequest();
    }
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
  const data = await request("/login", {
    method: "POST",
    body: JSON.stringify(credentials()),
  });

  if (data?.accessToken) {
    accessToken = data.accessToken;
  }
};

document.querySelector("#profile").onclick = () => request("/me", {}, true);

document.querySelector("#refresh").onclick = async () => {
  const refreshed = await refreshAccessToken();

  show({ refreshed });
};

document.querySelector("#logout").onclick = async () => {
  await request("/logout", {
    method: "POST",
  });

  accessToken = null;
};
