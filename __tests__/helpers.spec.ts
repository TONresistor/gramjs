import { sleep } from "../gramjs/Helpers";

describe("sleep", () => {
  test("does not assume web-style timers expose unref", async () => {
    const timer = jest
      .spyOn(global, "setTimeout")
      .mockImplementation(((callback: () => void) => {
        callback();
        return 1 as any;
      }) as typeof setTimeout);

    await expect(sleep(0, true)).resolves.toBeUndefined();
    expect(timer).toHaveBeenCalledTimes(1);

    timer.mockRestore();
  });
});
