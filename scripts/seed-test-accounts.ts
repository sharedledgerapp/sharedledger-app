import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { db, pool } from "../server/db";
import { families, users } from "../shared/schema";
import { eq } from "drizzle-orm";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

const PASSWORD = "Demo1234!";

const GROUPS = [
  { name: "The Johnson Family", code: "FAM-TEST", groupType: "family" as const },
  { name: "Flat 12", code: "GRP-TEST", groupType: "roommates" as const },
  { name: "Our Home", code: "CPL-TEST", groupType: "couple" as const },
];

const USERS = [
  { username: "alice_parent", name: "Alice Johnson", role: "parent" as const, group: "The Johnson Family" },
  { username: "bob_child", name: "Bob Johnson", role: "child" as const, group: "The Johnson Family" },
  { username: "carlos_room", name: "Carlos Rivera", role: "member" as const, group: "Flat 12" },
  { username: "dana_room", name: "Dana Chen", role: "member" as const, group: "Flat 12" },
  { username: "eve_partner", name: "Eve Martin", role: "member" as const, group: "Our Home" },
  { username: "frank_partner", name: "Frank Martin", role: "member" as const, group: "Our Home" },
];

async function seed() {
  console.log("Seeding test accounts...\n");

  const groupIdMap: Record<string, number> = {};

  for (const group of GROUPS) {
    const [existing] = await db.select().from(families).where(eq(families.name, group.name)).limit(1);
    if (existing) {
      console.log(`  [skip] Group "${group.name}" already exists (id=${existing.id})`);
      groupIdMap[group.name] = existing.id;
    } else {
      const [created] = await db.insert(families).values(group).returning();
      console.log(`  [created] Group "${group.name}" (id=${created.id}, type=${group.groupType})`);
      groupIdMap[group.name] = created.id;
    }
  }

  console.log("");

  for (const u of USERS) {
    const [existing] = await db.select().from(users).where(eq(users.username, u.username)).limit(1);
    if (existing) {
      console.log(`  [skip] User "${u.username}" already exists (id=${existing.id})`);
    } else {
      const familyId = groupIdMap[u.group];
      const hashed = await hashPassword(PASSWORD);
      const [created] = await db.insert(users).values({
        username: u.username,
        password: hashed,
        name: u.name,
        role: u.role,
        familyId,
      }).returning();
      console.log(`  [created] User "${u.username}" (id=${created.id}, role=${u.role}, group="${u.group}")`);
    }
  }

  console.log("\n" + "=".repeat(72));
  console.log("  TEST ACCOUNT CREDENTIALS");
  console.log("=".repeat(72));
  console.log("");
  console.log("  Group Type   | Group Name           | Username        | Password   | Role");
  console.log("  -------------|----------------------|-----------------|------------|-------");
  console.log("  Family       | The Johnson Family   | alice_parent    | Demo1234!  | parent");
  console.log("  Family       | The Johnson Family   | bob_child       | Demo1234!  | child");
  console.log("  Roommates    | Flat 12              | carlos_room     | Demo1234!  | member");
  console.log("  Roommates    | Flat 12              | dana_room       | Demo1234!  | member");
  console.log("  Couple       | Our Home             | eve_partner     | Demo1234!  | member");
  console.log("  Couple       | Our Home             | frank_partner   | Demo1234!  | member");
  console.log("");
  console.log("=".repeat(72));
  console.log("Done!\n");
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => {
    pool.end();
  });
