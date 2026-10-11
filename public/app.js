let accessToken = null;

const output = document.querySelector("#output");

function show(data) {
  output.textContent = JSON.stringify(data, null, 2);
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

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

async function restoreSession() {
  const response = await fetch("/refresh", {
    method: "POST",
  });

  if (!response.ok) {
    accessToken = null;
    return;
  }

  const data = await response.json();
  accessToken = data.accessToken;

  console.log("Session restored!");
}

restoreSession();

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

document.querySelector("#profile").onclick = () =>
  request("/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

document.querySelector("#refresh").onclick = async () => {
  const data = await request("/refresh", {
    method: "POST",
  });

  if (data?.accessToken) {
    accessToken = data.accessToken;
  }
};

document.querySelector("#logout").onclick = async () => {
  await request("/logout", {
    method: "POST",
  });

  accessToken = null;
};
