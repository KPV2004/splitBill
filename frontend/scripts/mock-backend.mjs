/**
 * In-memory mock of the SplitBill backend contract (backend/README.md +
 * backend/AI_NOTES.md §4–§6) for developing and verifying the frontend while
 * the real backend endpoints are still landing. DEV TOOL ONLY — not part of
 * the app bundle.
 *
 *   BACKEND_ORIGIN=http://127.0.0.1:9999 npm run dev
 *   … or: npm run mock   (listens on :9999)
 *
 * Implements: GET /health, GET /groups, GET /groups/{id},
 * POST /groups/{id}/expenses (Idempotency-Key), GET /groups/{id}/expenses,
 * DELETE /groups/{id}/expenses/{id} (payer only), GET /groups/{id}/balances.
 * Money is string-in → integer cents → string-out, matching §4.1, including
 * the golden example (1000.00 among alice/bob/carol → 333.34/333.33/333.33).
 */

import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_PORT ?? 9999);

const groups = [
  { id: 1, name: "Bangkok Trip", members: ["alice", "bob", "carol"] },
  { id: 2, name: "Office Lunch", members: ["alice", "bob"] },
  { id: 3, name: "Chiang Mai 2026", members: ["bob", "carol", "dave"] },
];

/** @type {Map<number, Array<{id:number;description:string;paid_by:string;amount:string;split:object;created_at:string}>>} */
const expensesByGroup = new Map([[1, []], [2, []], [3, []]]);
let nextExpenseId = 1;

/** @type {Map<string, {status:number;body:unknown}>} scoped per (group_id, key) — §4.6 */
const idempotencyStore = new Map();

function fail(res, status, detail) {
  res._mockDetail = detail;
  return json(res, status, { detail });
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(payload);
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

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const path = url.pathname;
  const user = req.headers["x-user"];
  res.on("finish", () => {
    const note = res.statusCode >= 400 ? ` (${res._mockDetail ?? ""})` : "";
    console.log(`${req.method} ${path} → ${res.statusCode}${note}`);
  });

  if (path === "/health") {
    return json(res, 200, { status: "ok", database: "up (mock)", env: "mock" });
  }

  if (user === undefined) return fail(res, 401, "Missing X-User header.");

  if (path === "/groups") {
    return json(res, 200, groups.filter((group) => group.members.includes(user)));
  }

  const groupMatch = /^\/groups\/(\d+)(\/expenses(?:\/(\d+))?|\/balances)?$/.exec(path);
  if (!groupMatch) return fail(res, 404, "Not Found");

  const groupId = Number(groupMatch[1]);
  const group = groups.find((candidate) => candidate.id === groupId);
  if (!group) return fail(res, 404, "Group not found.");
  if (!group.members.includes(user)) return fail(res, 403, "Not a member of this group.");

  const subPath = groupMatch[2] ?? "";
  const expenseId = groupMatch[3] === undefined ? null : Number(groupMatch[3]);

  if (req.method === "GET" && subPath === "") {
    return json(res, 200, group);
  }

  if (subPath === "/balances") {
    if (req.method !== "GET") return fail(res, 405, "Method not allowed.");
    const expenses = expensesByGroup.get(groupId) ?? [];
    /** @type {Record<string, number>} */
    const centsByMember = Object.fromEntries(group.members.map((member) => [member, 0]));
    for (const expense of expenses) {
      centsByMember[expense.paid_by] += toCents(expense.amount);
      const shares =
        expense.split.type === "equal"
          ? Object.fromEntries(
              expense.split.members.map((member, index) => [
                member,
                equalSplitCents(toCents(expense.amount), expense.split.members.length)[index],
              ]),
            )
          : Object.fromEntries(
              Object.entries(expense.split.shares).map(([member, share]) => [member, toCents(share)]),
            );
      for (const [member, share] of Object.entries(shares)) {
        centsByMember[member] -= share;
      }
    }
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
        return fail(res, 400, "Missing Idempotency-Key header.");
      }
      const cacheKey = `${groupId}:${idempotencyKey}`;
      const cached = idempotencyStore.get(cacheKey);
      const bodyText = await readBody(req);
      if (cached !== undefined) {
        if (cached.requestBody !== bodyText) {
          return fail(res, 409, "This Idempotency-Key was already used with a different request body.");
        }
        return json(res, cached.status, cached.body); // replay original response (§4.6)
      }

      let body;
      try {
        body = JSON.parse(bodyText);
      } catch {
        return fail(res, 422, "Request body must be valid JSON.");
      }
      const totalCents = toCents(body?.amount);
      if (totalCents === null || totalCents <= 0) {
        return fail(res, 400, "Amount must be a positive string amount like \"250.50\".");
      }
      if (typeof body?.description !== "string" || body.description.trim() === "") {
        return fail(res, 400, "Description is required.");
      }
      if (!group.members.includes(body?.paid_by)) {
        return fail(res, 400, "Payer must be a member of this group.");
      }

      const split = body?.split;
      let shares;
      if (split?.type === "equal") {
        const members = split.members;
        if (!Array.isArray(members) || members.length === 0) {
          return fail(res, 400, "Equal split needs a non-empty members list.");
        }
        if (members.some((member) => !group.members.includes(member))) {
          return fail(res, 400, "Equal split members must all be members of this group.");
        }
        const shareList = equalSplitCents(totalCents, members.length);
        shares = Object.fromEntries(members.map((member, index) => [member, shareList[index]]));
      } else if (split?.type === "exact") {
        const entries = Object.entries(split?.shares ?? {});
        if (entries.length === 0) return fail(res, 400, "Exact split needs shares.");
        if (entries.some(([member]) => !group.members.includes(member))) {
          return fail(res, 400, "Exact split shares must be for existing members only.");
        }
        shares = Object.fromEntries(entries.map(([member, share]) => [member, toCents(share)]));
        if (Object.values(shares).some((cents) => cents === null)) {
          return fail(res, 400, "Every share must be a valid amount.");
        }
        const allocated = Object.values(shares).reduce((total, cents) => total + cents, 0);
        if (allocated !== totalCents) {
          return fail(res, 400, "The shares do not add up to the total.");
        }
      } else {
        return fail(res, 400, "Split type must be \"equal\" or \"exact\".");
      }

      const expense = {
        id: nextExpenseId++,
        description: body.description.trim(),
        paid_by: body.paid_by,
        amount: fromCents(totalCents),
        split,
        created_at: new Date().toISOString(),
      };
      expenses.push(expense);
      // Response body includes how the backend actually split the money.
      const responseBody = { ...expense, shares: Object.fromEntries(Object.entries(shares).map(([m, c]) => [m, fromCents(c)])) };
      idempotencyStore.set(cacheKey, { status: 201, body: responseBody, requestBody: bodyText });
      return json(res, 201, responseBody);
    }

    if (req.method === "DELETE" && expenseId !== null) {
      const expense = expenses.find((candidate) => candidate.id === expenseId);
      if (!expense) return fail(res, 404, "Expense not found.");
      if (expense.paid_by !== user) {
        return fail(res, 403, "Only the payer can delete an expense.");
      }
      expensesByGroup.set(groupId, expenses.filter((candidate) => candidate.id !== expenseId));
      res.writeHead(204);
      return res.end();
    }
  }

  return fail(res, 405, "Method not allowed.");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Mock SplitBill backend on http://127.0.0.1:${PORT} (users: alice, bob, carol, dave)`);
});
