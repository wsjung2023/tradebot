type WaitForDatabaseOptions = {
  retryDelayMs: number;
  onRetry?: (error: unknown, attempt: number) => void;
  sleep?: (delayMs: number) => Promise<void>;
};

const defaultSleep = (delayMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, delayMs));

export async function waitForDatabase(
  probe: () => Promise<unknown>,
  options: WaitForDatabaseOptions,
): Promise<number> {
  let attempt = 0;
  const sleep = options.sleep ?? defaultSleep;

  while (true) {
    attempt += 1;

    try {
      await probe();
      return attempt;
    } catch (error) {
      options.onRetry?.(error, attempt);
      await sleep(options.retryDelayMs);
    }
  }
}
