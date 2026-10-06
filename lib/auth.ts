import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { employeeTable, getBigQuery } from "./bigquery";

/** Value this app's rows carry in employee.Project_id (single value or comma-separated list). */
const PROJECT_SYSTEM = (process.env.PROJECT_SYSTEM || "order_verification").toLowerCase();

async function queryEmployeeName(email: string): Promise<string | null> {
  const [rows] = await getBigQuery().query({
    query: `
      SELECT display_name AS name
      FROM ${employeeTable()}
      WHERE LOWER(work_email) = LOWER(@email)
        AND EXISTS (
          SELECT 1 FROM UNNEST(SPLIT(Project_id, ',')) AS system
          WHERE LOWER(TRIM(system)) = @projectSystem
        )
      LIMIT 1
    `,
    params: { email, projectSystem: PROJECT_SYSTEM }
  });
  return rows.length ? String(rows[0].name ?? email) : null;
}

/** One retry absorbs a cold-start BigQuery hiccup that would otherwise look like "not registered". */
async function lookupEmployee(email: string): Promise<string | null> {
  try {
    return await queryEmployeeName(email);
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return await queryEmployeeName(email);
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!
    })
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      return (await lookupEmployee(user.email)) !== null;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const name = await lookupEmployee(user.email);
        if (name) token.name = name;
      }
      return token;
    }
  }
};
