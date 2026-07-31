const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const usersPath = path.join(root, "users.json");

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname.startsWith("/api/auth/")) {
    handleAuth(request, response, url);
    return;
  }

  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(root, pathname));

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "content-type": types[path.extname(filePath)] || "application/octet-stream",
      "cache-control": "no-store",
    });
    response.end(data);
  });
});

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 64 * 1024) {
        reject(new Error("Request body too large"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function readUsers() {
  if (!fs.existsSync(usersPath)) return { users: [] };
  try {
    return JSON.parse(fs.readFileSync(usersPath, "utf8"));
  } catch {
    return { users: [] };
  }
}

function writeUsers(data) {
  fs.writeFileSync(usersPath, `${JSON.stringify(data, null, 2)}\n`);
}

function hashPassword(password, salt) {
  return crypto.createHash("sha256").update(`${salt}:${password}`).digest("hex");
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
  };
}

async function handleAuth(request, response, url) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(await readBody(request));
  } catch {
    sendJson(response, 400, { error: "Invalid JSON" });
    return;
  }

  const data = readUsers();
  if (url.pathname === "/api/auth/login") {
    const email = String(payload.email || "").trim().toLowerCase();
    const password = String(payload.password || "");
    const user = data.users.find((item) => item.email === email);
    if (!user || user.passwordHash !== hashPassword(password, user.salt)) {
      sendJson(response, 401, { error: "Invalid email or password" });
      return;
    }
    sendJson(response, 200, {
      token: Buffer.from(`${user.id}:${Date.now()}`).toString("base64url"),
      user: publicUser(user),
    });
    return;
  }

  if (url.pathname === "/api/auth/register") {
    const email = String(payload.email || "").trim().toLowerCase();
    const password = String(payload.password || "");
    const name = String(payload.name || "").trim() || email.split("@")[0];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      sendJson(response, 400, { error: "Use a valid email address" });
      return;
    }
    if (password.length < 8) {
      sendJson(response, 400, { error: "Password must be at least 8 characters" });
      return;
    }
    if (data.users.some((item) => item.email === email)) {
      sendJson(response, 409, { error: "Account already exists" });
      return;
    }
    const salt = crypto.randomBytes(16).toString("hex");
    const user = {
      id: crypto.randomUUID(),
      email,
      name,
      role: "user",
      salt,
      passwordHash: hashPassword(password, salt),
      createdAt: new Date().toISOString(),
    };
    data.users.push(user);
    writeUsers(data);
    sendJson(response, 201, {
      token: Buffer.from(`${user.id}:${Date.now()}`).toString("base64url"),
      user: publicUser(user),
    });
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

server.listen(port, "127.0.0.1", () => {
  console.log(`Linsea Tools running at http://127.0.0.1:${port}`);
});
