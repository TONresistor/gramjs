const {
  compareSchemas,
  parseSchema,
  resolveRepositoryPath,
  validateRemovals,
} = require("../../scripts/schema-diff");

describe("schema semantic diff", () => {
  const from = parseSchema(
    [
      "---types---",
      "kept#00000001 value:int = Kept;",
      "changed#00000002 value:int = Changed;",
      "removed#00000003 = Removed;",
      "---functions---",
      "messages.call#00000004 value:int = Kept;",
      "// LAYER 1",
    ].join("\n"),
    "from fixture"
  );
  const to = parseSchema(
    [
      "---types---",
      "kept#00000001 value:int = Kept;",
      "changed#00000005 value:string = Changed;",
      "added#00000006 = Added;",
      "---functions---",
      "messages.call#00000004 value:string = Kept;",
      "// LAYER 2",
    ].join("\n"),
    "to fixture"
  );
  const diff = compareSchemas(from, to, 1, 2);

  test("classifies definitions and constructor ID changes", () => {
    expect(diff.summary).toEqual({
      added: 1,
      removed: 1,
      modified: 2,
      changedIds: 1,
    });
    expect(
      diff.added.map((definition: { key: string }) => definition.key)
    ).toEqual(["constructor:added"]);
    expect(
      diff.removed.map((definition: { key: string }) => definition.key)
    ).toEqual(["constructor:removed"]);
  });

  test("rejects unexpected or stale removal allowances", () => {
    expect(() =>
      validateRemovals(diff.removed, [], "fixture transition")
    ).toThrow("Unexpected removals");
    expect(() =>
      validateRemovals(
        diff.removed,
        ["constructor:removed", "constructor:stale"],
        "fixture transition"
      )
    ).toThrow("Stale removal allowances");
    expect(() =>
      validateRemovals(
        diff.removed,
        ["constructor:removed"],
        "fixture transition"
      )
    ).not.toThrow();
  });

  test("rejects schema paths outside the repository", () => {
    expect(() =>
      resolveRepositoryPath("/tmp/repository", "../api.tl", "fixture path")
    ).toThrow("escapes the repository");
    expect(
      resolveRepositoryPath(
        "/tmp/repository",
        "schema-history/api.tl",
        "fixture path"
      )
    ).toBe("/tmp/repository/schema-history/api.tl");
  });
});
