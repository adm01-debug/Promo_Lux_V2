import { assertEquals, assert } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  normalizeScimPath,
  parsePatchOperations,
  parseUserNameFilter,
  SCIM_USER_SCHEMA,
  toScimUser,
  type MemberRow,
} from "../scim-core.ts";

const member: MemberRow = {
  id: "m1",
  organization_id: "org-1",
  user_id: "user-uuid-1",
  role: "viewer",
  scim_active: true,
  scim_external_id: null,
  created_at: "2026-01-01T00:00:00Z",
};

Deno.test("normalizeScimPath strips gateway prefix", () => {
  assertEquals(normalizeScimPath("/functions/v1/scim/v2/Users"), "/v2/Users");
});

Deno.test("normalizeScimPath strips bare /scim mount", () => {
  assertEquals(normalizeScimPath("/scim/v2/Users/user-1"), "/v2/Users/user-1");
});

Deno.test("normalizeScimPath keeps /v2 paths and normalizes leading slash", () => {
  assertEquals(normalizeScimPath("/v2/Users"), "/v2/Users");
  assertEquals(normalizeScimPath("v2/Users"), "/v2/Users");
});

Deno.test("parseUserNameFilter extracts quoted value", () => {
  assertEquals(parseUserNameFilter('userName eq "ana@empresa.com"'), "ana@empresa.com");
});

Deno.test("parseUserNameFilter is case-insensitive and returns null when absent", () => {
  assertEquals(parseUserNameFilter('USERNAME EQ "x@y.com"'), "x@y.com");
  assertEquals(parseUserNameFilter("displayName co foo"), null);
  assertEquals(parseUserNameFilter(""), null);
});

Deno.test("parsePatchOperations reads path=active boolean", () => {
  const r = parsePatchOperations({
    Operations: [{ op: "replace", path: "active", value: false }],
  });
  assertEquals(r.active, false);
});

Deno.test("parsePatchOperations reads externalId and ignores unrelated ops", () => {
  const r = parsePatchOperations({
    Operations: [
      { op: "replace", path: "externalId", value: "idp-42" },
      { op: "replace", path: "name.formatted", value: "Ignorado" },
    ],
  });
  assertEquals(r.externalId, "idp-42");
  assertEquals(r.active, undefined);
});

Deno.test("parsePatchOperations reads no-path object form", () => {
  const r = parsePatchOperations({
    Operations: [{ op: "replace", value: { active: true, externalId: "x" } }],
  });
  assertEquals(r.active, true);
  assertEquals(r.externalId, "x");
});

Deno.test("toScimUser serializes identity from auth user info", () => {
  const out = toScimUser(
    { ...member, scim_external_id: "ext-1" },
    { email: "ana@empresa.com", fullName: "Ana Silva" },
    "https://proj.supabase.co/functions/v1/scim",
  );
  assertEquals(out.schemas, [SCIM_USER_SCHEMA]);
  assertEquals(out.id, "user-uuid-1");
  assertEquals(out.userName, "ana@empresa.com");
  assertEquals(out.externalId, "ext-1");
  assertEquals(out.active, true);
  assertEquals((out.emails as Array<{ value: string }>)[0].value, "ana@empresa.com");
  assertEquals(
    (out.meta as { location: string }).location,
    "https://proj.supabase.co/functions/v1/scim/v2/Users/user-uuid-1",
  );
});

Deno.test("toScimUser falls back to user_id when email missing and omits externalId", () => {
  const out = toScimUser(member, { email: null, fullName: null }, "https://x");
  assertEquals(out.userName, "user-uuid-1");
  assert(!("externalId" in out));
  assertEquals(out.emails, []);
  assert(!("name" in out));
});
