import type { Database } from "../../../../db/client.js";
import type { TerminalStateDao } from "../application/terminal-state.dao.js";

export class PrismaTerminalStateDao implements TerminalStateDao {
  private readonly database: Database;

  public constructor({ database }: { database: Database }) {
    this.database = database;
  }

  public async loadCwd(): Promise<string | null> {
    const row = await this.database.terminalState.findFirst({
      orderBy: {
        id: "asc",
      },
    });
    return row?.cwd ?? null;
  }

  public async saveCwd(input: { cwd: string }): Promise<void> {
    const existing = await this.database.terminalState.findFirst({
      orderBy: {
        id: "asc",
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      await this.database.terminalState.update({
        where: {
          id: existing.id,
        },
        data: {
          cwd: input.cwd,
        },
      });
      return;
    }

    await this.database.terminalState.create({
      data: {
        cwd: input.cwd,
      },
    });
  }
}
