/**
 * In-memory mock of the SplitBill backend contract (backend/README.md +
 * backend/AI_NOTES.md §4–§6, plus the proposed auth endpoints in
 * AI_NOTES.md §4.1) for developing and verifying the frontend while the real
 * backend endpoints are still landing. DEV TOOL ONLY — not part of the app
 * bundle.
 *
 *   BACKEND_ORIGIN=http://127.0.0.1:9999 npm run dev
 *   … or: npm run mock   (listens on :9999)
 *
 * Implements: GET /health,
 * POST /auth/register, POST /auth/login, POST /auth/logout, GET /auth/me,
 * GET /groups, GET /groups/{id},
 * POST /groups, PATCH|DELETE /groups/{id} (owner), POST /groups/{id}/invite/reset (owner),
 * DELETE /groups/{id}/members/{name} (owner, or self to leave; settled balances only),
 * GET /invites/{code}, POST /invites/{code}/join,
 * POST /groups/{id}/expenses (Idempotency-Key), GET /groups/{id}/expenses,
 * PUT|DELETE /groups/{id}/expenses/{id} (payer only), GET /groups/{id}/balances.
 *
 * Identity comes from the HttpOnly `sb_session` cookie set by login/register.
 * Money is string-in → integer cents → string-out, matching §4.1, including
 * the golden example (1000.00 among alice/bob/carol → 333.34/333.33/333.33).
 */

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_PORT ?? 9999);
const SESSION_COOKIE = "sb_session";
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
/** Demo password for the seeded accounts. Mock only — never reuse it anywhere real. */
const DEMO_PASSWORD = "splitbill123";

const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;
const MIN_PASSWORD_LENGTH = 8;

function hashPassword(password) {
  const salt = randomBytes(16);
  return { salt, hash: scryptSync(password, salt, 32) };
}

function verifyPassword(password, record) {
  const candidate = scryptSync(password, record.salt, 32);
  return timingSafeEqual(candidate, record.hash);
}

/** @type {Map<string, {salt: Buffer; hash: Buffer}>} username → password record */
const users = new Map(
  ["alice", "bob", "carol", "dave"].map((name) => [name, hashPassword(DEMO_PASSWORD)]),
);

/** @type {Map<string, string>} session token → username */
const sessions = new Map();

const newInviteCode = () => randomBytes(9).toString("base64url");

const groups = [
  { id: 1, name: "Ari Condo 12A", members: ["alice", "bob", "carol"], owner: "alice", invite_code: newInviteCode() },
  { id: 2, name: "Lat Phrao House", members: ["alice", "bob"], owner: "alice", invite_code: newInviteCode() },
  { id: 3, name: "Chiang Mai Flat", members: ["bob", "carol", "dave"], owner: "bob", invite_code: newInviteCode() },
];
let nextGroupId = 4;

/** @type {Map<number, Array<{id:number;description:string;paid_by:string;amount:string;split:object;created_at:string}>>} */
const expensesByGroup = new Map([[1, []], [2, []], [3, []]]);
let nextExpenseId = 1;

/** Demo bills so the ledger isn't empty on first run. */
function seedExpense(groupId, daysAgo, description, paidBy, amount, split) {
  const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  expensesByGroup.get(groupId).push({
    id: nextExpenseId++,
    description,
    paid_by: paidBy,
    amount,
    split,
    created_at: createdAt,
  });
}
seedExpense(1, 13, "Rent November", "alice", "18000.00", {
  type: "exact",
  shares: { alice: "7000.00", bob: "5500.00", carol: "5500.00" },
});
seedExpense(1, 9, "Internet (True 1Gbps)", "bob", "599.00", {
  type: "equal",
  members: ["alice", "bob", "carol"],
});
seedExpense(1, 4, "Makro groceries", "carol", "2315.40", {
  type: "equal",
  members: ["alice", "bob", "carol"],
});
seedExpense(1, 2, "Electricity October", "alice", "1842.75", {
  type: "equal",
  members: ["alice", "bob", "carol"],
});
seedExpense(2, 6, "Water bill", "bob", "212.00", { type: "equal", members: ["alice", "bob"] });

/** @type {Map<string, {status:number;body:unknown;requestBody:string}>} scoped per (group_id, key) — §4.6 */
const idempotencyStore = new Map();

function fail(res, status, detail) {
  res._mockDetail = detail;
  return json(res, status, { detail });
}

function json(res, status, body, headers = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(payload);
}

function sessionCookie(token) {
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}`;
}

function clearedSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

function readCookie(req, name) {
  const header = req.headers.cookie;
  if (typeof header !== "string") return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return undefined;
}

function sessionUser(req) {
  const token = readCookie(req, SESSION_COOKIE);
  return token === undefined ? undefined : sessions.get(token);
}

function startSession(username) {
  const token = randomBytes(24).toString("base64url");
  sessions.set(token, username);
  return token;
}

/** Parse "1234.5" → integer cents; null when malformed (§4.1). */
function toCents(raw) {
  if (typeof raw !== "string") return null;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(raw.trim());
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

function fromCents(cents) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Equal split with leftover cents one-at-a-time in members-list order (§4.2). */
function equalSplitCents(totalCents, count) {
  const base = Math.floor(totalCents / count);
  const remainder = totalCents % count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

/** Trimmed, single-spaced group name, or null when empty / too long. */
function cleanName(raw) {
  if (typeof raw !== "string") return null;
  const name = raw.split(/\s+/).filter(Boolean).join(" ");
  return name.length > 0 && name.length <= 100 ? name : null;
}

/** member → cents (paid − owed) over the group's bills; positive = owed to them (§4.4). */
function computeBalances(group) {
  /** @type {Record<string, number>} */
  const centsByMember = Object.fromEntries(group.members.map((member) => [member, 0]));
  for (const expense of expensesByGroup.get(group.id) ?? []) {
    centsByMember[expense.paid_by] = (centsByMember[expense.paid_by] ?? 0) + toCents(expense.amount);
    const total = toCents(expense.amount);
    const shares =
      expense.split.type === "equal"
        ? expense.split.members.map((member, index) => [
            member,
            equalSplitCents(total, expense.split.members.length)[index],
          ])
        : Object.entries(expense.split.shares).map(([member, share]) => [member, toCents(share)]);
    for (const [member, share] of shares) {
      centsByMember[member] = (centsByMember[member] ?? 0) - share;
    }
  }
  return centsByMember;
}

/**
 * Apply the expense rules (§4.1–4.3) to a request body. Returns `{ error }` or
 * `{ fields, shares }` where shares are "333.34"-style strings in split order.
 */
function checkExpense(body, group) {
  const totalCents = toCents(body?.amount);
  if (totalCents === null || totalCents <= 0) {
    return { error: 'The amount must be a positive amount with at most 2 decimals, like "250.50".' };
  }
  if (typeof body?.description !== "string" || body.description.trim() === "") {
    return { error: "Add a description." };
  }
  if (!group.members.includes(body?.paid_by)) {
    return { error: "The payer must be a member of this group." };
  }
  const split = body?.split;
  let shares;
  if (split?.type === "equal") {
    const members = split.members;
    if (!Array.isArray(members) || members.length === 0) {
      return { error: "An equal split needs at least one member." };
    }
    if (members.some((member) => !group.members.includes(member))) {
      return { error: "Every member of the split must be in this group." };
    }
    const shareList = equalSplitCents(totalCents, members.length);
    shares = members.map((member, index) => [member, shareList[index]]);
  } else if (split?.type === "exact") {
    const entries = Object.entries(split?.shares ?? {});
    if (entries.length === 0) return { error: "An exact split needs at least one share." };
    if (entries.some(([member]) => !group.members.includes(member))) {
      return { error: "Every member of the split must be in this group." };
    }
    shares = entries.map(([member, share]) => [member, toCents(share)]);
    if (shares.some(([, cents]) => cents === null)) return { error: "Every share must be a valid amount." };
    const allocated = shares.reduce((total, [, cents]) => total + cents, 0);
    if (allocated !== totalCents) return { error: "The shares do not add up to the total." };
  } else {
    return { error: 'The split type must be "equal" or "exact".' };
  }
  return {
    fields: {
      description: body.description.trim(),
      paid_by: body.paid_by,
      amount: fromCents(totalCents),
      split,
    },
    shares: Object.fromEntries(shares.map(([member, cents]) => [member, fromCents(cents)])),
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function parseJson(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

async function handleAuth(req, res, path) {
  if (path === "/auth/me") {
    if (req.method !== "GET") return fail(res, 405, "Method not allowed.");
    const username = sessionUser(req);
    if (username === undefined) return fail(res, 401, "You are not signed in.");
    return json(res, 200, { username });
  }

  if (path === "/auth/logout") {
    if (req.method !== "POST") return fail(res, 405, "Method not allowed.");
    const token = readCookie(req, SESSION_COOKIE);
    if (token !== undefined) sessions.delete(token);
    res.writeHead(204, { "Set-Cookie": clearedSessionCookie() });
    return res.end();
  }

  if (path !== "/auth/login" && path !== "/auth/register") return fail(res, 404, "Not Found");
  if (req.method !== "POST") return fail(res, 405, "Method not allowed.");

  const parsed = parseJson(await readBody(req));
  if (!parsed.ok) return fail(res, 422, "Request body must be valid JSON.");
  const username = typeof parsed.value?.username === "string" ? parsed.value.username.trim() : "";
  const password = typeof parsed.value?.password === "string" ? parsed.value.password : "";

  if (path === "/auth/login") {
    const record = users.get(username);
    if (record === undefined || !verifyPassword(password, record)) {
      return fail(res, 401, "Incorrect username or password.");
    }
    return json(res, 200, { username }, { "Set-Cookie": sessionCookie(startSession(username)) });
  }

  // /auth/register
  if (!USERNAME_PATTERN.test(username)) {
    return fail(
      res,
      400,
      "Usernames are 3–32 characters: lowercase letters, numbers, dots, dashes or underscores.",
    );
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return fail(res, 400, `Passwords need at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (users.has(username)) return fail(res, 409, "That username is already taken.");
  users.set(username, hashPassword(password));
  return json(res, 201, { username }, { "Set-Cookie": sessionCookie(startSession(username)) });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const path = url.pathname;
  res.on("finish", () => {
    const note = res.statusCode >= 400 ? ` (${res._mockDetail ?? ""})` : "";
    console.log(`${req.method} ${path} → ${res.statusCode}${note}`);
  });

  if (path === "/health") {
    return json(res, 200, { status: "ok", database: "up (mock)", env: "mock" });
  }

  if (path.startsWith("/auth/")) return handleAuth(req, res, path);

  const user = sessionUser(req);
  if (user === undefined) return fail(res, 401, "You are not signed in.");

  if (path === "/groups") {
    if (req.method === "GET") {
      return json(res, 200, groups.filter((group) => group.members.includes(user)));
    }
    if (req.method !== "POST") return fail(res, 405, "Method not allowed.");
    const parsed = parseJson(await readBody(req));
    const name = parsed.ok ? cleanName(parsed.value?.name) : null;
    if (name === null) return fail(res, 400, "Give the group a name (up to 100 characters).");
    const group = { id: nextGroupId++, name, members: [user], owner: user, invite_code: newInviteCode() };
    groups.push(group);
    expensesByGroup.set(group.id, []);
    return json(res, 201, group);
  }

  const inviteMatch = /^\/invites\/([^/]+)(\/join)?$/.exec(path);
  if (inviteMatch) {
    const group = groups.find((candidate) => candidate.invite_code === inviteMatch[1]);
    if (!group) return fail(res, 404, "This invite link is not valid. Ask for a new one.");
    if (inviteMatch[2] === undefined && req.method === "GET") {
      return json(res, 200, {
        group_id: group.id,
        name: group.name,
        owner: group.owner,
        member_count: group.members.length,
        already_member: group.members.includes(user),
      });
    }
    if (inviteMatch[2] !== undefined && req.method === "POST") {
      if (!group.members.includes(user)) group.members.push(user);
      return json(res, 200, group);
    }
    return fail(res, 405, "Method not allowed.");
  }

  const groupMatch = /^\/groups\/(\d+)(\/expenses(?:\/(\d+))?|\/balances|\/invite\/reset|\/members\/([^/]+))?$/.exec(path);
  if (!groupMatch) return fail(res, 404, "Not Found");

  const groupId = Number(groupMatch[1]);
  const group = groups.find((candidate) => candidate.id === groupId);
  if (!group) return fail(res, 404, "Group not found.");
  if (!group.members.includes(user)) return fail(res, 403, "You are not a member of this group.");
  const isOwner = group.owner === user;

  const subPath = groupMatch[2] ?? "";
  const expenseId = groupMatch[3] === undefined ? null : Number(groupMatch[3]);

  if (subPath === "") {
    if (req.method === "GET") return json(res, 200, group);
    if (!isOwner) return fail(res, 403, "Only the group's owner can do that.");
    if (req.method === "PATCH") {
      const parsed = parseJson(await readBody(req));
      const name = parsed.ok ? cleanName(parsed.value?.name) : null;
      if (name === null) return fail(res, 400, "Give the group a name (up to 100 characters).");
      group.name = name;
      return json(res, 200, group);
    }
    if (req.method === "DELETE") {
      groups.splice(groups.indexOf(group), 1);
      expensesByGroup.delete(groupId);
      res.writeHead(204);
      return res.end();
    }
    return fail(res, 405, "Method not allowed.");
  }

  if (subPath === "/invite/reset") {
    if (req.method !== "POST") return fail(res, 405, "Method not allowed.");
    if (!isOwner) return fail(res, 403, "Only the group's owner can do that.");
    group.invite_code = newInviteCode();
    return json(res, 200, group);
  }

  if (groupMatch[4] !== undefined) {
    if (req.method !== "DELETE") return fail(res, 405, "Method not allowed.");
    const member = decodeURIComponent(groupMatch[4]);
    if (member !== user && !isOwner) return fail(res, 403, "Only the group's owner can do that.");
    if (!group.members.includes(member)) return fail(res, 400, `${member} is not a member of this group.`);
    if (member === group.owner) {
      return fail(res, 409, "The owner can't leave the group. Delete the group instead.");
    }
    if ((computeBalances(group)[member] ?? 0) !== 0) {
      return fail(res, 409, `${member} still has a balance in this group. Settle it to 0.00 before they leave.`);
    }
    group.members = group.members.filter((candidate) => candidate !== member);
    res.writeHead(204);
    return res.end();
  }

  if (subPath === "/balances") {
    if (req.method !== "GET") return fail(res, 405, "Method not allowed.");
    const centsByMember = computeBalances(group);
    return json(
      res,
      200,
      group.members.map((member) => ({ member, balance: fromCents(centsByMember[member] ?? 0) })),
    );
  }

  if (subPath === "/expenses" || expenseId !== null) {
    const expenses = expensesByGroup.get(groupId) ?? [];

    if (req.method === "GET" && expenseId === null) {
      // Reverse chronological, newest id first on ties (§5).
      const sorted = [...expenses].sort((a, b) => b.id - a.id);
      return json(res, 200, sorted);
    }

    if (req.method === "POST" && expenseId === null) {
      const idempotencyKey = req.headers["idempotency-key"];
      if (typeof idempotencyKey !== "string" || idempotencyKey === "") {
        return fail(res, 400, "The Idempotency-Key header is required.");
      }
      const cacheKey = `${groupId}:${idempotencyKey}`;
      const cached = idempotencyStore.get(cacheKey);
      const bodyText = await readBody(req);
      if (cached !== undefined) {
        if (cached.requestBody !== bodyText) {
          return fail(res, 409, "This Idempotency-Key was already used with a different request.");
        }
        return json(res, cached.status, cached.body); // replay original response (§4.6)
      }

      const parsed = parseJson(bodyText);
      if (!parsed.ok) return fail(res, 422, "Request body must be valid JSON.");
      const checked = checkExpense(parsed.value, group);
      if (checked.error) return fail(res, 400, checked.error);

      const expense = {
        id: nextExpenseId++,
        ...checked.fields,
        created_at: new Date().toISOString(),
      };
      expenses.push(expense);
      const responseBody = { ...expense, shares: checked.shares };
      idempotencyStore.set(cacheKey, { status: 201, body: responseBody, requestBody: bodyText });
      return json(res, 201, responseBody);
    }

    const expense = expenses.find((candidate) => candidate.id === expenseId);

    if (req.method === "PUT" && expenseId !== null) {
      if (!expense) return fail(res, 404, "Expense not found.");
      if (expense.paid_by !== user) {
        return fail(res, 403, "Only the person who paid can change or delete this expense.");
      }
      const parsed = parseJson(await readBody(req));
      if (!parsed.ok) return fail(res, 422, "Request body must be valid JSON.");
      const checked = checkExpense(parsed.value, group);
      if (checked.error) return fail(res, 400, checked.error);
      Object.assign(expense, checked.fields);
      return json(res, 200, { ...expense, shares: checked.shares });
    }

    if (req.method === "DELETE" && expenseId !== null) {
      if (!expense) return fail(res, 404, "Expense not found.");
      if (expense.paid_by !== user) {
        return fail(res, 403, "Only the person who paid can change or delete this expense.");
      }
      expensesByGroup.set(groupId, expenses.filter((candidate) => candidate.id !== expenseId));
      res.writeHead(204);
      return res.end();
    }
  }

  return fail(res, 405, "Method not allowed.");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Mock SplitBill backend on http://127.0.0.1:${PORT}`);
  console.log(`Demo accounts: alice, bob, carol, dave — password "${DEMO_PASSWORD}"`);
});
